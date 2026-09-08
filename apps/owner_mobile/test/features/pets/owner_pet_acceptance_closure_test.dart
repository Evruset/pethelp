import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_diary_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_deep_link.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_files.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_profile_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_page.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';

void main() {
  group('profile mandatory states', () {
    testWidgets(
        'validation error is field-specific, hides raw code, preserves draft and retries',
        (tester) async {
      final repository = _PetRepository(
        pets: [_pet],
        updateErrors: [
          const OwnerPetApiException(400, 'INVALID_PET_NAME'),
        ],
      );
      await tester.pumpWidget(MaterialApp(
        home: Builder(builder: (context) {
          return FilledButton(
            onPressed: () => showOwnerPetEditorBottomSheet(
              context: context,
              repository: repository,
              pet: _pet,
            ),
            child: const Text('Открыть'),
          );
        }),
      ));
      await tester.tap(find.text('Открыть'));
      await tester.pumpAndSettle();
      final name = find.byKey(const ValueKey('owner-pet-name-field'));
      await tester.enterText(name, 'Барсик черновик');
      final save = find.widgetWithText(FilledButton, 'Сохранить');
      await tester.ensureVisible(save);
      await tester.tap(save);
      await tester.pumpAndSettle();

      expect(find.text('Введите корректное имя питомца'), findsOneWidget);
      expect(find.textContaining('INVALID_PET_NAME'), findsNothing);
      expect((tester.widget<TextFormField>(name).controller?.text),
          'Барсик черновик');

      await tester.enterText(name, 'Барсик исправлен');
      await tester.ensureVisible(save);
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(repository.updateCalls, 2);
      expect(find.byKey(const ValueKey('owner-pet-name-field')), findsNothing);
    });

    testWidgets('archived profile is explicit and edit mutation is disabled',
        (tester) async {
      final archived = _copyPet(_pet, archived: true);
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetProfileV50Page(
          pet: archived,
          repository: _PetRepository(pets: [archived]),
          onPetChanged: (_) {},
          onOpenDiary: () {},
          onArchiveResolved: (_) {},
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('profile-archived-banner')),
          findsOneWidget);
      final edit = tester.widget<OutlinedButton>(
          find.byKey(const ValueKey('profile-edit-action')));
      expect(edit.onPressed, isNull);
      expect(find.text('Вернуть из архива'), findsOneWidget);
    });

    testWidgets('not found and session expired disclose no cached profile',
        (tester) async {
      for (final status in [404, 401]) {
        final link = OwnerPetDeepLink.tryParse('/owner/pets/foreign-pet')!;
        final pets = _PetRepository(
          pets: const [],
          readError: OwnerPetApiException(
            status,
            status == 404 ? 'OWNER_PET_NOT_FOUND' : 'UNAUTHENTICATED',
          ),
        );
        await tester.pumpWidget(MaterialApp(
          home: OwnerPetDeepLinkDestination(
            link: link,
            resolver: OwnerPetDeepLinkResolver(
              pets: pets,
              diary: _DiaryRepository(),
            ),
            sessionGeneration: status,
            petRepository: pets,
            diaryRepository: _DiaryRepository(),
            onPetChanged: (_) {},
            onArchiveResolved: (_) {},
          ),
        ));
        await tester.pumpAndSettle();
        expect(find.text(_pet.name), findsNothing);
        expect(
          find.byKey(ValueKey(status == 404
              ? 'owner-pet-deep-link-not-found'
              : 'owner-pet-deep-link-session-expired')),
          findsOneWidget,
        );
      }
    });

    testWidgets('offline profile uses safe snapshot and blocks mutation',
        (tester) async {
      final pets = _PetRepository(
        pets: const [],
        readError: const OwnerPetApiException(503, 'OFFLINE'),
      );
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetDeepLinkDestination(
          link: OwnerPetDeepLink.tryParse('/owner/pets/${_pet.id}')!,
          resolver: OwnerPetDeepLinkResolver(
            pets: pets,
            diary: _DiaryRepository(),
          ),
          sessionGeneration: 1,
          petRepository: pets,
          diaryRepository: _DiaryRepository(),
          safeSnapshot: _pet,
          onPetChanged: (_) {},
          onArchiveResolved: (_) {},
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text(_pet.name), findsWidgets);
      expect(
          find.textContaining('последний безопасный снимок'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
                find.byKey(const ValueKey('profile-edit-action')))
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<OutlinedButton>(
                find.byKey(const ValueKey('profile-archive-action')))
            .onPressed,
        isNull,
      );
    });
  });

  group('deep-link ownership and session matrix', () {
    test('parses profile, diary and document routes only', () {
      expect(OwnerPetDeepLink.tryParse('/owner/pets/pet-1')?.kind,
          OwnerPetDeepLinkKind.profile);
      expect(OwnerPetDeepLink.tryParse('/pets/pet-1/diary')?.kind,
          OwnerPetDeepLinkKind.diary);
      expect(
          OwnerPetDeepLink.tryParse('/owner/pets/pet-1/documents/doc-1')
              ?.documentId,
          'doc-1');
      expect(OwnerPetDeepLink.tryParse('/owner/pets'), isNull);
      expect(OwnerPetDeepLink.tryParse('/owner/pets/pet-1/unknown'), isNull);
    });

    test('own and archived pet routes resolve through owner repository',
        () async {
      final archived = _copyPet(_pet, archived: true);
      final pets = _PetRepository(pets: [archived]);
      final resolver =
          OwnerPetDeepLinkResolver(pets: pets, diary: _DiaryRepository());
      for (final path in [
        '/owner/pets/${_pet.id}',
        '/owner/pets/${_pet.id}/diary',
      ]) {
        final result = await resolver.resolve(OwnerPetDeepLink.tryParse(path)!);
        expect(result.status, OwnerPetDeepLinkStatus.resolved);
        expect(result.pet?.isArchived, isTrue);
      }
      expect(pets.readIds, [_pet.id, _pet.id]);
    });

    test('foreign and unknown pets normalize to identical no-leak result',
        () async {
      for (final id in ['foreign-pet', 'unknown-pet']) {
        final pets = _PetRepository(
          pets: const [],
          readError: const OwnerPetApiException(404, 'OWNER_PET_NOT_FOUND'),
        );
        final result = await OwnerPetDeepLinkResolver(
          pets: pets,
          diary: _DiaryRepository(),
        ).resolve(OwnerPetDeepLink.tryParse('/owner/pets/$id/diary')!);
        expect(result.status, OwnerPetDeepLinkStatus.notFound);
        expect(result.pet, isNull);
        expect(result.documentEvent, isNull);
        expect(pets.readIds, [id]);
      }
    });

    testWidgets(
        'session A logout and session B reject A preference then select B pet',
        (tester) async {
      Widget destination({
        required int generation,
        required _PetRepository pets,
        required OwnerPet pet,
      }) {
        return MaterialApp(
          home: OwnerPetDeepLinkDestination(
            link: OwnerPetDeepLink.tryParse('/owner/pets/${pet.id}')!,
            resolver: OwnerPetDeepLinkResolver(
              pets: pets,
              diary: _DiaryRepository(),
            ),
            sessionGeneration: generation,
            petRepository: pets,
            diaryRepository: _DiaryRepository(),
            onPetChanged: (_) {},
            onArchiveResolved: (_) {},
          ),
        );
      }

      await tester.pumpWidget(destination(
        generation: 1,
        pets: _PetRepository(pets: [_pet]),
        pet: _pet,
      ));
      await tester.pumpAndSettle();
      expect(find.text(_pet.name), findsWidgets);

      await tester.pumpWidget(const MaterialApp(
        home: SizedBox(key: ValueKey('owner-logged-out')),
      ));
      expect(find.text(_pet.name), findsNothing);
      expect(find.byKey(const ValueKey('owner-logged-out')), findsOneWidget);

      String? selectedForSessionB;
      final sessionB = _PetRepository(pets: [_sessionBPet]);
      await tester.pumpWidget(MaterialApp(
        home: OwnerV50AdaptiveShell(
          home: const SizedBox.shrink(),
          clinics: const SizedBox.shrink(),
          appointments: const SizedBox.shrink(),
          pets: OwnerPetsPage(
            repository: sessionB,
            selectedPetId: _pet.id,
            onPetSelected: (pet) => selectedForSessionB = pet.id,
          ),
          selectedIndex: 3,
          selectedPetName: null,
          onDestinationSelected: (_) {},
          onEmergency: () {},
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text(_pet.name), findsNothing);
      expect(find.text(_sessionBPet.name), findsWidgets);
      expect(find.text('Основной'), findsNothing,
          reason: 'session A selectedPetId must not select any session B pet');
      await tester.tap(find.byKey(ValueKey('pet-card-${_sessionBPet.id}')));
      await tester.pump();
      expect(selectedForSessionB, _sessionBPet.id);
    });
  });

  group('document states', () {
    testWidgets('archived document exposes owner metadata but no binary action',
        (tester) async {
      final diary = _DiaryRepository(
        eventStatus: 'ARCHIVED',
        document: OwnerPetDocumentDetail(
          fileName: 'Архив.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 20,
          status: 'ARCHIVED',
          contentBytes: Uint8List.fromList('%PDF'.codeUnits),
        ),
      );
      await _pumpDocumentLink(tester, diary);
      expect(find.text('Документ в архиве'), findsOneWidget);
      expect(find.text('Заключение врача'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
                find.byKey(const ValueKey('owner-document-open-action')))
            .onPressed,
        isNull,
      );
    });

    testWidgets('network failure keeps safe metadata and controlled retry',
        (tester) async {
      final diary = _DiaryRepository(
        documentError: const OwnerPetCareApiException(503, 'NETWORK'),
      );
      await _pumpDocumentLink(tester, diary);
      expect(find.text('Заключение врача'), findsOneWidget);
      expect(find.text('Документ временно недоступен'), findsOneWidget);
      expect(find.text('Повторить'), findsOneWidget);
      expect(find.textContaining('storage'), findsNothing);
      expect(diary.documentCalls, 1);
      await tester.tap(find.text('Повторить'));
      await tester.pumpAndSettle();
      expect(diary.documentCalls, 2);
    });

    testWidgets('foreign document discloses no pet, metadata, MIME or status',
        (tester) async {
      final diary = _DiaryRepository(
        documentError:
            const OwnerPetCareApiException(404, 'OWNER_PET_DOCUMENT_NOT_FOUND'),
      );
      await _pumpDocumentLink(tester, diary);
      expect(find.byKey(const ValueKey('owner-pet-deep-link-not-found')),
          findsOneWidget);
      expect(find.text(_pet.name), findsNothing);
      expect(find.text('Заключение врача'), findsNothing);
      expect(find.textContaining('application/pdf'), findsNothing);
      expect(find.textContaining('Обрабатывается'), findsNothing);
    });
  });

  group('keyboard focus automation', () {
    testWidgets('Pets tab order reaches pet card and primary action',
        (tester) async {
      String? selectedPet;
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetsPage(
          repository: _PetRepository(pets: [_pet]),
          selectedPetId: _pet.id,
          onPetSelected: (pet) => selectedPet = pet.id,
        ),
      ));
      await tester.pumpAndSettle();
      final card = find.byKey(ValueKey('pet-card-${_pet.id}'));
      expect(await _tabUntil(tester, card), isTrue);
      expect(_focusWithin(card), isTrue);
      expect(tester.widget<InkWell>(card).focusColor?.a, greaterThan(0));
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(selectedPet, _pet.id);
      expect(
          await _tabUntil(tester, find.byKey(const ValueKey('add-pet-action'))),
          isTrue);
    });

    testWidgets('Profile tab order reaches back, edit, diary and archive',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetProfileV50Page(
          pet: _pet,
          repository: _PetRepository(pets: [_pet]),
          onPetChanged: (_) {},
          onOpenDiary: () {},
          onArchiveResolved: (_) {},
        ),
      ));
      await tester.pumpAndSettle();
      for (final key in const [
        'profile-back-action',
        'profile-edit-action',
        'profile-diary-action',
        'profile-archive-action',
      ]) {
        expect(await _tabUntil(tester, find.byKey(ValueKey(key))), isTrue,
            reason: key);
      }
      var openedDiary = false;
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetProfileV50Page(
          pet: _pet,
          repository: _PetRepository(pets: [_pet]),
          onPetChanged: (_) {},
          onOpenDiary: () => openedDiary = true,
          onArchiveResolved: (_) {},
        ),
      ));
      await tester.pumpAndSettle();
      final diary = find.byKey(const ValueKey('profile-diary-action'));
      expect(await _tabUntil(tester, diary), isTrue);
      expect(Theme.of(tester.element(diary)).focusColor.a, greaterThan(0));
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(openedDiary, isTrue);
    });

    testWidgets(
        'Diary focus reaches filters, items and document action; dialog returns focus',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetDiaryV50Page(
          pet: _pet,
          repository: _DiaryRepository(),
        ),
      ));
      await tester.pumpAndSettle();
      expect(
          await _tabUntil(
              tester, find.byKey(const ValueKey('diary-filter-all'))),
          isTrue);
      final visitFilter = find.byKey(const ValueKey('diary-filter-VISIT'));
      expect(await _tabUntil(tester, visitFilter), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(tester.widget<ChoiceChip>(visitFilter).selected, isTrue);
      final allFilter = find.byKey(const ValueKey('diary-filter-all'));
      expect(await _tabUntil(tester, allFilter), isTrue,
          reason: 'focus traversal must leave the filtered chronology');
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(
          await _tabUntil(
              tester, find.byKey(const ValueKey('diary-event-visit-1'))),
          isTrue);
      final document =
          find.byKey(const ValueKey('diary-document-action-doc-1'));
      expect(await _tabUntil(tester, document), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.text('Заключение.pdf'), findsOneWidget);
      await tester.tap(find.text('Закрыть'));
      await tester.pumpAndSettle();
      expect(_focusWithin(document), isTrue);
    });

    testWidgets('processing document action is skipped and disabled',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: OwnerPetDiaryV50Page(
          pet: _pet,
          repository: _DiaryRepository(eventStatus: 'PROCESSING'),
        ),
      ));
      await tester.pumpAndSettle();
      final document =
          find.byKey(const ValueKey('diary-document-action-doc-1'));
      expect(tester.widget<IconButton>(document).onPressed, isNull);
      for (var i = 0; i < 12; i++) {
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pump();
        expect(_focusWithin(document), isFalse);
      }
    });
  });
}

