import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_home_models.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_home_repository.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_home_v50_page.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_selected_pet_preference.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  testWidgets('loading skeleton follows Home geometry', (tester) async {
    final pending = Completer<OwnerHomeSnapshot>();
    await _pumpHome(tester, repository: _FakeRepository((_) => pending.future));
    expect(find.byKey(const ValueKey('owner-home-skeleton')), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets(
      'ready state renders one safe action, active care and service routes',
      (tester) async {
    final calls = <String>[];
    await _pumpHome(
      tester,
      repository: _FakeRepository((_) async => _snapshot()),
      calls: calls,
    );
    await tester.pumpAndSettle();

    expect(find.text('Луна'), findsWidgets);
    expect(find.text('Клиника предложила другое время'), findsNWidgets(3));
    expect(
        find.byKey(const ValueKey('owner-home-next-action')), findsOneWidget);
    expect(
        find.byKey(const ValueKey('owner-home-active-care')), findsOneWidget);
    expect(find.byKey(const ValueKey('owner-home-emergency')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('owner-home-primary-action')));
    expect(calls, contains('appointments'));
    tester
        .widget<InkWell>(find.byKey(const ValueKey('owner-home-emergency')))
        .onTap!();
    expect(calls, contains('emergency'));
    tester
        .widget<InkWell>(
          find
              .ancestor(
                of: find.text('Онлайн-помощь'),
                matching: find.byType(InkWell),
              )
              .first,
        )
        .onTap!();
    expect(calls, contains('telemed'));
  });

  testWidgets(
      'pet switch reloads authoritative snapshot and persists selection',
      (tester) async {
    final preference = _MemoryPreference('pet-1');
    final repository =
        _FakeRepository((id) async => _snapshot(selectedId: id ?? 'pet-1'));
    await _pumpHome(tester, repository: repository, preference: preference);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('owner-home-pet-switcher')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Марс').last);
    await tester.pumpAndSettle();

    expect(repository.requestedIds, ['pet-1', 'pet-2']);
    expect(preference.value, 'pet-2');
    expect(find.text('Марс'), findsWidgets);
  });

  testWidgets('invalid persisted pet is cleared against authoritative pets',
      (tester) async {
    final preference = _MemoryPreference('deleted-pet');
    final repository = _FakeRepository((_) async => _snapshot());
    await _pumpHome(tester, repository: repository, preference: preference);
    await tester.pumpAndSettle();
    expect(preference.clearCount, 1);
    expect(preference.value, 'pet-1');
  });

  testWidgets('no-pet state uses exact copy and always keeps emergency',
      (tester) async {
    final calls = <String>[];
    await _pumpHome(
      tester,
      repository: _FakeRepository((_) async => _snapshot(noPets: true)),
      calls: calls,
    );
    await tester.pumpAndSettle();
    expect(find.text('Добавьте питомца'), findsOneWidget);
    expect(
      find.text(
        'Так мы сможем подобрать подходящую клинику,\nсохранить записи и собрать историю помощи.',
      ),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('owner-home-emergency')), findsOneWidget);
    await tester.tap(find.text('Добавить питомца'));
    expect(calls, contains('pets'));
  });

  testWidgets('unknown action is non-crashing exact appointments fallback',
      (tester) async {
    final calls = <String>[];
    await _pumpHome(
      tester,
      repository: _FakeRepository((_) async => _snapshot(unknownAction: true)),
      calls: calls,
    );
    await tester.pumpAndSettle();
    expect(find.text(OwnerHomeAction.fallbackTitle), findsOneWidget);
    expect(find.text(OwnerHomeAction.fallbackDescription), findsOneWidget);
    await tester.tap(find.text('Открыть записи'));
    expect(calls, contains('appointments'));
  });

  testWidgets('retry retains last snapshot and marks it offline/stale',
      (tester) async {
    final calls = <String>[];
    var request = 0;
    final repository = _FakeRepository((_) async {
      request++;
      if (request == 1) return _snapshot();
      throw const OwnerHomeException(kind: OwnerHomeErrorKind.offline);
    });
    await _pumpHome(tester, repository: repository, calls: calls);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('owner-home-pet-switcher')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Марс').last);
    await tester.pumpAndSettle();
    expect(find.text('Луна'), findsWidgets);
    expect(find.byKey(const ValueKey('owner-home-stale')), findsOneWidget);
    expect(find.textContaining('Нет подключения'), findsOneWidget);
    expect(find.text('Клиника предложила другое время'), findsNothing);
    expect(find.byKey(const ValueKey('owner-home-next-action')), findsNothing);
    expect(find.byKey(const ValueKey('owner-home-active-care')), findsNothing);
    expect(find.byKey(const ValueKey('owner-home-stale-care')), findsOneWidget);
    expect(
      tester
          .widget<InkWell>(
            find
                .ancestor(
                  of: find.text('Онлайн-помощь недоступна'),
                  matching: find.byType(InkWell),
                )
                .first,
          )
          .onTap,
      isNull,
    );
    expect(
      tester
          .widget<InkWell>(
            find
                .ancestor(
                  of: find.text('Страхование недоступно'),
                  matching: find.byType(InkWell),
                )
                .first,
          )
          .onTap,
      isNull,
    );
    tester
        .widget<InkWell>(
          find
              .ancestor(
                of: find.text('Посмотреть клиники'),
                matching: find.byType(InkWell),
              )
              .first,
        )
        .onTap!();
    tester
        .widget<InkWell>(
          find
              .ancestor(
                of: find.text('Открыть дневник'),
                matching: find.byType(InkWell),
              )
              .first,
        )
        .onTap!();
    tester
        .widget<InkWell>(find.byKey(const ValueKey('owner-home-emergency')))
        .onTap!();
    expect(calls, containsAll(['catalog', 'care', 'emergency']));
    expect(calls, isNot(contains('telemed')));
    expect(calls, isNot(contains('insurance')));
  });

  testWidgets('only owner or session generation change invalidates snapshot',
      (tester) async {
    final first = _FakeRepository((_) async => _snapshot());
    await _pumpHome(
      tester,
      repository: first,
      ownerId: 'owner-1',
      sessionGeneration: 0,
    );
    await tester.pumpAndSettle();
    expect(find.text('Луна'), findsWidgets);

    final secondPending = Completer<OwnerHomeSnapshot>();
    final second = _FakeRepository((_) => secondPending.future);
    await _pumpHome(
      tester,
      repository: second,
      ownerId: 'owner-1',
      sessionGeneration: 0,
    );
    await tester.pump();
    expect(find.text('Луна'), findsWidgets);
    expect(second.requestedIds, isEmpty);

    await _pumpHome(
      tester,
      repository: second,
      ownerId: 'owner-1',
      sessionGeneration: 1,
    );
    await tester.pump();
    expect(find.text('Луна'), findsNothing);
    expect(find.byKey(const ValueKey('owner-home-skeleton')), findsOneWidget);
    expect(second.requestedIds, hasLength(1));
    secondPending.complete(_snapshot(selectedId: 'pet-2'));
    await tester.pumpAndSettle();
    expect(find.text('Марс'), findsWidgets);

    final thirdPending = Completer<OwnerHomeSnapshot>();
    final third = _FakeRepository((_) => thirdPending.future);
    await _pumpHome(
      tester,
      repository: third,
      ownerId: 'owner-2',
      sessionGeneration: 1,
    );
    await tester.pump();
    expect(find.text('Марс'), findsNothing);
    expect(third.requestedIds, hasLength(1));
    thirdPending.complete(_snapshot());
    await tester.pumpAndSettle();
    expect(find.text('Луна'), findsWidgets);
  });

  testWidgets('session expiry clears prior snapshot, preference and callbacks',
      (tester) async {
    var request = 0;
    var expired = 0;
    final preference = _MemoryPreference('pet-1');
    final repository = _FakeRepository((_) async {
      request++;
      if (request == 1) return _snapshot();
      throw const OwnerHomeException(kind: OwnerHomeErrorKind.sessionExpired);
    });
    await _pumpHome(
      tester,
      repository: repository,
      preference: preference,
      onSessionExpired: () => expired++,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('owner-home-pet-switcher')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Марс').last);
    await tester.pumpAndSettle();

    expect(expired, 1);
    expect(preference.value, isNull);
    expect(preference.clearCount, 1);
    expect(find.text('Луна'), findsNothing);
    expect(find.text('Сессия завершена'), findsOneWidget);
    expect(
        find.byKey(const ValueKey('owner-home-primary-action')), findsNothing);
    expect(find.byKey(const ValueKey('owner-home-emergency')), findsOneWidget);

    final authenticatedRepository =
        _FakeRepository((_) async => _snapshot(selectedId: 'pet-2'));
    await _pumpHome(
      tester,
      repository: authenticatedRepository,
      preference: preference,
      sessionGeneration: 1,
      onSessionExpired: () => expired++,
    );
    await tester.pumpAndSettle();
    expect(authenticatedRepository.requestedIds, hasLength(1));
    expect(find.text('Сессия завершена'), findsNothing);
    expect(find.text('Марс'), findsWidgets);
    expect(expired, 1);
  });

  testWidgets('375 width and large text have finite layout', (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await _pumpHome(
      tester,
      repository: _FakeRepository((_) async => _snapshot()),
      textScaler: const TextScaler.linear(2),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byKey(const ValueKey('owner-home-emergency')), findsOneWidget);
  });

  testWidgets('Home state survives V50 tab switch without another read',
      (tester) async {
    final repository = _FakeRepository((_) async => _snapshot());
    await tester.pumpWidget(
      MaterialApp(
        theme: VetHelpTheme.light(),
        home: _ShellHarness(repository: repository),
      ),
    );
    await tester.pumpAndSettle();
    expect(repository.requestedIds, hasLength(1));
    await tester.tap(find.text('Клиники').last);
    await tester.pumpAndSettle();
    expect(find.text('Clinic destination'), findsOneWidget);
    await tester.tap(find.text('Главная').last);
    await tester.pumpAndSettle();
    expect(find.text('Луна'), findsWidgets);
    expect(repository.requestedIds, hasLength(1));
  });
}

class _ShellHarness extends StatefulWidget {
  const _ShellHarness({required this.repository});
  final OwnerHomeRepository repository;

  @override
  State<_ShellHarness> createState() => _ShellHarnessState();
}

class _ShellHarnessState extends State<_ShellHarness> {
  int index = 0;

  @override
  Widget build(BuildContext context) => OwnerV50AdaptiveShell(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        onEmergency: () {},
        home: OwnerHomeV50Page(
          repository: widget.repository,
          preference: _MemoryPreference(),
          ownerId: 'owner-1',
          sessionGeneration: 0,
          onPetSelected: (_) {},
          onManagePets: () {},
          onBrowseClinics: () {},
          onOpenAppointments: () {},
          onOpenCare: () {},
          onRequestTelemed: () {},
          onRequestInsurance: () {},
          onRequestEmergency: () {},
          onSessionExpired: () {},
        ),
        clinics: const Center(child: Text('Clinic destination')),
        appointments: const Center(child: Text('Appointments destination')),
        pets: const Center(child: Text('Pets destination')),
      );
}

Future<void> _pumpHome(
  WidgetTester tester, {
  required OwnerHomeRepository repository,
  OwnerSelectedPetPreference? preference,
  List<String>? calls,
  String ownerId = 'owner-1',
  int sessionGeneration = 0,
  VoidCallback? onSessionExpired,
  TextScaler textScaler = TextScaler.noScaling,
}) async {
  final routeCalls = calls ?? <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: VetHelpTheme.light(),
      home: MediaQuery(
        data: MediaQueryData(textScaler: textScaler),
        child: Scaffold(
          body: OwnerHomeV50Page(
            repository: repository,
            preference: preference ?? _MemoryPreference(),
            ownerId: ownerId,
            sessionGeneration: sessionGeneration,
            onPetSelected: (_) {},
            onManagePets: () => routeCalls.add('pets'),
            onBrowseClinics: () => routeCalls.add('catalog'),
            onOpenAppointments: () => routeCalls.add('appointments'),
            onOpenCare: () => routeCalls.add('care'),
            onRequestTelemed: () => routeCalls.add('telemed'),
            onRequestInsurance: () => routeCalls.add('insurance'),
            onRequestEmergency: () => routeCalls.add('emergency'),
            onSessionExpired: onSessionExpired ?? () {},
          ),
        ),
      ),
    ),
  );
}

