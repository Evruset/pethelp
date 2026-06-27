class CatalogClinic {
  const CatalogClinic({
    required this.id,
    required this.name,
    required this.locationCount,
    required this.serviceCount,
    required this.nextAvailableAt,
    required this.distanceKm,
    required this.telemedAvailable,
    required this.emergencyAvailable,
  });

  final String id;
  final String name;
  final int locationCount;
  final int serviceCount;
  final DateTime? nextAvailableAt;
  final double? distanceKm;
  final bool telemedAvailable;
  final bool emergencyAvailable;
}

class CatalogClinicFilters {
  const CatalogClinicFilters({
    this.query,
    this.serviceCode,
    this.latitude,
    this.longitude,
    this.radiusKm,
    this.availableFrom,
    this.availableTo,
    this.openNow,
    this.telemedAvailable,
    this.emergencyCapability,
    this.sort = 'soonest',
  });

  final String? query;
  final String? serviceCode;
  final double? latitude;
  final double? longitude;
  final double? radiusKm;
  final DateTime? availableFrom;
  final DateTime? availableTo;
  final bool? openNow;
  final bool? telemedAvailable;
  final String? emergencyCapability;
  final String sort;

  CatalogClinicFilters copyWith({
    String? query,
    bool clearQuery = false,
    String? serviceCode,
    bool clearServiceCode = false,
    double? latitude,
    double? longitude,
    double? radiusKm,
    bool clearGeo = false,
    DateTime? availableFrom,
    DateTime? availableTo,
    bool clearAvailability = false,
    bool? openNow,
    bool? telemedAvailable,
    String? emergencyCapability,
    bool clearEmergencyCapability = false,
    String? sort,
  }) {
    return CatalogClinicFilters(
      query: clearQuery ? null : query ?? this.query,
      serviceCode: clearServiceCode ? null : serviceCode ?? this.serviceCode,
      latitude: clearGeo ? null : latitude ?? this.latitude,
      longitude: clearGeo ? null : longitude ?? this.longitude,
      radiusKm: clearGeo ? null : radiusKm ?? this.radiusKm,
      availableFrom:
          clearAvailability ? null : availableFrom ?? this.availableFrom,
      availableTo: clearAvailability ? null : availableTo ?? this.availableTo,
      openNow: openNow ?? this.openNow,
      telemedAvailable: telemedAvailable ?? this.telemedAvailable,
      emergencyCapability: clearEmergencyCapability
          ? null
          : emergencyCapability ?? this.emergencyCapability,
      sort: sort ?? this.sort,
    );
  }
}

class CatalogClinicDetail extends CatalogClinic {
  const CatalogClinicDetail({
    required super.id,
    required super.name,
    required super.locationCount,
    required super.serviceCount,
    required super.nextAvailableAt,
    required super.distanceKm,
    required super.telemedAvailable,
    required super.emergencyAvailable,
    required this.locations,
  });

  final List<CatalogLocation> locations;
}

class CatalogLocation {
  const CatalogLocation({
    required this.clinicId,
    required this.clinicName,
    required this.locationId,
    required this.address,
    required this.phone,
    required this.latitude,
    required this.longitude,
    required this.hasOpenSlots,
    required this.observedAt,
  });

  final String clinicId;
  final String clinicName;
  final String locationId;
  final String address;
  final String? phone;
  final double? latitude;
  final double? longitude;
  final bool hasOpenSlots;
  final DateTime observedAt;
}

class CatalogService {
  const CatalogService({
    required this.id,
    required this.code,
    required this.displayName,
    required this.durationMinutes,
    required this.priceAmount,
    required this.currency,
  });

  final String id;
  final String code;
  final String displayName;
  final int durationMinutes;
  final String priceAmount;
  final String currency;
}

class CatalogAvailabilitySlot {
  const CatalogAvailabilitySlot({
    required this.id,
    required this.startsAt,
    required this.endsAt,
    required this.remainingCapacity,
    required this.serviceId,
    required this.serviceName,
  });

  final String id;
  final DateTime startsAt;
  final DateTime endsAt;
  final int remainingCapacity;
  final String? serviceId;
  final String? serviceName;
}

class CatalogBookingSelection {
  const CatalogBookingSelection({
    required this.location,
    required this.service,
  });

  final CatalogLocation location;
  final CatalogService service;
}