Future<void> _pumpDocumentLink(
  WidgetTester tester,
  _DiaryRepository diary,
) async {
  final pets = _PetRepository(pets: [_pet]);
  await tester.pumpWidget(MaterialApp(
    home: OwnerPetDeepLinkDestination(
      link:
          OwnerPetDeepLink.tryParse('/owner/pets/${_pet.id}/documents/doc-1')!,
      resolver: OwnerPetDeepLinkResolver(pets: pets, diary: diary),
      sessionGeneration: 1,
      petRepository: pets,
      diaryRepository: diary,
      onPetChanged: (_) {},
      onArchiveResolved: (_) {},
    ),
  ));
  await tester.pumpAndSettle();
}

Future<bool> _tabUntil(
  WidgetTester tester,
  Finder target, {
  int limit = 20,
}) async {
  for (var index = 0; index < limit; index++) {
    if (_focusWithin(target)) return true;
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
  }
  return _focusWithin(target);
}

bool _focusWithin(Finder target) {
  final context = FocusManager.instance.primaryFocus?.context;
  if (context == null) return false;
  final focused =
      find.byElementPredicate((element) => identical(element, context));
  if (target.evaluate().contains(context)) return true;
  return find.ancestor(of: focused, matching: target).evaluate().isNotEmpty;
}

