import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/emergency/emergency_repository.dart';
import 'package:vethelp_owner_mobile/features/emergency/emergency_triage_page.dart';

void main() {
  testWidgets('iOS emergency entry is available without auth', (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        EmergencyTriagePage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeEmergencyRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.text('Найти срочную клинику сейчас'), findsOneWidget);
    expect(find.text('Уточнить, какая помощь нужна'), findsOneWidget);
    expect(find.textContaining('Войти'), findsNothing);
    expect(find.textContaining('Оплат'), findsNothing);
  });

  testWidgets('iOS immediate clinic route does not require triage',
      (tester) async {
    final repository = _FakeEmergencyRepository();

    await tester.pumpWidget(
      _iosHarness(
        EmergencyTriagePage(
          platformOverride: TargetPlatform.iOS,
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Найти срочную клинику сейчас'));
    await tester.pumpAndSettle();

    expect(repository.triageCalls, 0);
    expect(repository.searchCalls, 1);
    expect(repository.lastFilters?.species, 'DOG');
    expect(repository.lastFilters?.requiredCapabilities, ['OXYGEN_SUPPORT']);
    expect(find.text('VetHelp 24'), findsOneWidget);
    expect(find.text('Срочные клиники'), findsOneWidget);
  });

  testWidgets('iOS triage still uses existing API flow', (tester) async {
    final repository = _FakeEmergencyRepository();

    await tester.pumpWidget(
      _iosHarness(
        EmergencyTriagePage(
          platformOverride: TargetPlatform.iOS,
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Уточнить, какая помощь нужна'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Травма'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Травма'));
    await tester.pump();
    await tester.ensureVisible(find.byType(CupertinoSwitch));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(CupertinoSwitch));
    await tester.pump();
    await tester.ensureVisible(find.text('Проверить симптомы'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Проверить симптомы'));
    await tester.pumpAndSettle();

    expect(repository.triageCalls, 1);
    expect(repository.lastTriageSpecies, 'DOG');
    expect(repository.lastTriageSignals, contains('MAJOR_TRAUMA'));
    expect(repository.searchCalls, 1);
    expect(repository.lastFilters?.requiredCapabilities, ['TRAUMA']);
    expect(find.text('VetHelp 24'), findsOneWidget);
  });

  testWidgets('iOS triage API failure keeps clinic route available',
      (tester) async {
    final repository = _FakeEmergencyRepository(failTriage: true);

    await tester.pumpWidget(
      _iosHarness(
        EmergencyTriagePage(
          platformOverride: TargetPlatform.iOS,
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Уточнить, какая помощь нужна'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(CupertinoSwitch));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(CupertinoSwitch));
    await tester.pump();
    await tester.ensureVisible(find.text('Проверить симптомы'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Проверить симптомы'));
    await tester.pumpAndSettle();

    expect(repository.triageCalls, 1);
    expect(
      find.text(
        'Проверка временно недоступна. Можно открыть список срочных клиник сразу.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('TRIAGE_RULE_SET_MISSING'), findsNothing);
    expect(find.textContaining('500'), findsNothing);

    await tester.ensureVisible(find.text('Найти срочную клинику сейчас').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Найти срочную клинику сейчас').last);
    await tester.pumpAndSettle();

    expect(repository.searchCalls, 1);
    expect(find.text('VetHelp 24'), findsOneWidget);
  });

  testWidgets('iOS red flags expose accessible warning semantics',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        EmergencyTriagePage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeEmergencyRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Уточнить, какая помощь нужна'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Тяжёлое дыхание'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Тяжёлое дыхание'));
    await tester.pump();

    expect(
      find.text(
        'Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.',
      ),
      findsOneWidget,
    );
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.label ==
                'Важное предупреждение. Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('iOS emergency path avoids Material-only controls',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        EmergencyTriagePage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeEmergencyRepository(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Уточнить, какая помощь нужна'));
    await tester.pumpAndSettle();

    expect(find.byType(SegmentedButton<String>), findsNothing);
    expect(find.byType(FilterChip), findsNothing);
    expect(find.byType(CheckboxListTile), findsNothing);

    await tester.ensureVisible(find.text('Найти срочную клинику сейчас').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Найти срочную клинику сейчас').last);
    await tester.pumpAndSettle();

    expect(find.byType(SegmentedButton<String>), findsNothing);
    expect(find.byType(FilterChip), findsNothing);
    expect(find.byType(CheckboxListTile), findsNothing);
    expect(
        find.byType(CupertinoSlidingSegmentedControl<String>), findsOneWidget);
  });
}

Widget _iosHarness(Widget child) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, child) {
      return Theme(
        data: ThemeData(useMaterial3: true, platform: TargetPlatform.iOS),
        child: child ?? const SizedBox.shrink(),
      );
    },
    home: child,
  );
}

class _FakeEmergencyRepository extends EmergencyRepository {
  _FakeEmergencyRepository({this.failTriage = false})
      : super(baseUrl: Uri.parse('http://127.0.0.1:3000'));

  final bool failTriage;
  int searchCalls = 0;
  int triageCalls = 0;
  EmergencyClinicFilters? lastFilters;
  String? lastTriageSpecies;
  List<String>? lastTriageSignals;
  bool? lastTriageDisclaimerAccepted;
  EmergencyTriageDraft? draft;

  @override
  Future<List<EmergencyClinic>> search(EmergencyClinicFilters filters) async {
    searchCalls++;
    lastFilters = filters;
    return [
      EmergencyClinic(
        clinicLocationId: 'location-1',
        clinicId: 'clinic-1',
        clinicName: 'VetHelp 24',
        address: 'Москва, Срочная, 1',
        latitude: 55.75,
        longitude: 37.61,
        emergencyContactPhone: '+79990000000',
        statusUpdatedAt: DateTime.utc(2026, 7, 2, 8),
        validUntil: DateTime.utc(2026, 7, 2, 20),
        matchingCapabilities: filters.requiredCapabilities.isEmpty
            ? const ['OXYGEN_SUPPORT']
            : filters.requiredCapabilities,
        straightLineDistanceKm: 2.4,
      ),
    ];
  }

  @override
  Future<EmergencyCachedClinics?> cached(EmergencyClinicFilters filters) async {
    return null;
  }

  @override
  Future<EmergencyTriageDecision> assessTriage({
    required String species,
    required List<String> signalCodes,
    required bool disclaimerAccepted,
  }) async {
    triageCalls++;
    lastTriageSpecies = species;
    lastTriageSignals = signalCodes;
    lastTriageDisclaimerAccepted = disclaimerAccepted;
    if (failTriage) {
      throw const EmergencyApiException(
        500,
        'TRIAGE_RULE_SET_MISSING',
      );
    }
    return EmergencyTriageDecision(
      sessionId: 'triage-1',
      ruleSetVersion: 'test-v1',
      outcome: signalCodes.contains('BREATHING_DISTRESS')
          ? 'EMERGENCY'
          : 'SAME_DAY_CLINIC',
      requiredCapabilities:
          signalCodes.contains('MAJOR_TRAUMA') ? const ['TRAUMA'] : const [],
      ownerMessage: 'Лучше обратиться в клинику сегодня.',
      selectedSignals: signalCodes,
    );
  }

  @override
  Future<EmergencyTriageDraft?> readTriageDraft() async => draft;

  @override
  Future<void> saveTriageDraft({
    required String species,
    required List<String> signalCodes,
    required bool disclaimerAccepted,
  }) async {
    draft = EmergencyTriageDraft(
      species: species,
      signalCodes: signalCodes,
      disclaimerAccepted: disclaimerAccepted,
      updatedAt: DateTime.utc(2026, 7, 2),
    );
  }

  @override
  Future<void> clearTriageDraft() async {
    draft = null;
  }

  @override
  Future<EmergencyRouteActionResult> recordRouteAction({
    required String clinicLocationId,
    required String action,
    String? triageSessionId,
  }) async {
    return EmergencyRouteActionResult(
      actionId: 'action-1',
      action: action,
      clinicLocationId: clinicLocationId,
      triageSessionId: triageSessionId,
      followUpDueAt: DateTime.utc(2026, 7, 2, 21),
      createdAt: DateTime.utc(2026, 7, 2, 20),
    );
  }
}
