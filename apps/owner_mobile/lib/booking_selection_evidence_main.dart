import 'package:flutter/material.dart';

import 'features/booking/marketplace/booking_selection_models.dart';
import 'features/booking/marketplace/booking_selection_repository.dart';
import 'features/booking/marketplace/booking_marketplace_repository.dart';
import 'features/booking/marketplace/booking_hold_status_page.dart';
import 'features/booking/marketplace/owner_booking_selection_v50_page.dart';
import 'ui/vethelp_ios_theme.dart';

void main() => runApp(const _EvidenceApp());

class _EvidenceApp extends StatelessWidget {
  const _EvidenceApp();

  @override
  Widget build(BuildContext context) {
    final state = Uri.base.queryParameters['state'] ?? 'SERVICE_READY';
    if (state.startsWith('BOOKING_')) {
      return MaterialApp(
        theme: VetHelpTheme.light(),
        home: BookingHoldStatusPage(
          holdId: '11111111-1111-4111-8111-111111111111',
          initialState: _holdState(state),
          clinicName: 'Ветеринарная клиника «Добрые лапы»',
          locationAddress: 'Москва, ул. Пилотная, 1',
          serviceName: 'Первичный приём',
          petName: 'Барсик',
          offline: state == 'BOOKING_OFFLINE_STALE',
          readHold: (_) async => _holdSnapshot(_holdState(state)),
        ),
      );
    }
    final review = state.startsWith('REVIEW_') || state.startsWith('CREATE_HOLD_');
    final hasDate = review || const {
      'DATE_READY', 'SLOT_READY', 'SLOT_SELECTED', 'SLOT_STALE', 'SLOT_EMPTY',
    }.contains(state);
    final guest = state == 'REVIEW_GUEST_AUTH_REQUIRED';
    final intent = hasDate
        ? BookingSelectionContext(
            petId: guest ? null : 'pet-evidence',
            clinicId: 'clinic-evidence',
            locationId: 'location-evidence',
            serviceId: 'service-evidence',
            doctorId: null,
            selectedDate: '2026-07-17',
            slotId: state == 'SLOT_SELECTED' || state == 'SLOT_STALE' || review
                ? 'slot-evidence'
                : 'unselected-slot',
            expectedSlotVersion: 7,
            confirmationMode: BookingConfirmationMode.clinicConfirmation,
            priceSnapshot: _price,
            priceReference: 'service:service-evidence',
            availabilityFreshness: state == 'REVIEW_OFFLINE_STALE'
                ? BookingAvailabilityFreshness.stale
                : BookingAvailabilityFreshness.current,
          )
        : null;
    return MaterialApp(
      theme: VetHelpTheme.light(),
      home: OwnerBookingSelectionV50Page(
        seed: BookingSelectionSeed(
          clinicId: 'clinic-evidence',
          clinicName: 'Ветеринарная клиника «Добрые лапы»',
          locationId: 'location-evidence',
          locationAddress: 'Москва, ул. Пилотная, 1',
          serviceId: 'service-evidence',
          serviceName: 'Первичный приём',
          petId: guest ? null : 'pet-evidence',
          petName: guest ? null : 'Барсик',
        ),
        repository: _EvidenceRepository(state),
        initialIntent: intent,
        restoreIntentToReview: review,
        offline: state == 'REVIEW_OFFLINE_STALE',
        holdRepository: _EvidenceHoldRepository(state),
        createHoldEnabled: state.startsWith('CREATE_HOLD_'),
        bookingStatusEnabled: state.startsWith('CREATE_HOLD_'),
        initialSubmissionState: switch (state) {
          'CREATE_HOLD_SUBMITTING' => BookingReviewSubmissionState.submitting,
          'CREATE_HOLD_SOFT_RETRY' => BookingReviewSubmissionState.softRetry,
          'CREATE_HOLD_FINAL_CONFLICT' => BookingReviewSubmissionState.finalConflict,
          _ => BookingReviewSubmissionState.idle,
        },
        onContinue: (_) {},
        onRequireAuthentication: (_) {},
      ),
    );
  }
}

String _holdState(String state) => switch (state) {
      'BOOKING_LOCAL_HOLD' => 'MANUAL_CONFIRM_PENDING',
      'BOOKING_MANUAL_PENDING' => 'MANUAL_CONFIRM_PENDING',
      'BOOKING_MIS_PENDING' => 'MIS_RESERVATION_PENDING',
      'BOOKING_CONFIRMED' => 'CONFIRMED',
      'BOOKING_FAILED' => 'MIS_BOOKING_FAILED',
      'BOOKING_EXPIRED' => 'EXPIRED',
      'BOOKING_RELEASED' => 'RELEASED',
      'BOOKING_OFFLINE_STALE' => 'MANUAL_CONFIRM_PENDING',
      _ => 'MANUAL_CONFIRM_PENDING',
    };

BookingHoldSnapshot _holdSnapshot(String state) => BookingHoldSnapshot(
      holdId: '11111111-1111-4111-8111-111111111111',
      slotId: '22222222-2222-4222-8222-222222222222',
      state: state,
      expiresAt: DateTime.parse('2026-07-16T08:10:00Z'),
      startsAt: DateTime.parse('2026-07-17T06:30:00Z'),
      endsAt: DateTime.parse('2026-07-17T07:00:00Z'),
      serverNow: DateTime.parse('2026-07-16T08:04:30Z'),
      aggregateVersion: 3,
      confirmationMode: state.startsWith('MIS_') ? 'MIS' : 'MANUAL',
      lastUpdatedAt: DateTime.parse('2026-07-16T08:04:00Z'),
    );

