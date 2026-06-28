import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_page.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';

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
}

class _FakeCareRepository implements OwnerPetCareRepository {
  const _FakeCareRepository(this.summary);

  final OwnerPetCareSummary summary;

  @override
  Future<OwnerPetCareSummary> readSummary(String petId) async => summary;

  @override
  Future<OwnerPetDocumentUpload> uploadDocumentPhoto({
    required String petId,
    required String fileUrl,
    required String docType,
  }) {
    throw UnsupportedError('Document upload is not used in this widget test.');
  }
}
