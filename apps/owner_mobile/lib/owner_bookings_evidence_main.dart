import 'package:flutter/material.dart';

import 'features/appointments/owner_bookings_v50_page.dart';
import 'features/appointments/owner_bookings_v50_repository.dart';
import 'ui/vethelp_ios_theme.dart';

void main() => runApp(const _EvidenceApp());

class _EvidenceApp extends StatelessWidget {
  const _EvidenceApp();

  @override
  Widget build(BuildContext context) {
    final state = Uri.base.queryParameters['state'] ?? 'BOOKINGS_ACTIVE';
    final detailState =
        state.startsWith('BOOKING_DETAIL_') || state.startsWith('CANCEL');
    final page = detailState
        ? OwnerBookingDetailV50Page(
            repository: _EvidenceRepository(state),
            id: 'booking-evidence',
            cancellationEnabled: true,
            online: state != 'BOOKINGS_OFFLINE_STALE')
        : OwnerBookingsV50Page(
            repository: _EvidenceRepository(state),
            detailEnabled: true,
            cancellationEnabled: true,
            online: state != 'BOOKINGS_OFFLINE_STALE',
            initialBucket: switch (state) {
              'BOOKINGS_REQUIRES_ACTION' => OwnerBookingBucket.requiresAction,
              'BOOKINGS_HISTORY' => OwnerBookingBucket.history,
              _ => OwnerBookingBucket.active,
            });
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: VetHelpTheme.light(),
      home: state.startsWith('CANCEL_')
          ? _CancellationFrame(state: state, child: page)
          : page,
    );
  }
}

class _CancellationFrame extends StatelessWidget {
  const _CancellationFrame({required this.state, required this.child});
  final String state;
  final Widget child;

  @override
  Widget build(BuildContext context) => Stack(children: [
        child,
        if (state == 'CANCEL_CONFIRMATION') const _ConfirmationOverlay(),
        if (state == 'CANCEL_SUBMITTING') const _SubmittingOverlay(),
        if (state == 'CANCEL_PENDING' || state == 'CANCELLED')
          Positioned(
              left: 16,
              right: 16,
              bottom: 24,
              child: Material(
                  color: state == 'CANCELLED'
                      ? const Color(0xFFE7F5EC)
                      : const Color(0xFFFFF4D6),
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Text(state == 'CANCELLED'
                          ? 'Запись отменена. Доступность времени обновлена сервером.'
                          : 'Запрос отправлен. Ожидаем подтверждения клиники.'))))
      ]);
}

class _ConfirmationOverlay extends StatelessWidget {
  const _ConfirmationOverlay();

  @override
  Widget build(BuildContext context) => ColoredBox(
      color: const Color(0x88000000),
      child: Center(
          child: Card(
              margin: const EdgeInsets.all(24),
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Text('Отменить запись?',
                            style: TextStyle(
                                fontSize: 22, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        const Text(
                            'Клиника получит запрос на отмену. Статус записи обновится после подтверждения.'),
                        const SizedBox(height: 20),
                        Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton(
                                  onPressed: () {}, child: const Text('Назад')),
                              const SizedBox(width: 8),
                              FilledButton(
                                  onPressed: () {},
                                  child: const Text('Отменить запись'))
                            ])
                      ]))))));
}

class _SubmittingOverlay extends StatelessWidget {
  const _SubmittingOverlay();

  @override
  Widget build(BuildContext context) => const ColoredBox(
      color: Color(0x55000000),
      child: Center(
          child: Card(
              child: Padding(
                  padding: EdgeInsets.all(28),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Отправляем запрос…')
                  ])))));
}

class _EvidenceRepository implements OwnerBookingsV50Repository {
  const _EvidenceRepository(this.state);
  final String state;

  static final now = DateTime.parse('2026-07-16T08:00:00Z');

  OwnerBookingCardV50 card(OwnerBookingBucket bucket) => OwnerBookingCardV50(
      id: 'booking-evidence',
      petId: 'pet-barsik',
      petName: 'Барсик',
      clinicName: 'Ветеринарная клиника «Добрые лапы»',
      statusLabel: switch (bucket) {
        OwnerBookingBucket.requiresAction => 'Требуется подтверждение',
        OwnerBookingBucket.active => 'Запись подтверждена',
        OwnerBookingBucket.history => 'Приём завершён',
      },
      startsAt: DateTime.parse('2026-07-17T06:30:00Z'),
      bucket: bucket);

  @override
  Future<OwnerBookingsPageV50> list({String? cursor, String? petId}) async {
    if (state == 'BOOKINGS_EMPTY') {
      return OwnerBookingsPageV50(
          serverNow: now,
          requiresAction: const [],
          active: const [],
          history: const []);
    }
    return OwnerBookingsPageV50(
        serverNow: now,
        requiresAction: [card(OwnerBookingBucket.requiresAction)],
        active: [card(OwnerBookingBucket.active)],
        history: [card(OwnerBookingBucket.history)]);
  }

  @override
  Future<OwnerBookingDetailV50> detail(String id) async {
    final terminal = state == 'BOOKING_DETAIL_TERMINAL' || state == 'CANCELLED';
    final pending =
        state == 'BOOKING_DETAIL_PENDING' || state == 'CANCEL_PENDING';
    return OwnerBookingDetailV50(
        id: id,
        petName: 'Барсик',
        clinicName: 'Ветеринарная клиника «Добрые лапы»',
        statusLabel: terminal
            ? 'Запись отменена'
            : pending
                ? 'Ожидает подтверждения клиники'
                : 'Запись подтверждена',
        startsAt: DateTime.parse('2026-07-17T06:30:00Z'),
        bucket: terminal
            ? OwnerBookingBucket.history
            : pending
                ? OwnerBookingBucket.requiresAction
                : OwnerBookingBucket.active,
        aggregateVersion: 7,
        canCancel: !terminal,
        canReviewAlternative: false,
        cancelAction: pending
            ? OwnerBookingCancelAction.releaseHold
            : OwnerBookingCancelAction.requestCancellation,
        cancellationReason:
            terminal ? 'Запись уже завершена' : 'Отмена доступна',
        serverNow: now,
        timeline: [
          OwnerBookingTimelineV50(
              code: 'CREATED',
              title: 'Запись создана',
              description: 'Запрос принят сервером',
              occurredAt: now.subtract(const Duration(hours: 2)),
              isCurrent: false),
          OwnerBookingTimelineV50(
              code: terminal
                  ? 'CANCELLED'
                  : pending
                      ? 'PENDING'
                      : 'CONFIRMED',
              title: terminal
                  ? 'Запись отменена'
                  : pending
                      ? 'Ожидает подтверждения'
                      : 'Запись подтверждена',
              description:
                  terminal ? 'Отмена подтверждена' : 'Актуальный статус',
              occurredAt: now,
              isCurrent: true),
        ]);
  }

  @override
  Future<OwnerBookingCancelResultV50> cancel(OwnerBookingDetailV50 detail,
          {required String operationKey,
          required String correlationId}) async =>
      const OwnerBookingCancelResultV50(
          state: 'CANCELLATION_REQUESTED', pending: true);
}