final _pet = OwnerPet(
  id: 'pet-1',
  name: 'Барсик',
  species: 'CAT',
  breed: 'Британская короткошёрстная',
  birthDate: DateTime(2022, 4, 12),
  weightKg: '5.2',
  profileVersion: 7,
);

final _sessionBPet = OwnerPet(
  id: 'pet-b',
  name: 'Рыжик',
  species: 'CAT',
  breed: 'Абиссинская',
  birthDate: DateTime(2023, 2, 3),
  weightKg: '4.1',
  profileVersion: 2,
);

OwnerPet _copyPet(OwnerPet source, {required bool archived}) => OwnerPet(
      id: source.id,
      name: source.name,
      species: source.species,
      breed: source.breed,
      birthDate: source.birthDate,
      weightKg: source.weightKg,
      profileVersion: source.profileVersion,
      isArchived: archived,
      archivedAt: archived ? DateTime.utc(2026, 7, 1) : null,
    );

class _PetRepository implements OwnerPetLifecycleRepository {
  _PetRepository({
    required this.pets,
    this.readError,
    List<OwnerPetApiException> updateErrors = const [],
  }) : updateErrors = List.of(updateErrors);

  final List<OwnerPet> pets;
  final OwnerPetApiException? readError;
  final List<OwnerPetApiException> updateErrors;
  final List<String> readIds = [];
  int updateCalls = 0;

