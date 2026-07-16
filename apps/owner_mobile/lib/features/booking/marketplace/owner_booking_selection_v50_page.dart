import 'dart:math';

import 'package:flutter/material.dart';

import '../../pets/owner_v50_pet_visuals.dart';
import 'booking_selection_models.dart';
import 'booking_selection_repository.dart';
import 'booking_marketplace_repository.dart';
import 'booking_hold_status_page.dart';

enum BookingReviewSubmissionState {
  idle,
  submitting,
  softRetry,
  successReadback,
  finalConflict,
  networkAmbiguous,
  offlineBlocked,
  sessionExpired,
}

class OwnerBookingSelectionV50Page extends StatefulWidget {
  const OwnerBookingSelectionV50Page({
    super.key,
    required this.seed,
    required this.repository,
    required this.onContinue,
    required this.onRequireAuthentication,
    this.initialIntent,
    this.restoreIntentToReview = true,
    this.offline = false,
    this.holdRepository,
    this.createHoldEnabled = false,
    this.bookingStatusEnabled = false,
    this.operationKeyFactory,
  });

  final BookingSelectionSeed seed;
  final BookingSelectionRepository repository;
  final ValueChanged<BookingSelectionContext> onContinue;
  final ValueChanged<BookingSelectionContext> onRequireAuthentication;
  final BookingSelectionContext? initialIntent;
  final bool restoreIntentToReview;
  final bool offline;
  final BookingHoldCommandRepository? holdRepository;
  final bool createHoldEnabled;
  final bool bookingStatusEnabled;
  final String Function()? operationKeyFactory;

  @override
  State<OwnerBookingSelectionV50Page> createState() =>
      _OwnerBookingSelectionV50PageState();
}

