import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_page.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_files.dart';

void main() {
  test('parses clinical summary from care-summary visits', () {
    final summary = OwnerPetCareSummary.fromJson({
      'pet': {
        'id': 'pet-1',
        'name': 'Барсик',
        'species': 'CAT',
      },
      'documents': [],
      'visits': [
        {
          'holdId': 'hold-1',
          'appointmentId': 'appointment-1',
          'state': 'COMPLETED',
          'bucket': 'HISTORY',
          'presentation': {
            'code': 'COMPLETED',
            'label': 'Приём завершён',
            'description': 'Заключение врача доступно в карте питомца.',
            'tone': 'success',
          },
          'startsAt': '2026-06-28T12:00:00.000Z',
          'endsAt': '2026-06-28T12:30:00.000Z',
          'clinic': {
            'name': 'VetHelp Pilot',
            'address': 'Moscow, Pilotnaya 1',
          },
          'service': {
            'name': 'Первичный приём',
            'priceAmount': '1500.00',
            'currency': 'RUB',
          },
          'clinicalSummary': 'Назначена контрольная консультация.',
        },
      ],
      'telemedSessions': [],
      'serverNow': '2026-06-28T12:31:00.000Z',
    });

    expect(summary.visits.single.clinicalSummary,
        'Назначена контрольная консультация.');
  });

  testWidgets('shows clinical summary for completed visits', (tester) async {
    const pet = OwnerPet(id: 'pet-1', name: 'Барсик', species: 'CAT');
    const clinicalSummary =
        'Состояние стабильное, назначена контрольная консультация.';
    final now = DateTime.utc(2026, 6, 28, 12);

    await tester.pumpWidget(MaterialApp(
      home: OwnerPetCarePage(
        pet: pet,
        repository: _FakeCareRepository(OwnerPetCareSummary(
          pet: pet,
          documents: const [],
          visits: [
            OwnerPetCareVisit(
              holdId: 'hold-1',
              appointmentId: 'appointment-1',
              state: 'COMPLETED',
              bucket: 'HISTORY',
              presentation: const OwnerAppointmentPresentation(
                code: 'COMPLETED',
                label: 'Приём завершён',
                description: 'Заключение врача доступно в карте питомца.',
                tone: 'success',
              ),
              startsAt: now,
              endsAt: now.add(const Duration(minutes: 30)),
              clinicName: 'VetHelp Pilot',
              clinicAddress: 'Moscow, Pilotnaya 1',
              serviceName: 'Первичный приём',
              priceAmount: '1500.00',
              currency: 'RUB',
              clinicalSummary: clinicalSummary,
            ),
          ],
          telemedSessions: const [],
          serverNow: now,
        )),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(ListView).first, const Offset(0, -600));
    await tester.pumpAndSettle();

    expect(find.text('Заключение врача'), findsOneWidget);
    expect(find.text(clinicalSummary), findsOneWidget);
  });

  testWidgets('document upload success refreshes document list',
      (tester) async {
    final repository = _UploadingCareRepository();

    await tester.pumpWidget(MaterialApp(
      home: OwnerPetCarePage(
        pet: _pet(),
        repository: repository,
        pickDocuments: () async => [_pickedPdf()],
      ),
    ));
    await tester.pumpAndSettle();

    final addButton = find.text('Добавить').last;
    await tester.ensureVisible(addButton);
    await tester.tap(addButton);
    await tester.pumpAndSettle();

    expect(repository.uploadedFileNames, ['lab.pdf']);
    expect(find.text('lab.pdf'), findsOneWidget);
    expect(find.textContaining('PDF'), findsOneWidget);
  });

  testWidgets('document upload error supports retry', (tester) async {
    final repository = _UploadingCareRepository(failUploads: true);

    await tester.pumpWidget(MaterialApp(
      home: OwnerPetCarePage(
        pet: _pet(),
        repository: repository,
        pickDocuments: () async => [_pickedPdf()],
      ),
    ));
    await tester.pumpAndSettle();

    final addButton = find.text('Добавить').last;
    await tester.ensureVisible(addButton);
    await tester.tap(addButton);
    await tester.pumpAndSettle();

    expect(
        find.textContaining('Не удалось обновить документы'), findsOneWidget);
    repository.failUploads = false;
    await tester.tap(find.text('Повторить загрузку'));
    await tester.pumpAndSettle();

    expect(find.text('lab.pdf'), findsOneWidget);
  });

  testWidgets('document delete removes row after backend success',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = _UploadingCareRepository(initialDocuments: [
      OwnerPetCareDocument(
        id: 'document-1',
        type: 'HISTORY',
        label: 'lab.pdf',
        value: '/v1/owner/pets/pet-1/documents/document-1/download',
        fileName: 'lab.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        createdAt: DateTime.utc(2026, 7, 2),
        downloadUrl: '/v1/owner/pets/pet-1/documents/document-1/download',
        canOpen: true,
        canDelete: true,
      ),
    ]);

    await tester.pumpWidget(MaterialApp(
      home: OwnerPetCarePage(
        pet: _pet(),
        repository: repository,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('lab.pdf'), findsOneWidget);
    final deleteButton = find.byTooltip('Удалить документ');
    await tester.ensureVisible(deleteButton);
    await tester.tap(deleteButton);
    await tester.pumpAndSettle();

    expect(repository.deletedDocumentIds, ['document-1']);
    expect(find.text('lab.pdf'), findsNothing);
  });
}

class _FakeCareRepository implements OwnerPetCareRepository {
  const _FakeCareRepository(this.summary);

  final OwnerPetCareSummary summary;

  @override
  Future<OwnerPetCareSummary> readSummary(String petId) async => summary;

  @override
  Future<OwnerPetDocumentUpload> uploadDocumentFile({
    required String petId,
    required OwnerPickedPetFile file,
    required String docType,
  }) {
    throw UnsupportedError('Document upload is not used in this widget test.');
  }

  @override
  Future<void> deleteDocument({
    required String petId,
    required String documentId,
  }) {
    throw UnsupportedError('Document delete is not used in this widget test.');
  }
}

class _UploadingCareRepository implements OwnerPetCareRepository {
  _UploadingCareRepository({
    List<OwnerPetCareDocument>? initialDocuments,
    this.failUploads = false,
  }) : documents = List<OwnerPetCareDocument>.from(
          initialDocuments ?? const <OwnerPetCareDocument>[],
        );

  final List<OwnerPetCareDocument> documents;
  final List<String> uploadedFileNames = <String>[];
  final List<String> deletedDocumentIds = <String>[];
  bool failUploads;

  @override
  Future<OwnerPetCareSummary> readSummary(String petId) async {
    return OwnerPetCareSummary(
      pet: _pet(),
      documents: List<OwnerPetCareDocument>.from(documents),
      visits: const <OwnerPetCareVisit>[],
      telemedSessions: const <OwnerPetCareTelemedSession>[],
      serverNow: DateTime.utc(2026, 7, 2, 12),
    );
  }

  @override
  Future<OwnerPetDocumentUpload> uploadDocumentFile({
    required String petId,
    required OwnerPickedPetFile file,
    required String docType,
  }) async {
    if (failUploads) {
      throw const OwnerPetCareApiException(500, 'BACKEND_UNAVAILABLE');
    }
    uploadedFileNames.add(file.name);
    final documentId = 'document-${documents.length + 1}';
    documents.add(OwnerPetCareDocument(
      id: documentId,
      type: docType,
      label: file.name,
      value: '/v1/owner/pets/$petId/documents/$documentId/download',
      fileName: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: DateTime.utc(2026, 7, 2, 12),
      downloadUrl: '/v1/owner/pets/$petId/documents/$documentId/download',
      canOpen: true,
      canDelete: true,
      isImage: file.isImage,
    ));
    return OwnerPetDocumentUpload(
      documentId: documentId,
      petId: petId,
      fileUrl: '/v1/owner/pets/$petId/documents/$documentId/download',
      docType: docType,
      status: 'PROCESSED',
      createdAt: DateTime.utc(2026, 7, 2, 12),
    );
  }

  @override
  Future<void> deleteDocument({
    required String petId,
    required String documentId,
  }) async {
    deletedDocumentIds.add(documentId);
    documents.removeWhere((document) => document.id == documentId);
  }
}

OwnerPet _pet() {
  return const OwnerPet(id: 'pet-1', name: 'Барсик', species: 'CAT');
}

OwnerPickedPetFile _pickedPdf() {
  return OwnerPickedPetFile(
    name: 'lab.pdf',
    mimeType: 'application/pdf',
    bytes: Uint8List.fromList([1, 2, 3, 4]),
  );
}
