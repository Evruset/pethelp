import 'package:flutter/material.dart';

import 'booking_marketplace_repository.dart';

class BookingHoldStatusPage extends StatefulWidget {
  const BookingHoldStatusPage({
    super.key,
    required this.hold,
    required this.repository,
  });

  final CreatedBookingHold hold;
  final BookingMarketplaceRepository repository;

  @override
  State<BookingHoldStatusPage> createState() => _BookingHoldStatusPageState();
}

class _BookingHoldStatusPageState extends State<BookingHoldStatusPage> {
  late Future<BookingHoldSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = widget.repository.readHold(widget.hold.holdId);
  }

  void _refresh() {
    setState(() {
      _snapshot = widget.repository.readHold(widget.hold.holdId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Статус записи')),
      body: SafeArea(
        child: FutureBuilder<BookingHoldSnapshot>(
          future: _snapshot,
          builder: (context, snapshot) {
            final view = snapshot.data;
            final state = view?.state ?? widget.hold.state;
            final presentation = _presentationFor(state);
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    presentation.icon,
                    size: 56,
                    color: presentation.color(context),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    presentation.title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    presentation.message,
                    textAlign: TextAlign.center,
                  ),
                  if (view != null) ...[
                    const SizedBox(height: 24),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Время визита', style: Theme.of(context).textTheme.labelLarge),
                            const SizedBox(height: 4),
                            Text(_formatRange(context, view.startsAt, view.endsAt)),
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (snapshot.hasError) ...[
                    const SizedBox(height: 18),
                    const Text(
                      'Не удалось обновить статус. Показано последнее подтверждённое состояние.',
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const Spacer(),
                  OutlinedButton.icon(
                    onPressed: snapshot.connectionState == ConnectionState.waiting ? null : _refresh,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Обновить статус'),
                  ),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                    child: const Text('Вернуться к помощи питомцу'),
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

class _StatusPresentation {
  const _StatusPresentation({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color Function(BuildContext context) color;
}

_StatusPresentation _presentationFor(String state) {
  return switch (state) {
    'MANUAL_CONFIRM_PENDING' => _StatusPresentation(
        icon: Icons.hourglass_top_outlined,
        title: 'Заявка отправлена в клинику',
        message: 'Клиника подтвердит запись в течение 15 минут. VetHelp покажет итоговый статус.',
        color: (context) => Theme.of(context).colorScheme.primary,
      ),
    'MIS_RESERVATION_PENDING' || 'MIS_HELD' => _StatusPresentation(
        icon: Icons.sync_outlined,
        title: 'Проверяем доступность времени',
        message: 'Клиника подтверждает возможность записи. Не создавайте повторную заявку на это же время.',
        color: (context) => Theme.of(context).colorScheme.primary,
      ),
    'CONFIRMED' => _StatusPresentation(
        icon: Icons.check_circle_outline,
        title: 'Запись подтверждена',
        message: 'Клиника подтвердила ваше время. Сохраните эту страницу до визита.',
        color: (context) => Theme.of(context).colorScheme.tertiary,
      ),
    'SLA_BREACHED' || 'EXPIRED' => _StatusPresentation(
        icon: Icons.schedule_outlined,
        title: 'Время подтверждения истекло',
        message: 'Клиника не успела подтвердить заявку. Выберите другое доступное время.',
        color: (context) => Theme.of(context).colorScheme.error,
      ),
    'MIS_BOOKING_FAILED' || 'RELEASED' => _StatusPresentation(
        icon: Icons.event_busy_outlined,
        title: 'Запись не подтверждена',
        message: 'Это время больше недоступно. Выберите другое окно.',
        color: (context) => Theme.of(context).colorScheme.error,
      ),
    _ => _StatusPresentation(
        icon: Icons.info_outline,
        title: 'Статус обновляется',
        message: 'VetHelp ожидает подтверждённое состояние от backend.',
        color: (context) => Theme.of(context).colorScheme.primary,
      ),
  };
}

String _formatRange(BuildContext context, DateTime startsAt, DateTime endsAt) {
  final localStart = startsAt.toLocal();
  final localEnd = endsAt.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(localStart);
  final start = TimeOfDay.fromDateTime(localStart).format(context);
  final end = TimeOfDay.fromDateTime(localEnd).format(context);
  return '$date, $start–$end';
}
