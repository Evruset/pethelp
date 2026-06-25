class CatalogLocation {
  const CatalogLocation({
    required this.clinicId,
    required this.clinicName,
    required this.locationId,
    required this.address,
    required this.phone,
    required this.hasOpenSlots,
    required this.observedAt,
  });

  final String clinicId;
  final String clinicName;
  final String locationId;
  final String address;
  final String? phone;
  final bool hasOpenSlots;
  final DateTime observedAt;
}
