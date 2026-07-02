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
    this.readHold,
    this.repository,
    this.platformOverride,
    this.onOpenAppointments,
  }) : assert(readHold != null || repository != null);

  final String holdId;
  final String initialState;
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
      appBar: AppBar(title: const Text('Статус записи')),
      body: FutureBuilder<BookingHoldSnapshot>(
        future: _snapshot,
        builder: (context, snapshot) {
          final hold = snapshot.data;
          final state = hold?.state ?? widget.initialState;
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
                  Text(
                    'Время визита',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  Text(_range(context, hold.startsAt, hold.endsAt)),
                ],
                if (snapshot.hasError)
                  const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: Text(
                      'Не удалось обновить статус. Показано последнее известное состояние.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                const Spacer(),
                OutlinedButton.icon(
                  onPressed: snapshot.connectionState == ConnectionState.waiting
                      ? null
                      : _reload,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Обновить статус'),
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
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Статус записи'),
      ),
      child: SafeArea(
        child: FutureBuilder<BookingHoldSnapshot>(
          future: _snapshot,
          builder: (context, snapshot) {
            final hold = snapshot.data;
            final state = hold?.state ?? widget.initialState;
            final status = _bookingResultStatus(state);
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
                  const SizedBox(height: 16),
                  OwnerCupertinoStatusBanner(
                    tone: _bookingResultTone(status.tone),
                    icon: CupertinoIcons.info_circle,
                    title: 'Что дальше',
                    message: status.nextAction,
                  ),
                  if (hold != null) ...[
                    const SizedBox(height: 24),
                    Text(
                      'Время визита',
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(
                            color: CupertinoDynamicColor.resolve(
                              CupertinoColors.secondaryLabel,
                              context,
                            ),
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(_cupertinoRange(hold.startsAt, hold.endsAt)),
                  ],
                  if (snapshot.hasError)
                    const Padding(
                      padding: EdgeInsets.only(top: 16),
                      child: Text(
                        'Не удалось обновить статус. Показано последнее известное состояние.',
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
                    label: 'Обновить статус',
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

IconData _icon(String state) => state == 'CONFIRMED'
    ? Icons.check_circle_outline
    : state == 'EXPIRED' ||
            state == 'SLA_BREACHED' ||
            state == 'RELEASED' ||
            state == 'MIS_BOOKING_FAILED'
        ? Icons.event_busy_outlined
        : Icons.hourglass_top_outlined;

CupertinoDynamicColor _cupertinoIconColor(String tone) => tone == 'success'
    ? CupertinoColors.systemGreen
    : tone == 'danger'
        ? CupertinoColors.systemRed
        : tone == 'warning'
            ? CupertinoColors.systemOrange
            : CupertinoColors.activeBlue;

String _title(String state) => state == 'CONFIRMED'
    ? 'Запись подтверждена'
    : state == 'EXPIRED' || state == 'SLA_BREACHED'
        ? 'Время подтверждения истекло'
        : state == 'RELEASED' || state == 'MIS_BOOKING_FAILED'
            ? 'Запись не подтверждена'
            : 'Заявка отправлена в клинику';

String _message(String state) => state == 'CONFIRMED'
    ? 'Клиника подтвердила ваше время.'
    : state == 'EXPIRED' || state == 'SLA_BREACHED'
        ? 'Клиника не успела подтвердить заявку. Выберите другое окно.'
        : state == 'RELEASED' || state == 'MIS_BOOKING_FAILED'
            ? 'Это время больше недоступно. Выберите другое окно.'
            : 'Клиника подтверждает возможность записи. VetHelp покажет итоговый статус.';

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
      title: 'Визит подтверждён',
      description: 'Клиника подтвердила выбранное время.',
      nextAction:
          'Откройте запись, чтобы увидеть адрес, питомца, услугу и доступные действия.',
      icon: CupertinoIcons.check_mark_circled,
      tone: 'success',
    );
  }
  if (normalized == 'EXPIRED' || normalized == 'SLA_BREACHED') {
    return const _BookingResultStatus(
      title: 'Время подтверждения истекло',
      description: 'Клиника не успела подтвердить заявку.',
      nextAction:
          'Выберите другое время в каталоге. Новый слот будет проверен сервером отдельно.',
      icon: CupertinoIcons.calendar_badge_minus,
      tone: 'warning',
    );
  }
  if (normalized == 'RELEASED' || normalized == 'MIS_BOOKING_FAILED') {
    return const _BookingResultStatus(
      title: 'Запись не подтверждена',
      description: 'Это время больше недоступно для записи.',
      nextAction:
          'Вернитесь к каталогу и выберите другое время. Текущий слот не удерживается.',
      icon: CupertinoIcons.xmark_circle,
      tone: 'danger',
    );
  }
  return const _BookingResultStatus(
    title: 'Заявка отправлена в клинику',
    description:
        'Клиника проверяет возможность записи. Итоговый статус появится в разделе «Записи».',
    nextAction:
        'Сейчас можно открыть записи или обновить статус. Подтверждение не обещается до ответа клиники.',
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