class _OwnerBookingSelectionV50PageState
    extends State<OwnerBookingSelectionV50Page> {
  late Future<BookingSelectionSnapshot> _request;
  String? _serviceId;
  String? _date;
  String? _slotId;
  late bool _restoreReview;
  BookingReviewSubmissionState _submission = BookingReviewSubmissionState.idle;
  String? _operationKey;
  String? _correlationId;

  @override
  void initState() {
    super.initState();
    _serviceId = widget.initialIntent?.serviceId ?? widget.seed.serviceId;
    _date = widget.initialIntent?.selectedDate;
    _slotId = widget.initialIntent?.slotId;
    _restoreReview =
        widget.initialIntent != null && widget.restoreIntentToReview;
    _request = _load();
  }

  Future<BookingSelectionSnapshot> _load() => widget.repository.readOptions(
        locationId: widget.seed.locationId,
        doctorId: widget.seed.doctorId,
        selectedPetId: widget.seed.petId,
      );

  String _newUuid() {
    final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  bool get _transactionalEnabled =>
      widget.createHoldEnabled &&
      widget.bookingStatusEnabled &&
      widget.holdRepository != null;

  Future<void> _submitHold(BookingSelectionContext intent,
      BookingSelectionSnapshot data, BookingOptionService service) async {
    if (_submission == BookingReviewSubmissionState.submitting) return;
    if (widget.offline) {
      setState(() => _submission = BookingReviewSubmissionState.offlineBlocked);
      return;
    }
    final petId = intent.petId;
    if (petId == null) {
      widget.onRequireAuthentication(intent);
      return;
    }
    _operationKey ??= widget.operationKeyFactory?.call() ?? _newUuid();
    _correlationId ??= _newUuid();
    setState(() => _submission = BookingReviewSubmissionState.submitting);
    try {
      final created = await widget.holdRepository!.createSelectionHold(
        CreateBookingHoldRequest(
            selection: intent,
            operationKey: _operationKey!,
            correlationId: _correlationId!),
      );
      final authoritative =
          await widget.holdRepository!.readHold(created.holdId);
      if (!mounted) return;
      setState(
          () => _submission = BookingReviewSubmissionState.successReadback);
      await Navigator.of(context).push(MaterialPageRoute<void>(
        settings: const RouteSettings(name: '/owner/booking/status'),
        builder: (_) => BookingHoldStatusPage(
          holdId: authoritative.holdId,
          initialState: authoritative.state,
          clinicName: data.clinicName,
          locationAddress: data.locationAddress,
          serviceName: service.displayName,
          petName: widget.seed.petName ?? 'Питомец',
          repository: widget.holdRepository,
        ),
      ));
    } on BookingMarketplaceApiException catch (error) {
      if (!mounted) return;
      setState(() => _submission = switch ((error.statusCode, error.code)) {
            (401, _) => BookingReviewSubmissionState.sessionExpired,
            (_, 'SLOT_LOCKED_RETRY') ||
            (_, 'SLOT_VERSION_STALE') ||
            (_, 'BOOKING_TEMPORARILY_UNAVAILABLE') =>
              BookingReviewSubmissionState.softRetry,
            _ => BookingReviewSubmissionState.finalConflict,
          });
    } catch (_) {
      if (mounted) {
        setState(
            () => _submission = BookingReviewSubmissionState.networkAmbiguous);
      }
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<BookingSelectionSnapshot>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return _frame(
              title: 'Выбор времени',
              child: const _BookingSelectionSkeleton(),
            );
          }
          if (snapshot.hasError || snapshot.data == null) {
            return _frame(
              title: 'Не удалось проверить время',
              child: OwnerV50InsetSection(
                title: 'Попробуйте ещё раз',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                        'Данные не изменены. Повторите безопасную read-only проверку.'),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: () => setState(() => _request = _load()),
                      child: const Text('Повторить'),
                    ),
                  ],
                ),
              ),
            );
          }
          final data = snapshot.data!;
          final service =
              data.services.where((item) => item.id == _serviceId).firstOrNull;
          final availableDates = data.availableDates;
          if (_date != null && !availableDates.contains(_date)) {
            _date = null;
            _slotId = null;
          }
          final slots = data.slots
              .where((slot) =>
                  slot.serviceId == _serviceId && slot.localDate == _date)
              .toList(growable: false);
          final selected =
              slots.where((slot) => slot.id == _slotId).firstOrNull;
          if (_restoreReview && service != null && selected != null) {
            _restoreReview = false;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _openReview(data, service, selected);
            });
          }
          return _selectionPage(data, service, availableDates, slots, selected);
        },
      );

  Widget _selectionPage(
    BookingSelectionSnapshot data,
    BookingOptionService? service,
    List<String> dates,
    List<BookingOptionSlot> slots,
    BookingOptionSlot? selected,
  ) =>
      _frame(
        title: 'Выбор времени',
        supportingText:
            '${data.clinicName} · ${data.locationAddress}\nЭто желаемое время, а не удержанный слот.',
        status: _freshnessBanner(data.freshness),
        child: LayoutBuilder(builder: (context, constraints) {
          final sections = <Widget>[
            OwnerV50InsetSection(
              key: const ValueKey('service-selection-section'),
              title: '1. Услуга',
              child: data.services.isEmpty
                  ? const Text('Для этой локации нет доступных услуг.')
                  : Column(
                      children: data.services
                          .map((item) => RadioListTile<String>(
                                key: ValueKey('booking-service-${item.id}'),
                                value: item.id,
                                groupValue: _serviceId,
                                onChanged: (value) => setState(() {
                                  _serviceId = value;
                                  _date = null;
                                  _slotId = null;
                                }),
                                title: Text(item.displayName),
                                subtitle: Text(
                                  '${item.durationMinutes} мин · от ${item.price.amount} ${item.price.currency}',
                                ),
                              ))
                          .toList(growable: false),
                    ),
            ),
            OwnerV50InsetSection(
              key: const ValueKey('date-selection-section'),
              title: '2. Дата · ${data.timezone}',
              child: dates.isEmpty
                  ? const Text('На доступном периоде нет свободных дат.')
                  : Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: dates
                          .map((date) => ChoiceChip(
                                key: ValueKey('booking-date-$date'),
                                label: Text(_dateLabel(date)),
                                selected: _date == date,
                                onSelected: service == null
                                    ? null
                                    : (_) => setState(() {
                                          _date = date;
                                          _slotId = null;
                                        }),
                              ))
                          .toList(growable: false),
                    ),
            ),
            OwnerV50InsetSection(
              key: const ValueKey('slot-selection-section'),
              title: '3. Доступное время',
              child: _date == null
                  ? const Text('Сначала выберите дату.')
                  : slots.isEmpty
                      ? const Text('На выбранную дату нет доступного времени.')
                      : Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: slots
                              .map((slot) => _SlotChoice(
                                    slot: slot,
                                    selected: slot.id == _slotId,
                                    onSelected: () =>
                                        setState(() => _slotId = slot.id),
                                  ))
                              .toList(growable: false),
                        ),
            ),
          ];
          final summary = OwnerV50InsetSection(
            key: const ValueKey('booking-selection-summary'),
            title: 'Ваш выбор',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.seed.petName ?? 'Питомец будет выбран после входа'),
                Text(data.clinicName),
                Text(service?.displayName ?? 'Услуга не выбрана'),
                Text(selected == null
                    ? 'Время не выбрано'
                    : '${_dateLabel(selected.localDate)} · ${selected.localTime}'),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const ValueKey('booking-open-review'),
                    onPressed: selected == null || widget.offline
                        ? null
                        : () => _openReview(data, service!, selected),
                    child: const Text('Продолжить'),
                  ),
                ),
                if (widget.offline)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Подключитесь к интернету, чтобы проверить время и продолжить запись.',
                    ),
                  ),
              ],
            ),
          );
          if (constraints.maxWidth >= 980) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 2, child: Column(children: sections)),
                const SizedBox(width: 18),
                SizedBox(width: 330, child: summary),
              ],
            );
          }
          return Column(children: [...sections, summary]);
        }),
      );

  void _openReview(
    BookingSelectionSnapshot data,
    BookingOptionService service,
    BookingOptionSlot slot,
  ) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      settings: const RouteSettings(name: '/owner/booking/review'),
      builder: (_) => _reviewPage(data, service, slot),
    ));
  }

  Widget _reviewPage(
    BookingSelectionSnapshot data,
    BookingOptionService service,
    BookingOptionSlot slot,
  ) {
    final intent = BookingSelectionContext(
      petId: widget.seed.petId,
      clinicId: data.clinicId,
      locationId: data.locationId,
      serviceId: service.id,
      doctorId: widget.seed.doctorId,
      selectedDate: slot.localDate,
      slotId: slot.id,
      expectedSlotVersion: slot.expectedVersion,
      confirmationMode: slot.confirmationMode,
      priceSnapshot: service.price,
      priceReference: slot.priceReference,
      availabilityFreshness: slot.freshness,
    );
    return _frame(
      title: 'Проверьте запись',
      supportingText:
          'Проверьте детали перед следующим этапом. Время ещё не удерживается.',
      status: _confirmationBanner(slot),
      child: LayoutBuilder(builder: (context, constraints) {
        final details = OwnerV50InsetSection(
          key: const ValueKey('booking-review-details'),
          title: 'Детали выбора',
          child: Column(
            children: [
              _ReviewRow(
                  'Питомец', widget.seed.petName ?? 'Выбрать после входа'),
              _ReviewRow('Клиника', data.clinicName),
              _ReviewRow('Адрес', data.locationAddress),
              _ReviewRow('Услуга', service.displayName),
              _ReviewRow(
                  'Специалист',
                  widget.seed.doctorId == null
                      ? 'Любой подходящий специалист'
                      : 'Выбранный специалист'),
              _ReviewRow('Дата и время',
                  '${_dateLabel(slot.localDate)} · ${slot.localTime}'),
              _ReviewRow('Часовой пояс', slot.timezone),
            ],
          ),
        );
        final price = OwnerV50InsetSection(
          key: const ValueKey('booking-review-price'),
          title: 'Стоимость',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                  'Стоимость приёма от ${service.price.amount} ${service.price.currency}',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              const Text('В стоимость входит выбранная базовая услуга.'),
              const Text('Дополнительные исследования оплачиваются отдельно.'),
              const Text('Окончательную стоимость согласует клиника.'),
              const Text('Оплата в клинике.'),
            ],
          ),
        );
        final action = OwnerV50InsetSection(
          title: 'Следующий этап',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_freshnessText(slot.freshness)),
              Text(_confirmationText(slot.confirmationMode)),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const ValueKey('booking-review-continue'),
                  onPressed:
                      _submission == BookingReviewSubmissionState.submitting
                          ? null
                          : () => _transactionalEnabled
                              ? _submitHold(intent, data, service)
                              : widget.seed.petId == null
                                  ? widget.onRequireAuthentication(intent)
                                  : widget.onContinue(intent),
                  child: SizedBox(
                    height: 24,
                    child: Center(
                        child: _submission ==
                                BookingReviewSubmissionState.submitting
                            ? const SizedBox.square(
                                dimension: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : Text(widget.seed.petId == null
                                ? 'Войти и продолжить'
                                : _transactionalEnabled
                                    ? 'Отправить заявку'
                                    : 'Продолжить')),
                  ),
                ),
              ),
              if (_submission != BookingReviewSubmissionState.idle &&
                  _submission != BookingReviewSubmissionState.submitting)
                Semantics(
                  liveRegion: true,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_submissionMessage(_submission)),
                  ),
                ),
              const SizedBox(height: 8),
              const Text(
                'Продолжение не создаёт запись и не удерживает время. Все ID будут проверены повторно.',
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Изменить время'),
              ),
            ],
          ),
        );
        if (constraints.maxWidth >= 980) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Column(children: [details, price])),
              const SizedBox(width: 18),
              SizedBox(width: 350, child: action),
            ],
          );
        }
        return Column(children: [details, price, action]);
      }),
    );
  }

  Widget _frame({
    required String title,
    String? supportingText,
    Widget? status,
    required Widget child,
  }) =>
      Scaffold(
        appBar: AppBar(title: Text(title)),
        body: OwnerV50PetPageFrame(
          eyebrow: 'Запись в клинику',
          title: title,
          supportingText: supportingText ??
              '${widget.seed.clinicName} · ${widget.seed.serviceName}',
          status: status,
          child: child,
        ),
      );

  Widget _freshnessBanner(BookingAvailabilityFreshness freshness) =>
      OwnerV50StatusBanner(
        icon: freshness == BookingAvailabilityFreshness.stale
            ? Icons.history
            : Icons.update,
        title: _freshnessText(freshness),
        message: 'Источник времени — сервер клиники.',
        warning: freshness == BookingAvailabilityFreshness.stale,
      );

  Widget _confirmationBanner(BookingOptionSlot slot) => OwnerV50StatusBanner(
        icon: Icons.schedule_outlined,
        title: 'Можно ехать? Пока нет',
        message: _confirmationText(slot.confirmationMode),
        warning: slot.confirmationMode != BookingConfirmationMode.instant,
      );
}