  @override
  Future<List<OwnerPet>> list() async => pets;

  @override
  Future<OwnerPet> read(String petId) async {
    readIds.add(petId);
    if (readError != null) throw readError!;
    return pets.firstWhere((pet) => pet.id == petId);
  }

  @override
  Future<OwnerPet> archive({
    required String petId,
    required int profileVersion,
  }) async =>
      pets.first;

  @override
  Future<OwnerPet> restore({
    required String petId,
    required int profileVersion,
  }) async =>
      pets.first;

  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async => pets.first;

  @override
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async {
    updateCalls++;
    if (updateErrors.isNotEmpty) throw updateErrors.removeAt(0);
    return OwnerPetSaved(OwnerPet(
      id: pets.first.id,
      name: input.name,
      species: input.species,
      profileVersion: profileVersion + 1,
    ));
  }

  @override
  Future<OwnerPet> uploadPhoto({
    required String petId,
    required OwnerPickedPetFile file,
  }) async =>
      pets.first;

  @override
  Future<OwnerPet> deletePhoto(String petId) async => pets.first;

  @override
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(
          String petId) async =>
      const [];
}

class _DiaryRepository implements OwnerPetDiaryRepository {
  _DiaryRepository({
    this.eventStatus = 'READY',
    this.document,
    this.documentError,
  });

