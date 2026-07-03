import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_page.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';
import 'package:vethelp_owner_mobile/features/insurance/coverage_check_page.dart';
import 'package:vethelp_owner_mobile/features/insurance/coverage_check_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('owner can select a booking slot and create a hold',
      (tester) async {
    final repository = _FakeBookingRepository();

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: BookingMarketplacePage(
        clinicName: 'VetHelp Pilot',
        serviceName: 'Первичный приём',
        serviceId: 'service-1',
        petName: 'Demo Pet',
        clinicLocationId: 'location-1',
        petId: 'pet-1',
        repository: repository,
        retryDelay: (_) async {},
      ),
    ));

    await tester.pumpAndSettle();
    await tester.tap(find.text('10:00'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Отправить заявку'));
    await tester.pumpAndSettle();

    expect(repository.createdHolds, 1);
    expect(find.text('Заявка отправлена в клинику'), findsOneWidget);
  });

  testWidgets('owner can accept insurance consent and submit coverage check',
      (tester) async {
    final repository = _FakeCoverageRepository();

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: CoverageCheckPage(
        pet: const OwnerPet(
          id: 'pet-1',
          name: 'Demo Pet',
          species: 'DOG',
        ),
        repository: repository,
      ),
    ));

    await tester.pumpAndSettle();
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Проверить покрытие'));
    await tester.pumpAndSettle();

    expect(repository.createdChecks, 1);
    expect(find.text('Есть предварительное покрытие'), findsOneWidget);
  });
}

class _FakeBookingRepository implements BookingMarketplaceRepository {
  int createdHolds = 0;

  final BookingSlot slot = BookingSlot(
    id: 'slot-1',
    clinicLocationId: 'location-1',
    serviceId: 'service-1',
    serviceName: 'Первичный приём',
    startsAt: DateTime.utc(2026, 7, 1, 10),
    endsAt: DateTime.utc(2026, 7, 1, 10, 30),
    remainingCapacity: 1,
  );

  @override
  Future<List<BookingSlot>> listSlots({
    required String clinicLocationId,
    required String serviceId,
    required DateTime from,
    required DateTime to,
  }) async {
    return [slot];
  }

  @override
  Future<CreatedBookingHold> createHold({
    required String slotId,
    required String petId,
    required String correlationId,
    required String idempotencyKey,
  }) async {
    createdHolds += 1;
    return CreatedBookingHold(
      holdId: 'hold-1',
      state: 'MANUAL_CONFIRM_PENDING',
      slotId: slotId,
      expiresAt: DateTime.utc(2026, 7, 1, 9, 10),
      correlationId: correlationId,
    );
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    return BookingHoldSnapshot(
      holdId: holdId,
      state: 'MANUAL_CONFIRM_PENDING',
      slotId: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      expiresAt: DateTime.utc(2026, 7, 1, 9, 10),
    );
  }
}

class _FakeCoverageRepository extends CoverageCheckRepository {
  _FakeCoverageRepository()
      : super(
          baseUrl: Uri.parse('http://127.0.0.1:3000'),
          accessTokenProvider: () async => 'owner-token',
        );

  int createdChecks = 0;

  @override
  Future<List<InsuranceProfileView>> listProfiles() async {
    return const [];
  }

  @override
  Future<CoverageCheckView> create({
    required String petId,
    required String partnerCode,
    String? consentVersion,
    required String correlationId,
  }) async {
    createdChecks += 1;
    return CoverageCheckView(
      id: 'check-1',
      petId: petId,
      partnerCode: partnerCode,
      state: 'COVERED',
      consentVersion: consentVersion,
      providerReference: 'PILOT-1',
      responseSummary: const {
        'statusText': 'Covered',
      },
      providerCheckedAt: DateTime.utc(2026, 7, 1, 10),
      coverageValidUntil: DateTime.utc(2026, 7, 2, 10),
      claimDraft: null,
      version: 1,
      serverNow: DateTime.utc(2026, 7, 1, 10),
    );
  }
}
