import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/emergency/emergency_page.dart';
import 'package:vethelp_owner_mobile/features/emergency/emergency_repository.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  testWidgets(
    'renders emergency follow-up without infinite-width button constraints',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final repository = EmergencyRepository(
        baseUrl: Uri.parse('http://127.0.0.1:3000'),
        client: MockClient((request) async {
          expect(request.url.path, '/v1/emergency/clinics');

          return http.Response(
            '''
[
  {
    "clinicLocationId": "00000000-0000-4000-8000-000000000001",
    "clinicId": "00000000-0000-4000-8000-000000000002",
    "clinicName": "Emergency VetHelp",
    "address": "Тестовый адрес, 1",
    "latitude": 55.75,
    "longitude": 37.61,
    "emergencyContactPhone": "+79990000000",
    "statusUpdatedAt": "2026-06-27T12:00:00.000Z",
    "validUntil": "2026-06-27T23:00:00.000Z",
    "matchingCapabilities": ["OXYGEN_SUPPORT"],
    "straightLineDistanceKm": 1.2
  }
]
''',
            200,
            headers: const {'content-type': 'application/json'},
          );
        }),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: VetHelpTheme.light(),
          builder: VetHelpTheme.frameBuilder,
          home: EmergencyPage(
            repository: repository,
            triageDecision: const EmergencyTriageDecision(
              sessionId: '00000000-0000-4000-8000-000000000003',
              ruleSetVersion: 'test-v1',
              outcome: 'EMERGENCY',
              requiredCapabilities: ['OXYGEN_SUPPORT'],
              ownerMessage: 'Нужна срочная помощь.',
              selectedSignals: ['BREATHING_DISTRESS'],
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Контроль'), findsOneWidget);

      final control = find.text('Контроль');
      final labelSize = tester.getSize(control);
      expect(labelSize.width, greaterThan(0));
      expect(labelSize.height, greaterThan(0));
      expect(tester.takeException(), isNull);
    },
  );
}