  final String eventStatus;
  final OwnerPetDocumentDetail? document;
  final OwnerPetCareApiException? documentError;
  int documentCalls = 0;

  @override
  Future<OwnerPetDiaryPageData> readDiary(
    String petId, {
    int offset = 0,
    int limit = 20,
  }) async =>
      OwnerPetDiaryPageData(
        events: [
          OwnerPetDiaryEvent(
            type: 'DOCUMENT',
            sourceId: 'doc-1',
            occurredAt: DateTime(2026, 7, 12),
            title: 'Заключение врача',
            summary: 'Результаты осмотра',
            status: eventStatus,
            downloadUrl: eventStatus == 'READY' ? '/authenticated/doc' : null,
          ),
          OwnerPetDiaryEvent(
            type: 'VISIT',
            sourceId: 'visit-1',
            occurredAt: DateTime(2026, 7, 10),
            title: 'Приём в клинике',
            summary: 'Плановый осмотр',
            status: 'READY',
          ),
        ],
        nextOffset: null,
        total: 2,
      );

  @override
  Future<OwnerPetDocumentDetail> readDocument(
    String petId,
    String documentId,
  ) async {
    documentCalls++;
    if (documentError != null) throw documentError!;
    return document ??
        OwnerPetDocumentDetail(
          fileName: 'Заключение.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 28,
          status: 'READY',
          contentBytes: Uint8List.fromList('%PDF'.codeUnits),
        );
  }
}
