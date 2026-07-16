import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_selection_models.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_selection_repository.dart';

void main() {
  test('parses only server-authored booking selection fields', () async {
    late Uri requested;
    late Map<String, String> headers;
    final repository = HttpBookingSelectionRepository(
      baseUrl: Uri.parse('https://api.example.test'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        requested = request.url;
        headers = request.headers;
        return http.Response(_body, 200,
            headers: {'content-type': 'application/json'});
      }),
    );

    final snapshot = await repository.readOptions(
      locationId: 'location-1',
      doctorId: 'doctor-1',
      selectedPetId: 'pet-1',
    );

    expect(requested.path, '/v1/clinic-locations/location-1/booking-options');
    expect(requested.queryParameters, {
      'doctorId': 'doctor-1',
      'selectedPetId': 'pet-1',
      'limit': '50',
    });
    expect(headers['authorization'], 'Bearer owner-token');
    expect(snapshot.timezone, 'Europe/Moscow');
    expect(snapshot.availableDates, ['2026-07-17']);
    expect(snapshot.slots.single.localTime, '09:30');
    expect(snapshot.slots.single.expectedVersion, 7);
    expect(snapshot.slots.single.availability,
        BookingSlotAvailability.requestOnly);
    expect(snapshot.personalizationApplied, isTrue);
  });
}

const _body = '''
{
  "location":{"id":"location-1","clinicId":"clinic-1","clinicName":"VetHelp","address":"Москва","timezone":"Europe/Moscow"},
  "window":{"serverNow":"2026-07-16T08:00:00.000Z","availableDates":["2026-07-17"],"freshness":"CURRENT"},
  "personalization":{"applied":true,"compatibility":"NOT_EVALUATED"},
  "services":[{"id":"service-1","code":"GENERAL_VISIT","displayName":"Приём","durationMinutes":30,"price":{"amount":"2500.00","currency":"RUB","additionalCostsPossible":true,"finalPriceStatus":"CLINIC_AGREEMENT_REQUIRED"}}],
  "slots":[{"id":"slot-1","serviceId":"service-1","startsAt":"2026-07-17T06:30:00.000Z","endsAt":"2026-07-17T07:00:00.000Z","localDate":"2026-07-17","localTime":"09:30","timezone":"Europe/Moscow","availabilityState":"REQUEST_ONLY","expectedVersion":7,"freshness":"CURRENT","confirmationMode":"ALTERNATIVE_POSSIBLE","sourceUpdatedAt":"2026-07-16T07:55:00.000Z","priceReference":"service:service-1"}]
}
''';
