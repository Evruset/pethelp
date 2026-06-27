import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';

void main() {
  test('parses public catalog locations and availability snapshot', () async {
    final repository = HttpPublicCatalogRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      client: MockClient((request) async {
        expect(request.url.path, '/v1/catalog/clinic-locations');
        expect(request.url.queryParameters['q'], 'Pilot');
        return http.Response(
            '''
          {
            "observedAt":"2026-06-25T12:00:00.000Z",
            "locations":[{
              "clinic":{"id":"clinic-1","name":"VetHelp Pilot"},
              "location":{"id":"location-1","address":"Pilotnaya 1","phone":"+7 495 000-00-00"},
              "availability":{"mode":"READ_ONLY_SNAPSHOT","hasOpenSlots":true,"observedAt":"2026-06-25T12:00:00.000Z"}
            }]
          }
        ''',
            200,
            headers: const {'content-type': 'application/json'});
      }),
    );

    final locations = await repository.listLocations(query: ' Pilot ');

    expect(locations, hasLength(1));
    expect(locations.single.clinicName, 'VetHelp Pilot');
    expect(locations.single.locationId, 'location-1');
    expect(locations.single.hasOpenSlots, isTrue);
  });

  test('parses public clinics, detail, services and availability', () async {
    final repository = HttpPublicCatalogRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      client: MockClient((request) async {
        switch (request.url.path) {
          case '/v1/clinics':
            expect(request.url.queryParameters['q'], 'Pilot');
            return http.Response(
                '''
              {
                "observedAt":"2026-06-25T12:00:00.000Z",
                "clinics":[{
                  "id":"clinic-1",
                  "name":"VetHelp Pilot",
                  "locationCount":1,
                  "serviceCount":2,
                  "nextAvailableAt":"2026-06-25T15:00:00.000Z"
                }]
              }
            ''',
                200,
                headers: const {'content-type': 'application/json'});
          case '/v1/clinics/clinic-1':
            return http.Response(
                '''
              {
                "id":"clinic-1",
                "name":"VetHelp Pilot",
                "locationCount":1,
                "serviceCount":2,
                "nextAvailableAt":"2026-06-25T15:00:00.000Z",
                "locations":[{
                  "clinic":{"id":"clinic-1","name":"VetHelp Pilot"},
                  "location":{"id":"location-1","address":"Pilotnaya 1","phone":"+7 495 000-00-00"},
                  "availability":{"mode":"READ_ONLY_SNAPSHOT","hasOpenSlots":true,"observedAt":"2026-06-25T12:00:00.000Z"}
                }]
              }
            ''',
                200,
                headers: const {'content-type': 'application/json'});
          case '/v1/clinic-locations/location-1/services':
            return http.Response(
                '''
              {
                "locationId":"location-1",
                "services":[{
                  "id":"service-1",
                  "code":"VISIT",
                  "displayName":"Первичный приём",
                  "durationMinutes":30,
                  "priceAmount":"1500.00",
                  "currency":"RUB"
                }]
              }
            ''',
                200,
                headers: const {'content-type': 'application/json'});
          case '/v1/clinic-locations/location-1/availability':
            return http.Response(
                '''
              {
                "locationId":"location-1",
                "observedAt":"2026-06-25T12:00:00.000Z",
                "slots":[{
                  "id":"slot-1",
                  "startsAt":"2026-06-25T15:00:00.000Z",
                  "endsAt":"2026-06-25T15:30:00.000Z",
                  "remainingCapacity":1,
                  "service":{"id":"service-1","name":"Первичный приём"}
                }]
              }
            ''',
                200,
                headers: const {'content-type': 'application/json'});
        }
        return http.Response('{"code":"NOT_FOUND"}', 404);
      }),
    );

    final clinics = await repository.listClinics(query: ' Pilot ');
    final detail = await repository.readClinic('clinic-1');
    final services = await repository.listLocationServices('location-1');
    final availability = await repository.readAvailability(
      locationId: 'location-1',
      from: DateTime.utc(2026, 6, 25),
      to: DateTime.utc(2026, 6, 26),
    );

    expect(clinics.single.name, 'VetHelp Pilot');
    expect(clinics.single.nextAvailableAt, isNotNull);
    expect(detail.locations.single.locationId, 'location-1');
    expect(services.single.displayName, 'Первичный приём');
    expect(availability.single.serviceName, 'Первичный приём');
  });

  test('sends clinic catalog filters to backend', () async {
    final repository = HttpPublicCatalogRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      client: MockClient((request) async {
        expect(request.url.path, '/v1/clinics');
        expect(request.url.queryParameters['q'], 'Pilot');
        expect(request.url.queryParameters['serviceCode'], 'GENERAL_VISIT');
        expect(request.url.queryParameters['latitude'], '55.7558');
        expect(request.url.queryParameters['longitude'], '37.6173');
        expect(request.url.queryParameters['radiusKm'], '12.5');
        expect(request.url.queryParameters['openNow'], 'true');
        expect(request.url.queryParameters['telemedAvailable'], 'true');
        expect(request.url.queryParameters['emergencyCapability'], 'TRAUMA');
        expect(request.url.queryParameters['sort'], 'distance');
        expect(request.url.queryParameters['availableFrom'],
            '2026-06-25T00:00:00.000Z');
        expect(request.url.queryParameters['availableTo'],
            '2026-06-26T00:00:00.000Z');
        return http.Response(
            '{"observedAt":"2026-06-25T12:00:00.000Z","clinics":[]}', 200,
            headers: const {'content-type': 'application/json'});
      }),
    );

    final clinics = await repository.listClinics(
      filters: CatalogClinicFilters(
        query: ' Pilot ',
        serviceCode: 'GENERAL_VISIT',
        latitude: 55.7558,
        longitude: 37.6173,
        radiusKm: 12.5,
        availableFrom: DateTime.utc(2026, 6, 25),
        availableTo: DateTime.utc(2026, 6, 26),
        openNow: true,
        telemedAvailable: true,
        emergencyCapability: 'TRAUMA',
        sort: 'distance',
      ),
    );

    expect(clinics, isEmpty);
  });
}
