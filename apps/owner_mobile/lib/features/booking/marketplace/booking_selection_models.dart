enum BookingAvailabilityFreshness { current, aging, stale, unavailable }

enum BookingConfirmationMode {
  instant,
  clinicConfirmation,
  alternativePossible,
}

enum BookingSlotAvailability { available, requestOnly, stale }

class BookingSelectionSeed {
  const BookingSelectionSeed({
    required this.clinicId,
    required this.clinicName,
    required this.locationId,
    required this.locationAddress,
    required this.serviceId,
    required this.serviceName,
    this.doctorId,
    this.petId,
    this.petName,
  });

  final String clinicId;
  final String clinicName;
  final String locationId;
  final String locationAddress;
  final String serviceId;
  final String serviceName;
  final String? doctorId;
  final String? petId;
  final String? petName;
}

class BookingPriceSnapshot {
  const BookingPriceSnapshot({
    required this.amount,
    required this.currency,
    required this.additionalCostsPossible,
    required this.finalPriceStatus,
  });

  final String amount;
  final String currency;
  final bool additionalCostsPossible;
  final String finalPriceStatus;
}

class BookingOptionService {
  const BookingOptionService({
    required this.id,
    required this.code,
    required this.displayName,
    required this.durationMinutes,
    required this.price,
  });

  final String id;
  final String code;
  final String displayName;
  final int durationMinutes;
  final BookingPriceSnapshot price;
}

class BookingOptionSlot {
  const BookingOptionSlot({
    required this.id,
    required this.serviceId,
    required this.startsAt,
    required this.endsAt,
    required this.localDate,
    required this.localTime,
    required this.timezone,
    required this.availability,
    required this.expectedVersion,
    required this.freshness,
    required this.confirmationMode,
    required this.sourceUpdatedAt,
    required this.priceReference,
  });

  final String id;
  final String serviceId;
  final DateTime startsAt;
  final DateTime endsAt;
  final String localDate;
  final String localTime;
  final String timezone;
  final BookingSlotAvailability availability;
  final int expectedVersion;
  final BookingAvailabilityFreshness freshness;
  final BookingConfirmationMode confirmationMode;
  final DateTime sourceUpdatedAt;
  final String priceReference;
}

class BookingSelectionSnapshot {
  const BookingSelectionSnapshot({
    required this.clinicId,
    required this.clinicName,
    required this.locationId,
    required this.locationAddress,
    required this.timezone,
    required this.serverNow,
    required this.availableDates,
    required this.freshness,
    required this.services,
    required this.slots,
    required this.personalizationApplied,
  });

  final String clinicId;
  final String clinicName;
  final String locationId;
  final String locationAddress;
  final String timezone;
  final DateTime serverNow;
  final List<String> availableDates;
  final BookingAvailabilityFreshness freshness;
  final List<BookingOptionService> services;
  final List<BookingOptionSlot> slots;
  final bool personalizationApplied;
}

class BookingSelectionContext {
  const BookingSelectionContext({
    required this.petId,
    required this.clinicId,
    required this.locationId,
    required this.serviceId,
    required this.doctorId,
    required this.selectedDate,
    required this.slotId,
    required this.expectedSlotVersion,
    required this.confirmationMode,
    required this.priceSnapshot,
    required this.priceReference,
    required this.availabilityFreshness,
  });

  final String? petId;
  final String clinicId;
  final String locationId;
  final String serviceId;
  final String? doctorId;
  final String selectedDate;
  final String slotId;
  final int expectedSlotVersion;
  final BookingConfirmationMode confirmationMode;
  final BookingPriceSnapshot priceSnapshot;
  final String priceReference;
  final BookingAvailabilityFreshness availabilityFreshness;
}
