import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_page.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';

void main() {
  testWidgets('renders active appointments from backend presentation',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: OwnerAppointmentsPage(repository: _FakeOwnerAppointmentsRepository()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('VetHelp Pilot'), findsOneWidget);
    expect(find.textContaining('Барс'), findsOneWidget);
    expect(find.text('Ожидаем подтверждения'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('history shows server-owned past-visit wording', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: OwnerAppointmentsPage(
          repository: _FakeOwnerAppointmentsRepository(historyOnly: true)),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Время визита прошло'), findsOneWidget);
    expect(find.text('Обновляется'), findsNothing);
    expect(find.text('Визит состоялся'), findsNothing);
  });
}

class _FakeOwnerAppointmentsRepository implements OwnerAppointmentsRepository {
  _FakeOwnerAppointmentsRepository({this.historyOnly = false});
  final bool historyOnly;

  static const _activePresentation = OwnerAppointmentPresentation(
    code: 'WAITING_FOR_CLINIC',
    label: 'Ожидаем подтверждения',
    description: 'Клиника проверяет возможность записи.',
    tone: 'info',
  );

  static const _historyPresentation = OwnerAppointmentPresentation(
    code: 'VISIT_TIME_PASSED',
    label: 'Время визита прошло',
    description: 'Клиника пока не передала отметку о фактическом визите.',
    tone: 'neutral',
  );

  @override
  Future<List<OwnerAppointment>> list() async => [
        OwnerAppointment(
          holdId: '11111111-1111-4111-8111-111111111111',
          appointmentId: null,
          state: historyOnly ? 'CONFIRMED' : 'MANUAL_CONFIRM_PENDING',
          bucket: historyOnly ? 'HISTORY' : 'ACTIVE',
          presentation: historyOnly ? _historyPresentation : _activePresentation,
          startsAt: DateTime.utc(2026, 6, 26, 10),
          endsAt: DateTime.utc(2026, 6, 26, 10, 30),
          clinicName: 'VetHelp Pilot',
          clinicAddress: 'Pilotnaya 1',
          petName: 'Барс',
        ),
      ];

  @override
  Future<OwnerAppointmentDetail> readDetail(String holdId) async =>
      OwnerAppointmentDetail(
        holdId: holdId,
        appointmentId: null,
        state: 'MANUAL_CONFIRM_PENDING',
        bucket: 'ACTIVE',
        presentation: _activePresentation,
        version: 1,
        startsAt: DateTime.utc(2026, 6, 26, 10),
        endsAt: DateTime.utc(2026, 6, 26, 10, 30),
        expiresAt: DateTime.utc(2026, 6, 25, 20),
        latestStatusUpdateAt: DateTime.utc(2026, 6, 25, 19),
        serverNow: DateTime.utc(2026, 6, 25, 19, 5),
        clinicName: 'VetHelp Pilot',
        clinicAddress: 'Pilotnaya 1',
        locationPhone: null,
        petName: 'Барс',
        petSpecies: 'CAT',
        serviceName: 'Первичный приём',
        priceAmount: '1000.00',
        currency: 'RUB',
        timeline: [
          OwnerAppointmentTimelineItem(
            at: DateTime.utc(2026, 6, 25, 19),
            type: 'booking.hold.created',
            label: 'Заявка создана',
          ),
        ],
        actions: const OwnerAppointmentActions(
          canRefresh: true,
          canRebook: true,
          canOpenRoute: false,
          canReviewAlternative: false,
          canCancel: true,
        ),
      );

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async =>
      BookingHoldSnapshot(
        holdId: holdId,
        slotId: 'slot-1',
        state: 'MANUAL_CONFIRM_PENDING',
        expiresAt: DateTime.utc(2026, 6, 25, 20),
        startsAt: DateTime.utc(2026, 6, 26, 10),
        endsAt: DateTime.utc(2026, 6, 26, 10, 30),
      );

  @override
  Future<ReleasedBookingHold> releaseHold(String holdId) async =>
      ReleasedBookingHold(
        holdId: holdId,
        state: 'RELEASED',
        slotId: 'slot-1',
        correlationId: '11111111-1111-4111-8111-111111111112',
      );
}