class _EvidenceHoldRepository implements BookingHoldCommandRepository {
  const _EvidenceHoldRepository(this.state);
  final String state;

  @override
  Future<CreatedBookingHold> createSelectionHold(CreateBookingHoldRequest request) async {
    if (state == 'CREATE_HOLD_SUBMITTING') {
      await Future<void>.delayed(const Duration(minutes: 1));
    }
    if (state == 'CREATE_HOLD_SOFT_RETRY') {
      throw const BookingMarketplaceApiException(statusCode: 409, code: 'SLOT_LOCKED_RETRY');
    }
    if (state == 'CREATE_HOLD_FINAL_CONFLICT') {
      throw const BookingMarketplaceApiException(statusCode: 409, code: 'SLOT_ALREADY_TAKEN');
    }
    return CreatedBookingHold(
      holdId: '11111111-1111-4111-8111-111111111111',
      state: 'MANUAL_CONFIRM_PENDING',
      slotId: request.selection.slotId,
      expiresAt: DateTime.parse('2026-07-16T08:10:00Z'),
      correlationId: request.correlationId,
    );
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async => _holdSnapshot('MANUAL_CONFIRM_PENDING');

  @override
  Future<CreatedBookingHold> createHold({required String slotId, required String petId, required String correlationId, required String idempotencyKey}) =>
      throw UnimplementedError();

  @override
  Future<List<BookingSlot>> listSlots({required String clinicLocationId, required String serviceId, required DateTime from, required DateTime to}) async => const [];
}

const _price = BookingPriceSnapshot(
  amount: '2500',
  currency: '₽',
  additionalCostsPossible: true,
  finalPriceStatus: 'CLINIC_AGREEMENT_REQUIRED',
);

class _EvidenceRepository implements BookingSelectionRepository {
  const _EvidenceRepository(this.state);
  final String state;

  @override
  Future<BookingSelectionSnapshot> readOptions({
    required String locationId,
    String? serviceId,
    String? doctorId,
    String? selectedPetId,
  }) async {
    final serviceEmpty = state == 'SERVICE_EMPTY';
    final dateEmpty = state == 'DATE_EMPTY';
    final slotEmpty = state == 'SLOT_EMPTY';
    final stale = state == 'SLOT_STALE' || state == 'REVIEW_OFFLINE_STALE';
    return BookingSelectionSnapshot(
      clinicId: 'clinic-evidence',
      clinicName: 'Ветеринарная клиника «Добрые лапы»',
      locationId: locationId,
      locationAddress: 'Москва, ул. Пилотная, 1',
      timezone: 'Europe/Moscow',
      serverNow: DateTime.parse('2026-07-16T08:00:00Z'),
      availableDates: dateEmpty ? const [] : const ['2026-07-17', '2026-07-18'],
      freshness: stale
          ? BookingAvailabilityFreshness.stale
          : BookingAvailabilityFreshness.current,
      services: serviceEmpty
          ? const []
          : const [
              BookingOptionService(
                id: 'service-evidence',
                code: 'GENERAL_VISIT',
                displayName: 'Первичный приём',
                durationMinutes: 30,
                price: _price,
              ),
              BookingOptionService(
                id: 'service-vaccine',
                code: 'VACCINATION',
                displayName: 'Вакцинация',
                durationMinutes: 20,
                price: BookingPriceSnapshot(
                  amount: '1800',
                  currency: '₽',
                  additionalCostsPossible: true,
                  finalPriceStatus: 'CLINIC_AGREEMENT_REQUIRED',
                ),
              ),
            ],
      slots: slotEmpty || dateEmpty
          ? const []
          : [
              BookingOptionSlot(
                id: 'slot-evidence',
                serviceId: 'service-evidence',
                startsAt: DateTime.parse('2026-07-17T06:30:00Z'),
                endsAt: DateTime.parse('2026-07-17T07:00:00Z'),
                localDate: '2026-07-17',
                localTime: '09:30',
                timezone: 'Europe/Moscow',
                availability: stale
                    ? BookingSlotAvailability.stale
                    : BookingSlotAvailability.available,
                expectedVersion: 7,
                freshness: stale
                    ? BookingAvailabilityFreshness.stale
                    : BookingAvailabilityFreshness.current,
                confirmationMode: BookingConfirmationMode.clinicConfirmation,
                sourceUpdatedAt: DateTime.parse('2026-07-16T07:55:00Z'),
                priceReference: 'service:service-evidence',
              ),
              BookingOptionSlot(
                id: 'slot-request',
                serviceId: 'service-evidence',
                startsAt: DateTime.parse('2026-07-17T08:00:00Z'),
                endsAt: DateTime.parse('2026-07-17T08:30:00Z'),
                localDate: '2026-07-17',
                localTime: '11:00',
                timezone: 'Europe/Moscow',
                availability: BookingSlotAvailability.requestOnly,
                expectedVersion: 3,
                freshness: BookingAvailabilityFreshness.aging,
                confirmationMode: BookingConfirmationMode.alternativePossible,
                sourceUpdatedAt: DateTime.parse('2026-07-16T07:10:00Z'),
                priceReference: 'service:service-evidence',
              ),
            ],
      personalizationApplied: selectedPetId != null,
    );
  }
}
