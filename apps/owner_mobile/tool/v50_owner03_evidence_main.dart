import 'dart:async';

import 'package:flutter/material.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/owner_catalog_v50_feature_flags.dart';
import 'package:vethelp_owner_mobile/features/catalog/owner_catalog_v50_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  final state = Uri.base.queryParameters['state'] ?? 'CATALOG_READY_LIST';
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: VetHelpTheme.light(),
    builder: VetHelpTheme.frameBuilder,
    home: _EvidenceState(state),
  ));
}

class _EvidenceState extends StatelessWidget {
  const _EvidenceState(this.state);
  final String state;

  @override
  Widget build(BuildContext context) {
    final repository = _EvidenceCatalogRepository(state);
    final locationState = state == 'CATALOG_LOCATION_DENIED'
        ? OwnerCatalogLocationState.denied
        : OwnerCatalogLocationState.available;
    final initialLocation = switch (state) {
      'CLINIC_READY' ||
      'CLINIC_STALE_AVAILABILITY' ||
      'CLINIC_NO_SLOTS' =>
        '/owner/clinics/clinic-1',
      'DOCTORS_READY' || 'DOCTORS_EMPTY' => '/owner/clinics/clinic-1/doctors',
      'DOCTOR_PROFILE' => '/owner/doctors/doctor-1',
      _ => '/owner/catalog',
    };
    final page = OwnerCatalogV50Page(
      repository: repository,
      flags: const OwnerCatalogV50Flags(
          catalog: true, clinicDetail: true, doctorDiscovery: true),
      onSelected: (_) {},
      selectedPetId: 'pet-1',
      selectedPetName: 'Барсик',
      initialLocation: initialLocation,
      initialMapMode: state == 'CATALOG_READY_MAP',
      initialFilters: state == 'CATALOG_FILTERED'
          ? const CatalogClinicFilters(
              serviceCode: 'GENERAL_VISIT', telemedAvailable: true)
          : const CatalogClinicFilters(),
      locationState: locationState,
    );
    return OwnerV50AdaptiveShell(
      home: const SizedBox.shrink(),
      clinics: page,
      appointments: const SizedBox.shrink(),
      pets: const SizedBox.shrink(),
      selectedIndex: 1,
      onDestinationSelected: (_) {},
      onEmergency: () {},
      onNotifications: () {},
      onPetContextPressed: () {},
      selectedPetName: 'Барсик',
    );
  }
}

class _EvidenceCatalogRepository extends PublicCatalogRepository {
  _EvidenceCatalogRepository(this.state);
  final String state;

  static final current = CatalogAvailabilitySummary(
    sourceUpdatedAt: DateTime.utc(2026, 7, 15, 9, 55),
    serverNow: DateTime.utc(2026, 7, 15, 10),
    freshness: CatalogAvailabilityFreshness.current,
    confirmationMode: CatalogConfirmationMode.clinicConfirmation,
  );
  static final stale = CatalogAvailabilitySummary(
    sourceUpdatedAt: DateTime.utc(2026, 7, 15, 6),
    serverNow: DateTime.utc(2026, 7, 15, 10),
    freshness: CatalogAvailabilityFreshness.stale,
    confirmationMode: CatalogConfirmationMode.alternativePossible,
  );
  static final location = CatalogLocation(
    clinicId: 'clinic-1',
    clinicName: 'ВетКлиника Доверие',
    locationId: 'location-1',
    address: 'Москва, Тверская улица, 10',
    phone: '+7 495 000-00-00',
    latitude: 55.75,
    longitude: 37.61,
    hasOpenSlots: true,
    observedAt: DateTime.utc(2026, 7, 15, 10),
  );

  CatalogAvailabilitySummary get availability =>
      state.contains('STALE') ? stale : current;

  CatalogClinic get clinic => CatalogClinic(
        id: 'clinic-1',
        name: 'ВетКлиника Доверие',
        locationCount: 1,
        serviceCount: state == 'CLINIC_NO_SLOTS' ? 0 : 3,
        nextAvailableAt: state == 'CLINIC_NO_SLOTS'
            ? null
            : DateTime.utc(2026, 7, 15, 11, 30),
        distanceKm: 1.2,
        telemedAvailable: true,
        emergencyAvailable: true,
        doctorCount: 2,
        priceFrom: '1500.00',
        availability: availability,
        fitReasons: const [
          'Есть ближайшее подтверждаемое окно',
          'Доступны подтверждённые услуги',
          'Есть ветеринарные специалисты',
        ],
      );

  @override
  Future<List<CatalogClinic>> listClinics(
      {String? query, CatalogClinicFilters? filters}) {
    if (state == 'CATALOG_LOADING') {
      return Completer<List<CatalogClinic>>().future;
    }
    if (state == 'CATALOG_EMPTY') return Future.value(const []);
    if (state == 'CATALOG_OFFLINE_ERROR') {
      return Future.error(const PublicCatalogApiException(503, 'OFFLINE'));
    }
    return Future.value([clinic]);
  }

  @override
  Future<CatalogClinicDetail> readClinic(String clinicId) async =>
      CatalogClinicDetail(
        id: clinic.id,
        name: clinic.name,
        locationCount: 1,
        serviceCount: clinic.serviceCount,
        nextAvailableAt: clinic.nextAvailableAt,
        distanceKm: clinic.distanceKm,
        telemedAvailable: true,
        emergencyAvailable: true,
        doctorCount: 2,
        priceFrom: '1500.00',
        availability: availability,
        fitReasons: clinic.fitReasons,
        locations: [location],
      );

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async =>
      [location];

  @override
  Future<List<CatalogService>> listLocationServices(String locationId) async =>
      state == 'CLINIC_NO_SLOTS'
          ? const []
          : const [
              CatalogService(
                  id: 'service-1',
                  code: 'GENERAL_VISIT',
                  displayName: 'Первичный приём',
                  durationMinutes: 30,
                  priceAmount: '1500.00',
                  currency: 'RUB'),
              CatalogService(
                  id: 'service-2',
                  code: 'VACCINATION',
                  displayName: 'Вакцинация',
                  durationMinutes: 20,
                  priceAmount: '2100.00',
                  currency: 'RUB'),
            ];

  @override
  Future<List<CatalogAvailabilitySlot>> readAvailability(
          {required String locationId,
          required DateTime from,
          required DateTime to}) async =>
      const [];

  @override
  Future<List<CatalogDoctor>> listDoctors(
          {required String clinicId,
          String? locationId,
          String? serviceCode}) async =>
      state == 'DOCTORS_EMPTY'
          ? const []
          : [await readDoctor('doctor-1'), await readDoctor('doctor-2')];

  @override
  Future<CatalogDoctor> readDoctor(String doctorId) async => CatalogDoctor(
        id: doctorId,
        displayName: doctorId == 'doctor-2' ? 'Михаил Соколов' : 'Анна Петрова',
        title: 'Ветеринарный врач',
        clinicId: 'clinic-1',
        clinicName: 'ВетКлиника Доверие',
        locationId: 'location-1',
        locationAddress: 'Москва, Тверская улица, 10',
        nextAvailableAt: DateTime.utc(2026, 7, 15, 11, 30),
        availability: availability,
      );
}
