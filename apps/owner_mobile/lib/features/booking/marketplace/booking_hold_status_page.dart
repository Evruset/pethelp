import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../presentation/platform/owner_platform.dart';
import '../../../presentation/widgets/owner_cupertino_feedback.dart';
import 'booking_marketplace_repository.dart';

typedef BookingHoldReader = Future<BookingHoldSnapshot> Function(String holdId);

class BookingHoldStatusPage extends StatefulWidget {
  const BookingHoldStatusPage({
    super.key,
    required this.holdId,
    required this.initialState,
    required this.clinicName,
    required this.locationAddress,
    required this.serviceName,
    required this.petName,
    this.readHold,
    this.repository,
    this.platformOverride,
    this.onOpenAppointments,
  }) : assert(readHold != null || repository != null);

  final String holdId;
  final String initialState;
  final String clinicName;
  final String locationAddress;
  final String serviceName;
  final String petName;
  final BookingHoldReader? readHold;
  final BookingMarketplaceRepository? repository;
  final TargetPlatform? platformOverride;
  final VoidCallback? onOpenAppointments;

  @override
  State<BookingHoldStatusPage> createState() => _BookingHoldStatusPageState();
}

class _BookingHoldStatusPageState extends State<BookingHoldStatusPage> {
  late Future<BookingHoldSnapshot> _snapshot;

  BookingHoldReader get _reader =>
      widget.readHold ?? widget.repository!.readHold;

  @override
  void initState() {
    super.initState();
    _snapshot = _reader(widget.holdId);
  }

  void _reload() {
    final next = _reader(widget.holdId);
    setState(() => _snapshot = next);
  }

