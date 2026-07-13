import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_page.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_files.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_page.dart';
import 'package:vethelp_owner_mobile/presentation/widgets/owner_cupertino_feedback.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  testWidgets('iOS pet list shows loading, empty and error states',
      (tester) async {
    final pending = Completer<List<OwnerPet>>();
    await tester.pumpWidget(_harness(OwnerPetsPage(
      platformOverride: TargetPlatform.iOS,
      repository: _PetsRepository(listFuture: pending.future),
      onPetSelected: (_) {},
    )));
    await tester.pump();
    expect(find.byType(OwnerCupertinoLoading), findsOneWidget);
    pending.complete(const <OwnerPet>[]);
    await tester.pumpAndSettle();
    expect(find.text('Питомцы не добавлены'), findsOneWidget);

    await tester.pumpWidget(_harness(OwnerPetsPage(
      key: UniqueKey(),
      platformOverride: TargetPlatform.iOS,
      repository: _PetsRepository(error: StateError('HTTP 500 PETS_DOWN')),
      onPetSelected: (_) {},
    )));
    await tester.pumpAndSettle();
    expect(find.text('Не удалось загрузить питомцев'), findsOneWidget);
    expect(find.textContaining('HTTP 500'), findsNothing);
  });

  testWidgets('iOS pet profile uses real sections and no fake prevention',
      (tester) async {
    await tester.pumpWidget(_harness(OwnerPetsPage(
      platformOverride: TargetPlatform.iOS,
      repository: _PetsRepository(pets: [_pet]),
      onPetSelected: (_) {},
      onOpenPetCare: (_) {},
    )));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Барсик'));
    await tester.pumpAndSettle();

    expect(find.text('Что сейчас важно'), findsOneWidget);
    expect(find.text('Сведения о питомце'), findsOneWidget);
    expect(find.text('Открыть дневник здоровья'), findsOneWidget);
    expect(find.textContaining('risk score'), findsNothing);
    expect(find.textContaining('Профилактика'), findsNothing);
  });

  testWidgets('Pet Diary hides raw states and shows completed visit summary',
      (tester) async {
    await tester.pumpWidget(_harness(OwnerPetCarePage(
      platformOverride: TargetPlatform.iOS,
      pet: _pet,
      repository: _CareRepository(_careSummary()),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Pet Diary'), findsOneWidget);
    expect(find.text('Контрольный осмотр'), findsWidgets);
    expect(find.text('Назначена контрольная консультация.'), findsWidgets);
    expect(find.textContaining('COMPLETED'), findsNothing);
    expect(find.textContaining('hold-1'), findsNothing);
    expect(find.textContaining('snapshot'), findsNothing);
  });

  testWidgets('completed visit exposes rebooking intent with pet context',
      (tester) async {
    OwnerPetCareRebookIntent? intent;
    await tester.pumpWidget(_harness(OwnerPetCarePage(
      platformOverride: TargetPlatform.iOS,
      pet: _pet,
      repository: _CareRepository(_careSummary()),
      onRebookVisit: (value) => intent = value,
    )));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Подобрать повторную запись').first);
    await tester.pumpAndSettle();

    expect(intent, isNotNull);
    expect(intent!.pet.id, _pet.id);
    expect(intent!.clinicName, 'VetHelp Pilot');
    expect(intent!.serviceName, 'Контрольный осмотр');
  });

  testWidgets('dark mode and Dynamic Type keep iOS pets hub usable',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(430, 932));
    await tester.pumpWidget(_harness(
      OwnerPetsPage(
        platformOverride: TargetPlatform.iOS,
        repository: _PetsRepository(pets: [_pet]),
        onPetSelected: (_) {},
        onOpenPetCare: (_) {},
      ),
      brightness: Brightness.dark,
      textScale: 2,
    ));
    await tester.pumpAndSettle();

    expect(CupertinoTheme.of(tester.element(find.text('Барсик'))).brightness,
        Brightness.dark);
    await tester.tap(find.text('Барсик'));
    await tester.pumpAndSettle();
    expect(find.text('Выбрать для записи'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('iOS pet actions expose semantics and minimum tap targets',
      (tester) async {
    await tester.pumpWidget(_harness(OwnerPetsPage(
      platformOverride: TargetPlatform.iOS,
      repository: _PetsRepository(pets: [_pet]),
      onPetSelected: (_) {},
      onOpenPetCare: (_) {},
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Барсик'));
    await tester.pumpAndSettle();

    final selectAction = tester.widget<OwnerCupertinoButton>(
      find.widgetWithText(OwnerCupertinoButton, 'Выбрать для записи'),
    );
    final diaryAction = tester.widget<OwnerCupertinoButton>(
      find.widgetWithText(OwnerCupertinoButton, 'Открыть дневник здоровья'),
    );
    expect(selectAction.semanticLabel, 'Выбрать Барсик для записи');
    expect(diaryAction.semanticLabel, 'Открыть дневник здоровья Барсик');
    final selectButton = find.ancestor(
      of: find.text('Выбрать для записи'),
      matching: find.byType(CupertinoButton),
    );
    expect(tester.getSize(selectButton.first).height, greaterThanOrEqualTo(44));
  });
}

const _pet = OwnerPet(
  id: 'pet-1',
  name: 'Барсик',
  species: 'CAT',
  breed: 'Сибирская',
  ageMonths: 36,
  weightKg: '4.2',
  allergies: ['курица'],
);

Widget _harness(
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1,
}) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, appChild) {
      final media = MediaQuery.of(context).copyWith(
        platformBrightness: brightness,
        textScaler: TextScaler.linear(textScale),
      );
      return MediaQuery(
        data: media,
        child: Builder(
          builder: (context) => CupertinoTheme(
            data: VetHelpCupertinoTheme.data(context),
            child: Theme(
              data: (brightness == Brightness.dark
                      ? VetHelpTheme.dark()
                      : VetHelpTheme.light())
                  .copyWith(platform: TargetPlatform.iOS),
              child: appChild ?? const SizedBox.shrink(),
            ),
          ),
        ),
      );
    },
    home: child,
  );
}

OwnerPetCareSummary _careSummary() {
  final start = DateTime.utc(2026, 7, 2, 10);
  return OwnerPetCareSummary(
    pet: _pet,
    documents: [
      OwnerPetCareDocument(
        id: 'document-1',
        type: 'HISTORY',
        label: 'Комплексная вакцина',
        value: '/v1/owner/pets/pet-1/documents/document-1/download',
        fileName: 'vaccination.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 24000,
        createdAt: start,
        downloadUrl: '/v1/owner/pets/pet-1/documents/document-1/download',
        canOpen: true,
        canDelete: true,
      ),
    ],
    visits: [
      OwnerPetCareVisit(
        holdId: 'hold-1',
        appointmentId: 'appointment-1',
        state: 'COMPLETED',
        bucket: 'HISTORY',
        presentation: const OwnerAppointmentPresentation(
          code: 'COMPLETED',
          label: 'Приём завершён',
          description: 'Заключение врача доступно в дневнике питомца.',
          tone: 'success',
        ),
        startsAt: start,
        endsAt: start.add(const Duration(minutes: 30)),
        clinicName: 'VetHelp Pilot',
        clinicAddress: 'Москва, Лесная, 1',
        serviceName: 'Контрольный осмотр',
        priceAmount: '1500.00',
        currency: 'RUB',
        clinicalSummary: 'Назначена контрольная консультация.',
      ),
    ],
    telemedSessions: const [],
    serverNow: start.add(const Duration(minutes: 35)),
  );
}

class _PetsRepository implements OwnerPetRepository {
  _PetsRepository({
    this.pets = const <OwnerPet>[],
    this.listFuture,
    this.error,
  });

  final List<OwnerPet> pets;
  final Future<List<OwnerPet>>? listFuture;
  final Object? error;

  @override
  Future<List<OwnerPet>> list() async {
    if (error != null) throw error!;
    return listFuture ?? Future.value(pets);
  }

  @override
  Future<OwnerPet> read(String petId) async => pets.first;

  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async {
    return OwnerPet(id: 'new-pet', name: input.name, species: input.species);
  }

  @override
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(String petId) async {
    return const <OwnerPetProfileSyncState>[];
  }

  @override
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async {
    return OwnerPetSaved(
      OwnerPet(id: petId, name: input.name, species: input.species),
    );
  }

  @override
  Future<OwnerPet> uploadPhoto({
    required String petId,
    required OwnerPickedPetFile file,
  }) async {
    return OwnerPet(
      id: petId,
      name: pets.isEmpty ? 'Demo Pet' : pets.first.name,
      species: pets.isEmpty ? 'DOG' : pets.first.species,
      photoUrl: '/v1/owner/pets/$petId/documents/photo/download',
    );
  }

  @override
  Future<OwnerPet> deletePhoto(String petId) async {
    return OwnerPet(
      id: petId,
      name: pets.isEmpty ? 'Demo Pet' : pets.first.name,
      species: pets.isEmpty ? 'DOG' : pets.first.species,
    );
  }
}

class _CareRepository implements OwnerPetCareRepository {
  const _CareRepository(this.summary);

  final OwnerPetCareSummary summary;

  @override
  Future<OwnerPetCareSummary> readSummary(String petId) async => summary;

  @override
  Future<OwnerPetDocumentUpload> uploadDocumentFile({
    required String petId,
    required OwnerPickedPetFile file,
    required String docType,
  }) {
    throw UnsupportedError('Upload is not used in this test.');
  }

  @override
  Future<void> deleteDocument({
    required String petId,
    required String documentId,
  }) {
    throw UnsupportedError('Delete is not used in this test.');
  }
}
