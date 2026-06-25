import 'package:flutter/material.dart';

import 'booking_marketplace_repository.dart';

typedef BookingHoldReader = Future<BookingHoldSnapshot> Function(String holdId);

class BookingHoldStatusPage extends StatefulWidget {
  const BookingHoldStatusPage({
    super.key,
    required this.holdId,
    required this.initialState,
    this.readHold,
    this.repository,
  }) : assert(readHold != null || repository != null);

  final String holdId;
  final String initialState;
  final BookingHoldReader? readHold;
  final BookingMarketplaceRepository? repository;

  @override
  State<BookingHoldStatusPage> createState() => _BookingHoldStatusPageState();
}

class _BookingHoldStatusPageState extends State<BookingHoldStatusPage> {
  late Future<BookingHoldSnapshot> _snapshot;

  BookingHoldReader get _reader => widget.readHold ?? widget.repository!.readHold;

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
                Text(_title(state), textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(_message(state), textAlign: TextAlign.center),
                if (hold != null) ...[
                  const SizedBox(height: 24),
                  Text('Время визита', style: Theme.of(context).textTheme.labelLarge),
                  Text(_range(context, hold.startsAt, hold.endsAt)),
                ],
                if (snapshot.hasError) const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text('Не удалось обновить статус. Показано последнее известное состояние.', textAlign: TextAlign.center),
                ),
                const Spacer(),
                OutlinedButton.icon(onPressed: snapshot.connectionState == ConnectionState.waiting ? null : _reload, icon: const Icon(Icons.refresh), label: const Text('Обновить статус')),
                TextButton(onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst), child: const Text('Вернуться к помощи питомцу')),
              ],
            ),
          );
        },
      ),
    );
  }
}

IconData _icon(String state) => state == 'CONFIRMED'
    ? Icons.check_circle_outline
    : state == 'EXPIRED' || state == 'SLA_BREACHED' || state == 'RELEASED' || state == 'MIS_BOOKING_FAILED'
        ? Icons.event_busy_outlined
        : Icons.hourglass_top_outlined;

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

String _range(BuildContext context, DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(first);
  final start = TimeOfDay.fromDateTime(first).format(context);
  final end = TimeOfDay.fromDateTime(last).format(context);
  return '$date, $start–$end';
}