  @override
  Widget build(BuildContext context) {
    if (ownerUsesCupertino(platform: widget.platformOverride)) {
      return _buildCupertino(context);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Вы записаны')),
      body: FutureBuilder<BookingHoldSnapshot>(
        future: _snapshot,
        builder: (context, snapshot) {
          final hold = snapshot.data;
          final state = hold?.state ?? widget.initialState;
          final booked = _isBookedState(state);
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(_icon(state), size: 56),
                const SizedBox(height: 16),
                Text(
                  _title(state),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(_message(state), textAlign: TextAlign.center),
                if (hold != null) ...[
                  const SizedBox(height: 24),
                  _MaterialBookingDetails(
                    time: _range(context, hold.startsAt, hold.endsAt),
                    clinicName: widget.clinicName,
                    locationAddress: widget.locationAddress,
                    serviceName: widget.serviceName,
                    petName: widget.petName,
                  ),
                ],
                if (snapshot.hasError)
                  const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: Text(
                      'Не удалось загрузить детали записи. Откройте раздел «Записи» чуть позже.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                const Spacer(),
                if (widget.onOpenAppointments != null) ...[
                  FilledButton(
                    onPressed: widget.onOpenAppointments,
                    child: const Text('Открыть записи'),
                  ),
                  const SizedBox(height: 8),
                ],
                if (!booked)
                  OutlinedButton.icon(
                    onPressed:
                        snapshot.connectionState == ConnectionState.waiting
                            ? null
                            : _reload,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Обновить детали'),
                  ),
                TextButton(
                  onPressed: () =>
                      Navigator.of(context).popUntil((route) => route.isFirst),
                  child: const Text('Вернуться к помощи питомцу'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCupertino(BuildContext context) {
    final initialBooked = _isBookedState(widget.initialState);
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(initialBooked ? 'Вы записаны' : 'Запись'),
      ),
      child: SafeArea(
        child: FutureBuilder<BookingHoldSnapshot>(
          future: _snapshot,
          builder: (context, snapshot) {
            final hold = snapshot.data;
            final state = hold?.state ?? widget.initialState;
            final status = _bookingResultStatus(state);
            final booked = _isBookedState(state);
            return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    status.icon,
                    size: 56,
                    color: CupertinoDynamicColor.resolve(
                      _cupertinoIconColor(status.tone),
                      context,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    status.title,
                    textAlign: TextAlign.center,
                    style: CupertinoTheme.of(context)
                        .textTheme
                        .navLargeTitleTextStyle,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    status.description,
                    textAlign: TextAlign.center,
                    style: CupertinoTheme.of(context).textTheme.textStyle,
                  ),
                  if (!booked) ...[
                    const SizedBox(height: 16),
                    OwnerCupertinoStatusBanner(
                      tone: _bookingResultTone(status.tone),
                      icon: CupertinoIcons.info_circle,
                      title: 'Дальше',
                      message: status.nextAction,
                    ),
                  ],
                  if (hold != null) ...[
                    const SizedBox(height: 24),
                    _CupertinoBookingDetails(
                      time: _cupertinoRange(hold.startsAt, hold.endsAt),
                      clinicName: widget.clinicName,
                      locationAddress: widget.locationAddress,
                      serviceName: widget.serviceName,
                      petName: widget.petName,
                    ),
                  ],
                  if (snapshot.hasError)
                    const Padding(
                      padding: EdgeInsets.only(top: 16),
                      child: Text(
                        'Не удалось загрузить детали записи. Откройте раздел «Записи» чуть позже.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  const SizedBox(height: 24),
                  if (widget.onOpenAppointments != null) ...[
                    OwnerCupertinoButton.primary(
                      label: 'Открыть записи',
                      onPressed: widget.onOpenAppointments,
                      semanticLabel: 'Открыть список записей',
                    ),
                    const SizedBox(height: 8),
                  ],
                  OwnerCupertinoButton.secondary(
                    label: 'Обновить детали',
                    icon: CupertinoIcons.refresh,
                    enabled:
                        snapshot.connectionState != ConnectionState.waiting,
                    onPressed: _reload,
                  ),
                  CupertinoButton(
                    minSize: 44,
                    onPressed: () => Navigator.of(context)
                        .popUntil((route) => route.isFirst),
                    child: const Text('Вернуться к разделам VetHelp'),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _MaterialBookingDetails extends StatelessWidget {
  const _MaterialBookingDetails({
    required this.time,
    required this.clinicName,
    required this.locationAddress,
    required this.serviceName,
    required this.petName,
  });

  final String time;
  final String clinicName;
  final String locationAddress;
  final String serviceName;
  final String petName;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _MaterialDetailRow(label: 'Когда', value: time),
            _MaterialDetailRow(label: 'Клиника', value: clinicName),
            if (locationAddress.isNotEmpty)
              _MaterialDetailRow(label: 'Адрес', value: locationAddress),
            _MaterialDetailRow(label: 'Питомец', value: petName),
            _MaterialDetailRow(label: 'Услуга', value: serviceName),
          ],
        ),
      ),
    );
  }
}

class _MaterialDetailRow extends StatelessWidget {
  const _MaterialDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 2),
          Text(value, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _CupertinoBookingDetails extends StatelessWidget {
  const _CupertinoBookingDetails({
    required this.time,
    required this.clinicName,
    required this.locationAddress,
    required this.serviceName,
    required this.petName,
  });

  final String time;
  final String clinicName;
  final String locationAddress;
  final String serviceName;
  final String petName;

  @override
  Widget build(BuildContext context) {
    return CupertinoListSection.insetGrouped(
      header: const Text('Детали визита'),
      children: [
        _CupertinoDetailRow(label: 'Когда', value: time),
        _CupertinoDetailRow(label: 'Клиника', value: clinicName),
        if (locationAddress.isNotEmpty)
          _CupertinoDetailRow(label: 'Адрес', value: locationAddress),
        _CupertinoDetailRow(label: 'Питомец', value: petName),
        _CupertinoDetailRow(label: 'Услуга', value: serviceName),
      ],
    );
  }
}

class _CupertinoDetailRow extends StatelessWidget {
  const _CupertinoDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      label: '$label: $value',
      child: CupertinoListTile(
        title: Text(label),
        subtitle: Text(value, style: TextStyle(color: secondary)),
      ),
    );
  }
}

IconData _icon(String state) => state == 'CONFIRMED'
    ? Icons.check_circle_outline
    : state == 'EXPIRED' ||
            state == 'SLA_BREACHED' ||
            state == 'RELEASED' ||
            state == 'MIS_BOOKING_FAILED'
        ? Icons.event_busy_outlined
        : Icons.hourglass_top_outlined;

bool _isBookedState(String state) => state.toUpperCase() == 'CONFIRMED';

CupertinoDynamicColor _cupertinoIconColor(String tone) => tone == 'success'
    ? CupertinoColors.systemGreen
    : tone == 'danger'
        ? CupertinoColors.systemRed
        : tone == 'warning'
            ? CupertinoColors.systemOrange
            : CupertinoColors.activeBlue;

String _title(String state) => state == 'CONFIRMED'
    ? 'Вы записаны'
    : state == 'EXPIRED' || state == 'SLA_BREACHED'
        ? 'Время недоступно'
        : state == 'RELEASED' || state == 'MIS_BOOKING_FAILED'
            ? 'Запись не оформлена'
            : 'Запись оформляется';

String _message(String state) => state == 'CONFIRMED'
    ? 'Детали визита доступны ниже и в разделе «Записи».'
    : state == 'EXPIRED' || state == 'SLA_BREACHED'
        ? 'Это время уже заняли. Выберите другое окно.'
        : state == 'RELEASED' || state == 'MIS_BOOKING_FAILED'
            ? 'Это время больше недоступно. Выберите другое окно.'
            : 'Мы покажем результат в разделе «Записи».';

class _BookingResultStatus {
  const _BookingResultStatus({
    required this.title,
    required this.description,
    required this.nextAction,
    required this.icon,
    required this.tone,
  });

  final String title;
  final String description;
  final String nextAction;
  final IconData icon;
  final String tone;
}

_BookingResultStatus _bookingResultStatus(String state) {
  final normalized = state.toUpperCase();
  if (normalized == 'CONFIRMED') {
    return const _BookingResultStatus(
      title: 'Вы записаны',
      description: 'Детали визита доступны ниже и в разделе «Записи».',
      nextAction: 'Откройте запись, чтобы увидеть доступные действия.',
      icon: CupertinoIcons.check_mark_circled,
      tone: 'success',
    );
  }
  if (normalized == 'EXPIRED' || normalized == 'SLA_BREACHED') {
    return const _BookingResultStatus(
      title: 'Время недоступно',
      description: 'Это время уже заняли. Выберите другое окно.',
      nextAction: 'Вернитесь к выбору времени и выберите другой слот.',
      icon: CupertinoIcons.calendar_badge_minus,
      tone: 'warning',
    );
  }
  if (normalized == 'RELEASED' || normalized == 'MIS_BOOKING_FAILED') {
    return const _BookingResultStatus(
      title: 'Запись не оформлена',
      description: 'Это время больше недоступно для записи.',
      nextAction:
          'Вернитесь к каталогу и выберите другое время. Текущий слот не удерживается.',
      icon: CupertinoIcons.xmark_circle,
      tone: 'danger',
    );
  }
  return const _BookingResultStatus(
    title: 'Запись оформляется',
    description: 'Мы покажем результат в разделе «Записи».',
    nextAction: 'Можно открыть записи или обновить детали этого визита.',
    icon: CupertinoIcons.hourglass,
    tone: 'info',
  );
}

OwnerCupertinoFeedbackTone _bookingResultTone(String tone) {
  return switch (tone) {
    'success' => OwnerCupertinoFeedbackTone.neutral,
    'warning' || 'danger' => OwnerCupertinoFeedbackTone.warning,
    _ => OwnerCupertinoFeedbackTone.neutral,
  };
}

String _range(BuildContext context, DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(first);
  final start = TimeOfDay.fromDateTime(first).format(context);
  final end = TimeOfDay.fromDateTime(last).format(context);
  return '$date, $start–$end';
}

String _cupertinoRange(DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final date =
      '${first.day.toString().padLeft(2, '0')}.${first.month.toString().padLeft(2, '0')}.${first.year}';
  final start =
      '${first.hour.toString().padLeft(2, '0')}:${first.minute.toString().padLeft(2, '0')}';
  final end =
      '${last.hour.toString().padLeft(2, '0')}:${last.minute.toString().padLeft(2, '0')}';
  return '$date, $start–$end';
}