String _submissionMessage(BookingReviewSubmissionState state) =>
    switch (state) {
      BookingReviewSubmissionState.softRetry =>
        'Время обновилось. Повторите отправку — заявка и ваш выбор сохранены.',
      BookingReviewSubmissionState.finalConflict =>
        'Это время больше недоступно. Вернитесь к актуальным вариантам.',
      BookingReviewSubmissionState.networkAmbiguous =>
        'Ответ не получен. Повторная проверка использует тот же номер операции.',
      BookingReviewSubmissionState.offlineBlocked =>
        'Подключитесь к интернету, чтобы проверить время и отправить заявку.',
      BookingReviewSubmissionState.sessionExpired =>
        'Сессия завершилась. Войдите снова — ваш выбор сохранён.',
      BookingReviewSubmissionState.successReadback =>
        'Статус подтверждён сервером.',
      _ => '',
    };

class _SlotChoice extends StatelessWidget {
  const _SlotChoice({
    required this.slot,
    required this.selected,
    required this.onSelected,
  });
  final BookingOptionSlot slot;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: selected,
        button: true,
        label:
            '${slot.localTime}, ${_slotStateText(slot.availability)}${selected ? ', выбрано' : ''}',
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 82, minHeight: 48),
          child: ChoiceChip(
            key: ValueKey('booking-slot-${slot.id}'),
            label: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(slot.localTime),
              Text(_slotStateText(slot.availability),
                  style: Theme.of(context).textTheme.labelSmall),
            ]),
            selected: selected,
            onSelected: (_) => onSelected(),
          ),
        ),
      );
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(label)),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontWeight: FontWeight.w700))),
        ]),
      );
}

