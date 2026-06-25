import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_page.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';

void main() {
  testWidgets('renders owner appointments without returning a Future from setState', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: OwnerAppointmentsPage(repository: _FakeOwnerAppointmentsRepository()),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('VetHelp Pilot'), findsOneWidget);
    expect(find.textContaining('Барс'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _FakeOwnerAppointmentsRepository implements OwnerAppointmentsRepository {
  @override
  Future<List<OwnerAppointment>> list() async => [
        OwnerAppointment(
          holdId: 'hold-1',
          appointmentId: null,
          state: 'MANUAL_CONFIRM_PENDING',
          startsAt: DateTime.utc(2026, 6, 26, 10),
          endsAt: DateTime.utc(2026, 6, 26, 10, 30),
          clinicName: 'VetHelp Pilot',
          clinicAddress: 'Pilotnaya 1',
          petName: 'Барс',
        ),
      ];
}
