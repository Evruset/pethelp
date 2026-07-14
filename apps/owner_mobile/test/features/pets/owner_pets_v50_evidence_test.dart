import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_diary_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_files.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_profile_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_page.dart';

void main() {
  const viewports = <String, Size>{
    '375x812': Size(375, 812),
    '412x915': Size(412, 915),
    '768x1024': Size(768, 1024),
    '1440x900': Size(1440, 900),
  };

  for (final viewport in viewports.entries) {
    for (final state in const [
      'PETS_READY',
      'PETS_EMPTY',
      'PETS_OFFLINE_STALE',
      'PROFILE_READY',
      'PROFILE_WITH_WARNING',
      'PROFILE_EDIT',
      'PROFILE_CONFLICT',
      'DIARY_READY',
      'DIARY_EMPTY',
      'DIARY_PROCESSING',
      'DIARY_REVIEW_REQUIRED',
      'DIARY_DOCUMENT_PREVIEW',
    ]) {
      testWidgets('evidence $state ${viewport.key}', (tester) async {
        tester.view.physicalSize = viewport.value;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        if (state.startsWith('PETS_')) {
          final repository = _PetRepository(
            pets: state == 'PETS_EMPTY' ? const [] : [_readyPet],
            failAfterFirstList: state == 'PETS_OFFLINE_STALE',
          );
          await tester.pumpWidget(MaterialApp(
              home: OwnerPetsPage(
            repository: repository,
            selectedPetId: _readyPet.id,
            platformOverride: state == 'PETS_OFFLINE_STALE'
                ? TargetPlatform.iOS
                : TargetPlatform.android,
            onPetSelected: (_) {},
          )));
          await tester.pumpAndSettle();
          if (state == 'PETS_OFFLINE_STALE') {
            await tester.drag(
                find.byType(CustomScrollView), const Offset(0, 300));
            await tester.pumpAndSettle();
          }
        } else if (state.startsWith('PROFILE_')) {
          final pet = state == 'PROFILE_WITH_WARNING' ? _warningPet : _readyPet;
          await tester.pumpWidget(MaterialApp(
              home: OwnerPetProfileV50Page(
            pet: pet,
            repository: _PetRepository(
              pets: [pet],
              archiveConflict: state == 'PROFILE_CONFLICT',
            ),
            onPetChanged: (_) {},
            onOpenDiary: () {},
            onArchiveResolved: (_) {},
          )));
          await tester.pumpAndSettle();
          if (state == 'PROFILE_EDIT') {
            await tester.tap(find.byTooltip('Редактировать профиль'));
            await tester.pumpAndSettle();
          } else if (state == 'PROFILE_CONFLICT') {
            await tester.tap(find.text('В архив'));
            await tester.pumpAndSettle();
            await tester.tap(find.widgetWithText(FilledButton, 'В архив'));
            await tester.pumpAndSettle();
          }
        } else {
          final diaryState = state.substring('DIARY_'.length);
          await tester.pumpWidget(MaterialApp(
              home: OwnerPetDiaryV50Page(
            pet: _readyPet,
            repository: _DiaryRepository(diaryState),
          )));
          await tester.pumpAndSettle();
          if (state == 'DIARY_DOCUMENT_PREVIEW') {
            await tester.tap(find.text('Заключение врача'));
            await tester.pumpAndSettle();
          }
        }
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('accessibility evidence has finite constraints at 200% text',
      (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(
        textScaler: TextScaler.linear(2),
        disableAnimations: true,
      ),
      child: MaterialApp(
        home: OwnerPetDiaryV50Page(
          pet: _readyPet,
          repository: _DiaryRepository('READY'),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(ChoiceChip), findsWidgets);
  });
}

final _readyPet = OwnerPet(
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Барсик',
  species: 'CAT',
  breed: 'Британская короткошёрстная',
  birthDate: DateTime(2022, 4, 12),
  weightKg: '5.2',
  profileVersion: 7,
  updatedAt: DateTime.utc(2026, 7, 14, 12),
);

final _warningPet = OwnerPet(
  id: _readyPet.id,
  name: _readyPet.name,
  species: _readyPet.species,
  breed: _readyPet.breed,
  weightKg: _readyPet.weightKg,
  allergies: const ['Куриный белок'],
  chronicConditions: const ['Мочекаменная болезнь'],
  vaccinationNotes: 'Ревакцинация в августе 2026',
  profileVersion: 7,
  updatedAt: DateTime.utc(2026, 7, 14, 12),
);

class _PetRepository implements OwnerPetLifecycleRepository {
  _PetRepository({
    required this.pets,
    this.failAfterFirstList = false,
    this.archiveConflict = false,
  });

  final List<OwnerPet> pets;
  final bool failAfterFirstList;
  final bool archiveConflict;
  int _listCalls = 0;

  @override
  Future<List<OwnerPet>> list() async {
    _listCalls++;
    if (failAfterFirstList && _listCalls > 1) {
      throw const OwnerPetApiException(503, 'OFFLINE');
    }
    return pets;
  }

  @override
  Future<OwnerPet> read(String petId) async => pets.first;

  @override
  Future<OwnerPet> archive({
    required String petId,
    required int profileVersion,
  }) async {
    if (archiveConflict) {
      throw const OwnerPetApiException(412, 'PET_PROFILE_VERSION_MISMATCH');
    }
    return pets.first;
  }

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
  }) async =>
      OwnerPetSaved(pets.first);

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
  const _DiaryRepository(this.state);
  final String state;

  @override
  Future<OwnerPetDiaryPageData> readDiary(
    String petId, {
    int offset = 0,
    int limit = 20,
  }) async {
    if (state == 'EMPTY') {
      return const OwnerPetDiaryPageData(
          events: [], nextOffset: null, total: 0);
    }
    final status = switch (state) {
      'PROCESSING' => 'PROCESSING',
      'REVIEW_REQUIRED' => 'REVIEW_REQUIRED',
      _ => 'READY',
    };
    return OwnerPetDiaryPageData(
      events: [
        OwnerPetDiaryEvent(
          type: 'DOCUMENT',
          sourceId: '22222222-2222-4222-8222-222222222222',
          occurredAt: DateTime.utc(2026, 7, 12, 10),
          title: 'Заключение врача',
          summary: 'Результаты осмотра и рекомендации',
          status: status,
          downloadUrl: status == 'READY' ? '/authenticated/document' : null,
        ),
        OwnerPetDiaryEvent(
          type: 'VISIT',
          sourceId: '33333333-3333-4333-8333-333333333333',
          occurredAt: DateTime.utc(2026, 7, 10, 9),
          title: 'Приём в клинике',
          summary: 'Плановый осмотр',
          status: 'READY',
        ),
      ],
      nextOffset: null,
      total: 2,
    );
  }

  @override
  Future<OwnerPetDocumentDetail> readDocument(
    String petId,
    String documentId,
  ) async =>
      OwnerPetDocumentDetail(
        fileName: 'Заключение.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 28,
        status: 'READY',
        contentBytes: Uint8List.fromList('%PDF-1.4\n% evidence\n'.codeUnits),
      );
}
