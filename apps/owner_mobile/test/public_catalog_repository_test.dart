import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';

void main() {
  test('parses public catalog locations and availability snapshot', () async {
    final repository = HttpPublicCatalogRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      client: MockClient((request) async {
        expect(request.url.path, '/v1/catalog/clinic-locations');
        expect(request.url.queryParameters['q'], 'Pilot');
        return http.Response('''
          {
            "observedAt":"2026-06-25T12:00:00.000Z",
            "locations":[{
              "clinic":{"id":"clinic-1","name":"VetHelp Pilot"},
              "location":{"id":"location-1","address":"Pilotnaya 1","phone":"+7 495 000-00-00"},
              "availability":{"mode":"READ_ONLY_SNAPSHOT","hasOpenSlots":true,"observedAt":"2026-06-25T12:00:00.000Z"}
            }]
          }
        ''', 200, headers: const {'content-type': 'application/json'});
      }),
    );

    final locations = await repository.listLocations(query: ' Pilot ');

    expect(locations, hasLength(1));
    expect(locations.single.clinicName, 'VetHelp Pilot');
    expect(locations.single.locationId, 'location-1');
    expect(locations.single.hasOpenSlots, isTrue);
  });
}
