import 'package:flutter/foundation.dart';

const ownerV50CatalogFlagName = 'OWNER_V50_CATALOG';
const ownerV50ClinicDetailFlagName = 'OWNER_V50_CLINIC_DETAIL';
const ownerV50DoctorDiscoveryFlagName = 'OWNER_V50_DOCTOR_DISCOVERY';

class OwnerCatalogV50Flags {
  const OwnerCatalogV50Flags({
    required this.catalog,
    required this.clinicDetail,
    required this.doctorDiscovery,
  });

  final bool catalog;
  final bool clinicDetail;
  final bool doctorDiscovery;
}

bool resolveOwnerV50CatalogFlag({String? value, required bool shellEnabled}) =>
    value == 'true' && shellEnabled;

bool resolveOwnerV50ClinicDetailFlag({
  String? value,
  required bool shellEnabled,
  required bool catalogEnabled,
}) =>
    value == 'true' && shellEnabled && catalogEnabled;

bool resolveOwnerV50DoctorDiscoveryFlag({
  String? value,
  required bool shellEnabled,
  required bool clinicDetailEnabled,
}) =>
    value == 'true' && shellEnabled && clinicDetailEnabled;

bool _reportedInvalidCatalogFlags = false;

OwnerCatalogV50Flags ownerCatalogV50Flags({required bool shellEnabled}) {
  const catalogRequested = String.fromEnvironment(ownerV50CatalogFlagName);
  const clinicRequested = String.fromEnvironment(ownerV50ClinicDetailFlagName);
  const doctorRequested =
      String.fromEnvironment(ownerV50DoctorDiscoveryFlagName);
  final catalog = resolveOwnerV50CatalogFlag(
    value: catalogRequested,
    shellEnabled: shellEnabled,
  );
  final clinicDetail = resolveOwnerV50ClinicDetailFlag(
    value: clinicRequested,
    shellEnabled: shellEnabled,
    catalogEnabled: catalog,
  );
  final doctorDiscovery = resolveOwnerV50DoctorDiscoveryFlag(
    value: doctorRequested,
    shellEnabled: shellEnabled,
    clinicDetailEnabled: clinicDetail,
  );
  if (!_reportedInvalidCatalogFlags &&
      ((catalogRequested == 'true' && !catalog) ||
          (clinicRequested == 'true' && !clinicDetail) ||
          (doctorRequested == 'true' && !doctorDiscovery))) {
    _reportedInvalidCatalogFlags = true;
    debugPrint(
      'Owner V50 catalog flags require the V50 shell and their parent flags; using the safe legacy flow.',
    );
  }
  return OwnerCatalogV50Flags(
    catalog: catalog,
    clinicDetail: clinicDetail,
    doctorDiscovery: doctorDiscovery,
  );
}
