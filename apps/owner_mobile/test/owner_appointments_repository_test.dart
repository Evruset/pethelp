import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';

void main() {
  test('loads the current owner appointment history with bearer token', () async {
    final repository = HttpOwnerAppointmentsRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      accessToken: () async => 'owner-token',
      client: MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.path, '/v1/owner/appointments');
        expect(request.headers['authorization'], 'Bearer owner-token');
        return http.Response('''
          [{
            "holdId":"11111111-1111-4111-8111-111111111111",
            "appointmentId":null,
            "state":"MANUAL_CONFIRM_PENDING",
            "startsAt":"2026-06-26T10:00:00.000Z",
            "endsAt":"2026-06-26T10:30:00.000Z",
            "clinic":{"id":"clinic-1","name":"VetHelp Pilot","address":"Pilotnaya 1"},
            "pet":{"id":"pet-1","name":"Барс","species":"CAT"}
          }]
        ''', 200, headers: const {'content-type': 'application/json'});
      }),
    );

    final appointments = await repository.list();

    expect(appointments, hasLength(1));
    expect(appointments.single.state, 'MANUAL_CONFIRM_PENDING');
    expect(appointments.single.clinicName, 'VetHelp Pilot');
    expect(appointments.single.petName, 'Барс');
  });
}
