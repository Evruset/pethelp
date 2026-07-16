import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_selection_feature_flags.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_selection_models.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_selection_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/owner_booking_selection_v50_page.dart';

void main() {
  test('booking flags are default-off and require their parents', () {
    expect(
      ownerBookingSelectionV50Flags(
        shellEnabled: true,
        clinicDetailEnabled: true,
      ).bookingReview,
      isFalse,
    );
    expect(
      ownerBookingSelectionV50Flags(
        shellEnabled: true,
        clinicDetailEnabled: false,
        serviceValue: 'true',
        slotValue: 'true',
        reviewValue: 'true',
      ).serviceSelection,
      isFalse,
    );
  });

  testWidgets(
      'guest selects server-local slot and hands off typed review intent',
      (tester) async {
    BookingSelectionContext? intent;
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(
      home: OwnerBookingSelectionV50Page(
        seed: _seed(),
        repository: _FakeRepository(),
        onContinue: (_) => fail('guest must authenticate'),
        onRequireAuthentication: (value) => intent = value,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('Europe/Moscow'), findsWidgets);
    expect(find.textContaining('не удержанный слот'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('booking-date-2026-07-17')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('booking-slot-slot-1')));
    await tester.pumpAndSettle();
    await tester
        .ensureVisible(find.byKey(const ValueKey('booking-open-review')));
    await tester.tap(find.byKey(const ValueKey('booking-open-review')));
    await tester.pumpAndSettle();

    expect(find.text('Проверьте запись'), findsWidgets);
    expect(find.text('Войти и продолжить'), findsOneWidget);
    expect(find.textContaining('Окончательную стоимость'), findsOneWidget);
    await tester
        .ensureVisible(find.byKey(const ValueKey('booking-review-continue')));
    await tester.tap(find.byKey(const ValueKey('booking-review-continue')));

    expect(intent?.petId, isNull);
    expect(intent?.slotId, 'slot-1');
    expect(intent?.expectedSlotVersion, 7);
    expect(intent?.selectedDate, '2026-07-17');
    expect(intent?.priceReference, 'service:service-1');
  });

  testWidgets('offline mode keeps read-only review progression disabled',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(
      home: OwnerBookingSelectionV50Page(
        seed: _seed(),
        repository: _FakeRepository(),
        offline: true,
        onContinue: (_) {},
        onRequireAuthentication: (_) {},
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('booking-date-2026-07-17')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('booking-slot-slot-1')));
    await tester.pumpAndSettle();
    final button = tester.widget<FilledButton>(
        find.byKey(const ValueKey('booking-open-review')));
    expect(button.onPressed, isNull);
    expect(find.textContaining('Подключитесь к интернету'), findsOneWidget);
  });
}

BookingSelectionSeed _seed() => const BookingSelectionSeed(
      clinicId: 'clinic-1',
      clinicName: 'VetHelp Pilot',
      locationId: 'location-1',
      locationAddress: 'Москва, Пилотная 1',
      serviceId: 'service-1',
      serviceName: 'Первичный приём',
    );

class _FakeRepository implements BookingSelectionRepository {
  @override
  Future<BookingSelectionSnapshot> readOptions({
    required String locationId,
    String? serviceId,
    String? doctorId,
    String? selectedPetId,
  }) async =>
      BookingSelectionSnapshot(
        clinicId: 'clinic-1',
        clinicName: 'VetHelp Pilot',
        locationId: locationId,
        locationAddress: 'Москва, Пилотная 1',
        timezone: 'Europe/Moscow',
        serverNow: DateTime.parse('2026-07-16T08:00:00Z'),
        availableDates: const ['2026-07-17'],
        freshness: BookingAvailabilityFreshness.current,
        services: const [
          BookingOptionService(
            id: 'service-1',
            code: 'GENERAL_VISIT',
            displayName: 'Первичный приём',
            durationMinutes: 30,
            price: BookingPriceSnapshot(
              amount: '2500.00',
              currency: 'RUB',
              additionalCostsPossible: true,
              finalPriceStatus: 'CLINIC_AGREEMENT_REQUIRED',
            ),
          ),
        ],
        slots: [
          BookingOptionSlot(
            id: 'slot-1',
            serviceId: 'service-1',
            startsAt: DateTime.parse('2026-07-17T06:30:00Z'),
            endsAt: DateTime.parse('2026-07-17T07:00:00Z'),
            localDate: '2026-07-17',
            localTime: '09:30',
            timezone: 'Europe/Moscow',
            availability: BookingSlotAvailability.available,
            expectedVersion: 7,
            freshness: BookingAvailabilityFreshness.current,
            confirmationMode: BookingConfirmationMode.clinicConfirmation,
            sourceUpdatedAt: DateTime.parse('2026-07-16T07:55:00Z'),
            priceReference: 'service:service-1',
          ),
        ],
        personalizationApplied: selectedPetId != null,
      );
}