class _FakeRepository implements OwnerHomeRepository {
  _FakeRepository(this.handler);
  final Future<OwnerHomeSnapshot> Function(String? selectedPetId) handler;
  final requestedIds = <String?>[];

  @override
  Future<OwnerHomeSnapshot> read({String? selectedPetId}) {
    requestedIds.add(selectedPetId);
    return handler(selectedPetId);
  }
}

class _MemoryPreference implements OwnerSelectedPetPreference {
  _MemoryPreference([this.value]);
  String? value;
  int clearCount = 0;

  @override
  Future<void> clear(String ownerId) async {
    clearCount++;
    value = null;
  }

  @override
  Future<String?> read(String ownerId) async => value;

  @override
  Future<void> write(String ownerId, String petId) async => value = petId;
}

OwnerHomeSnapshot _snapshot({
  String selectedId = 'pet-1',
  bool noPets = false,
  bool unknownAction = false,
}) {
  final pets = noPets
      ? const <OwnerHomePet>[]
      : const [
          OwnerHomePet(
              id: 'pet-1', name: 'Луна', species: 'DOG', breed: 'Корги'),
          OwnerHomePet(id: 'pet-2', name: 'Марс', species: 'CAT'),
        ];
  final selected =
      noPets ? null : pets.firstWhere((pet) => pet.id == selectedId);
  return OwnerHomeSnapshot(
    schemaVersion: 1,
    serverNow: DateTime.parse('2026-07-14T18:00:00Z'),
    pets: pets,
    selectedPet: selected,
    selectionSource: noPets ? 'NONE' : 'REQUESTED',
    nextAction: unknownAction
        ? OwnerHomeAction.fallback()
        : OwnerHomeAction(
            type: noPets ? 'NONE' : 'ALTERNATIVE_SLOT_RESPONSE',
            priority: noPets ? 'LOW' : 'HIGH',
            sourceType: noPets ? 'NONE' : 'BOOKING_HOLD',
            sourceId: noPets ? null : 'hold-1',
            title:
                noPets ? 'Добавьте питомца' : 'Клиника предложила другое время',
            description:
                noPets ? 'Создайте профиль питомца' : 'Ответьте до 19:30',
            deadlineAt: null,
            actionCode: noPets ? 'ADD_PET' : 'OPEN_ALTERNATIVE_SLOT',
          ),
    activeCare: noPets
        ? null
        : const OwnerHomeActiveCare(
            sourceType: 'BOOKING_HOLD',
            sourceId: 'hold-1',
            statusCode: 'ALTERNATIVE_PROPOSED',
            title: 'Клиника предложила другое время',
            description: 'Нужно выбрать подходящий вариант',
            startsAt: null,
            deadlineAt: null,
            clinicName: 'ВетКлиника',
            petId: 'pet-1',
            actionCode: 'OPEN_ALTERNATIVE_SLOT',
          ),
  );
}