class _BookingSelectionSkeleton extends StatelessWidget {
  const _BookingSelectionSkeleton();
  @override
  Widget build(BuildContext context) => const OwnerV50InsetSection(
        title: 'Проверяем услуги и время',
        child: LinearProgressIndicator(),
      );
}

String _dateLabel(String value) {
  final parts = value.split('-');
  return parts.length == 3 ? '${parts[2]}.${parts[1]}' : value;
}

String _slotStateText(BookingSlotAvailability value) => switch (value) {
      BookingSlotAvailability.available => 'Доступно',
      BookingSlotAvailability.requestOnly => 'По заявке',
      BookingSlotAvailability.stale => 'Нужно уточнить',
    };

String _freshnessText(BookingAvailabilityFreshness value) => switch (value) {
      BookingAvailabilityFreshness.current => 'Время обновлено недавно',
      BookingAvailabilityFreshness.aging => 'Проверяем актуальность времени',
      BookingAvailabilityFreshness.stale =>
        'Клиника подтвердит, доступно ли это время',
      BookingAvailabilityFreshness.unavailable =>
        'Сейчас выбрать это время нельзя',
    };

String _confirmationText(BookingConfirmationMode value) => switch (value) {
      BookingConfirmationMode.instant =>
        'После отправки и успешного создания записи время может быть подтверждено сразу.',
      BookingConfirmationMode.clinicConfirmation =>
        'Клиника подтвердит заявку.',
      BookingConfirmationMode.alternativePossible =>
        'Это желаемое время. Клиника подтвердит его или предложит другое.',
    };
