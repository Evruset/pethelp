import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_diary_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_files.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_profile_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_page.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  final state = Uri.base.queryParameters['state'] ?? 'PETS_READY';
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: VetHelpTheme.light(),
    builder: VetHelpTheme.frameBuilder,
    home: _EvidenceState(state),
  ));
}

class _EvidenceState extends StatefulWidget {
  const _EvidenceState(this.state);
  final String state;
  @override
  State<_EvidenceState> createState() => _EvidenceStateState();
}

class _EvidenceStateState extends State<_EvidenceState> {
  bool _opened = false;

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    if (state == 'PROFILE_EDIT' && !_opened) {
      _opened = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        showOwnerPetEditorBottomSheet(
          context: context,
          repository: _PetRepository([readyPet]),
          pet: readyPet,
        );
      });
    }
    if (state == 'DIARY_DOCUMENT_PREVIEW' && !_opened) {
      _opened = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Заключение.pdf'),
            content: const Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Предпросмотр этого формата недоступен.'),
                SizedBox(height: 12),
                Text('Тип: application/pdf'),
                Text('Размер: 28 байт'),
              ],
            ),
            actions: [
              FilledButton.icon(
                onPressed: () {},
                icon: Icon(Icons.open_in_new),
                label: Text('Открыть документ'),
              ),
              TextButton(onPressed: () {}, child: const Text('Закрыть')),
            ],
          ),
        );
      });
    }

    if (state.startsWith('PETS_')) {
      final page = OwnerPetsPage(
        repository:
            _PetRepository(state == 'PETS_EMPTY' ? const [] : [readyPet]),
        selectedPetId: readyPet.id,
        onPetSelected: (_) {},
      );
      return _evidenceShell(state == 'PETS_OFFLINE_STALE'
          ? OwnerPetsPage(
              repository: _PetRepository([readyPet]),
              selectedPetId: readyPet.id,
              onPetSelected: (_) {},
              staleMessage: 'Не удалось обновить список питомцев.',
              onRetry: () {},
            )
          : page);
    }

    if (state.startsWith('PROFILE_')) {
      final pet = state == 'PROFILE_WITH_WARNING' ? warningPet : readyPet;
      final page = OwnerPetProfileV50Page(
        pet: pet,
        repository: _PetRepository([pet]),
        onPetChanged: (_) {},
        onOpenDiary: () {},
        onArchiveResolved: (_) {},
        initialStatusMessage: state == 'PROFILE_CONFLICT'
            ? 'Профиль изменился. Показаны актуальные данные.'
            : null,
      );
      return _evidenceShell(page);
    }

    return _evidenceShell(OwnerPetDiaryV50Page(
      pet: readyPet,
      repository: _DiaryRepository(state.substring('DIARY_'.length)),
    ));
  }

  Widget _evidenceShell(Widget page) => OwnerV50AdaptiveShell(
        home: const SizedBox.shrink(),
        clinics: const SizedBox.shrink(),
        appointments: const SizedBox.shrink(),
        pets: page,
        selectedIndex: 3,
        onDestinationSelected: (_) {},
        onEmergency: () {},
        onNotifications: () {},
        onPetContextPressed: () {},
        selectedPetName: readyPet.name,
      );
}

final readyPet = OwnerPet(
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Барсик',
  species: 'CAT',
  breed: 'Британская короткошёрстная',
  birthDate: DateTime(2022, 4, 12),
  weightKg: '5.2',
  profileVersion: 7,
  updatedAt: DateTime.utc(2026, 7, 14, 12),
);

final warningPet = OwnerPet(
  id: readyPet.id,
  name: readyPet.name,
  species: readyPet.species,
  breed: readyPet.breed,
  weightKg: readyPet.weightKg,
  allergies: const ['Куриный белок'],
  chronicConditions: const ['Мочекаменная болезнь'],
  vaccinationNotes: 'Ревакцинация в августе 2026',
  profileVersion: 7,
  updatedAt: DateTime.utc(2026, 7, 14, 12),
);

class _PetRepository implements OwnerPetLifecycleRepository {
  const _PetRepository(this.pets);
  final List<OwnerPet> pets;
  @override
  Future<List<OwnerPet>> list() async => pets;
  @override
  Future<OwnerPet> read(String petId) async => pets.first;
  @override
  Future<OwnerPet> archive(
          {required String petId, required int profileVersion}) async =>
      pets.first;
  @override
  Future<OwnerPet> restore(
          {required String petId, required int profileVersion}) async =>
      pets.first;
  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async => pets.first;
  @override
  Future<OwnerPetSaveResult> update(
          {required String petId,
          required int profileVersion,
          required OwnerPetProfileInput input}) async =>
      OwnerPetSaved(pets.first);
  @override
  Future<OwnerPet> uploadPhoto(
          {required String petId, required OwnerPickedPetFile file}) async =>
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
  Future<OwnerPetDiaryPageData> readDiary(String petId,
      {int offset = 0, int limit = 20}) async {
    if (state == 'EMPTY') {
      return const OwnerPetDiaryPageData(
          events: [], nextOffset: null, total: 0);
    }
    final status = state == 'PROCESSING'
        ? 'PROCESSING'
        : state == 'REVIEW_REQUIRED'
            ? 'REVIEW_REQUIRED'
            : 'READY';
    return OwnerPetDiaryPageData(events: [
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
    ], nextOffset: null, total: 2);
  }

  @override
  Future<OwnerPetDocumentDetail> readDocument(
          String petId, String documentId) async =>
      OwnerPetDocumentDetail(
        fileName: 'Заключение.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 28,
        status: 'READY',
        contentBytes: Uint8List.fromList('%PDF-1.4 evidence'.codeUnits),
      );
}
