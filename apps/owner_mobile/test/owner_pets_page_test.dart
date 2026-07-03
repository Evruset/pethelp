import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_files.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_page.dart';

void main() {
  testWidgets('validates pet profile before submit', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = _FakeOwnerPetRepository();

    await tester.pumpWidget(MaterialApp(
      home: OwnerPetsPage(
        repository: repository,
        onPetSelected: (_) {},
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Добавить питомца'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), '!');
    await tester.enterText(find.byType(TextFormField).at(2), '2999-01-01');
    await tester.enterText(find.byType(TextFormField).at(3), '999');
    final submitButton = find.byType(FilledButton).last;
    await tester.ensureVisible(submitButton);
    await tester.pump();
    await tester.tap(submitButton);
    await tester.pump();

    expect(find.text('Введите имя питомца'), findsOneWidget);
    expect(find.text('Дата рождения не может быть в будущем'), findsOneWidget);
    expect(find.text('Укажите вес от 0,1 до 200 кг'), findsOneWidget);
    expect(repository.created, isFalse);
    expect(find.text('Ссылка на фото'), findsNothing);
    expect(find.text('Ссылки на полисы'), findsNothing);
  });

  testWidgets('photo picker upload updates pet profile', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = _FakeOwnerPetRepository.withPet();
    OwnerPet? changedPet;

    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => FilledButton(
          onPressed: () => showOwnerPetEditorBottomSheet(
            context: context,
            repository: repository,
            pet: repository.pet!,
            onPetChanged: (pet) => changedPet = pet,
            pickPhoto: (_) async => _pickedImage(),
          ),
          child: const Text('Редактировать'),
        ),
      ),
    ));

    await tester.tap(find.text('Редактировать'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Добавить фото'));
    await tester.pumpAndSettle();

    expect(repository.uploadedPhotoName, 'pet.jpg');
    expect(
        changedPet?.photoUrl, '/v1/owner/pets/pet-1/documents/photo/download');
    expect(find.text('Фото профиля сохранено. Его можно заменить или удалить.'),
        findsOneWidget);
  });

  testWidgets('cancelled photo picker leaves profile unchanged',
      (tester) async {
    final repository = _FakeOwnerPetRepository.withPet();

    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => FilledButton(
          onPressed: () => showOwnerPetEditorBottomSheet(
            context: context,
            repository: repository,
            pet: repository.pet!,
            pickPhoto: (_) async => null,
          ),
          child: const Text('Редактировать'),
        ),
      ),
    ));

    await tester.tap(find.text('Редактировать'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Добавить фото'));
    await tester.pumpAndSettle();

    expect(repository.uploadedPhotoName, isNull);
    expect(repository.pet?.photoUrl, isNull);
  });

  testWidgets('remove photo clears pet profile photo', (tester) async {
    final repository = _FakeOwnerPetRepository.withPet(
      photoUrl: '/v1/owner/pets/pet-1/documents/photo/download',
    );

    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => FilledButton(
          onPressed: () => showOwnerPetEditorBottomSheet(
            context: context,
            repository: repository,
            pet: repository.pet!,
          ),
          child: const Text('Редактировать'),
        ),
      ),
    ));

    await tester.tap(find.text('Редактировать'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Удалить'));
    await tester.pumpAndSettle();

    expect(repository.deletedPhoto, isTrue);
    expect(repository.pet?.photoUrl, isNull);
  });

  testWidgets('unsupported photo type shows owner-facing error',
      (tester) async {
    final repository = _FakeOwnerPetRepository.withPet();

    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => FilledButton(
          onPressed: () => showOwnerPetEditorBottomSheet(
            context: context,
            repository: repository,
            pet: repository.pet!,
            pickPhoto: (_) async => OwnerPickedPetFile(
              name: 'notes.txt',
              mimeType: 'text/plain',
              bytes: Uint8List.fromList([1, 2, 3]),
            ),
          ),
          child: const Text('Редактировать'),
        ),
      ),
    ));

    await tester.tap(find.text('Редактировать'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Добавить фото'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Этот тип файла не поддерживается'),
        findsOneWidget);
    expect(repository.uploadedPhotoName, isNull);
  });

  test('upload policy rejects oversize pet files', () {
    final file = OwnerPickedPetFile(
      name: 'big.pdf',
      mimeType: 'application/pdf',
      bytes: Uint8List(ownerPetUploadMaxBytes + 1),
    );

    expect(
      ownerPetUploadValidationError(file, allowPdf: true),
      contains('Файл больше'),
    );
  });
}

class _FakeOwnerPetRepository implements OwnerPetRepository {
  _FakeOwnerPetRepository();

  _FakeOwnerPetRepository.withPet({String? photoUrl})
      : pet = OwnerPet(
          id: 'pet-1',
          name: 'Demo Pet',
          species: 'DOG',
          photoUrl: photoUrl,
        );

  bool created = false;
  OwnerPet? pet;
  String? uploadedPhotoName;
  bool deletedPhoto = false;

  @override
  Future<List<OwnerPet>> list() async =>
      pet == null ? const <OwnerPet>[] : <OwnerPet>[pet!];

  @override
  Future<OwnerPet> read(String petId) async => pet!;

  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async {
    created = true;
    return OwnerPet(id: 'pet-1', name: input.name, species: input.species);
  }

  @override
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(
    String petId,
  ) async =>
      const <OwnerPetProfileSyncState>[];

  @override
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<OwnerPet> uploadPhoto({
    required String petId,
    required OwnerPickedPetFile file,
  }) async {
    uploadedPhotoName = file.name;
    pet = OwnerPet(
      id: petId,
      name: pet!.name,
      species: pet!.species,
      photoUrl: '/v1/owner/pets/$petId/documents/photo/download',
      profileVersion: pet!.profileVersion + 1,
    );
    return pet!;
  }

  @override
  Future<OwnerPet> deletePhoto(String petId) async {
    deletedPhoto = true;
    pet = OwnerPet(
      id: petId,
      name: pet!.name,
      species: pet!.species,
      profileVersion: pet!.profileVersion + 1,
    );
    return pet!;
  }
}

OwnerPickedPetFile _pickedImage() {
  return OwnerPickedPetFile(
    name: 'pet.jpg',
    mimeType: 'image/jpeg',
    bytes: Uint8List.fromList([1, 2, 3, 4]),
  );
}
