import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/owner_catalog_v50_feature_flags.dart';
import 'package:vethelp_owner_mobile/features/catalog/owner_catalog_v50_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';

void main() {
  test('catalog feature flags are default-off and preserve dependency order',
      () {
    expect(ownerCatalogV50Flags(shellEnabled: true).catalog, isFalse);
    expect(
      resolveOwnerV50ClinicDetailFlag(
        value: 'true',
        shellEnabled: true,
        catalogEnabled: false,
      ),
      isFalse,
    );
    expect(
      resolveOwnerV50DoctorDiscoveryFlag(
        value: 'true',
        shellEnabled: true,
        clinicDetailEnabled: false,
      ),
      isFalse,
    );
  });

  testWidgets('guest catalog preserves list fallback when location is denied',
      (tester) async {
    await _setDesktop(tester);
    await tester.pumpWidget(_app(
      repository: _FakeCatalogRepository(),
      locationState: OwnerCatalogLocationState.denied,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Выбор клиники'), findsOneWidget);
    expect(find.text('Геопозиция отключена'), findsOneWidget);
    expect(
        find.byKey(const ValueKey('catalog-clinic-clinic-1')), findsOneWidget);
    expect(find.textContaining('Выберите питомца'), findsWidgets);

    await tester.tap(find.byKey(const ValueKey('catalog-mode-toggle')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('catalog-map-mode')), findsOneWidget);
    expect(
        find.text('Карта недоступна — полный список сохранён'), findsOneWidget);
  });

  testWidgets('clinic and doctor discovery produce a typed booking intent',
      (tester) async {
    await _setDesktop(tester);
    CatalogBookingSelection? selection;
    await tester.pumpWidget(_app(
      repository: _FakeCatalogRepository(),
      onSelected: (value) => selection = value,
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('catalog-clinic-clinic-1')));
    await tester.pumpAndSettle();
    expect(find.text('Карточка клиники'), findsOneWidget);
    expect(find.text('Расписание обновлено недавно'), findsWidgets);

    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('clinic-booking-action')));
    expect(selection, isNotNull);
    expect(selection!.location.locationId, 'location-1');
    expect(selection!.service.code, 'GENERAL_VISIT');

    await tester.tap(find.byKey(const ValueKey('clinic-doctors-action')));
    await tester.pumpAndSettle();
    expect(find.text('Выберите ветеринара'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('doctor-card-doctor-1')));
    await tester.pumpAndSettle();
    expect(find.text('Анна Петрова'), findsWidgets);
    expect(find.text('Ветеринарный врач'), findsWidgets);
    expect(find.textContaining('нет отдельного публичного контракта'),
        findsOneWidget);
  });
}

Future<void> _setDesktop(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1440, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Widget _app({
  required PublicCatalogRepository repository,
  ValueChanged<CatalogBookingSelection>? onSelected,
  OwnerCatalogLocationState locationState = OwnerCatalogLocationState.available,
}) =>
    MaterialApp(
      home: Scaffold(
        body: OwnerCatalogV50Page(
          repository: repository,
          flags: const OwnerCatalogV50Flags(
            catalog: true,
            clinicDetail: true,
            doctorDiscovery: true,
          ),
          onSelected: onSelected ?? (_) {},
          locationState: locationState,
        ),
      ),
    );

class _FakeCatalogRepository extends PublicCatalogRepository {
  static final _availability = CatalogAvailabilitySummary(
    sourceUpdatedAt: DateTime.utc(2026, 7, 15, 9, 55),
    serverNow: DateTime.utc(2026, 7, 15, 10),
    freshness: CatalogAvailabilityFreshness.current,
    confirmationMode: CatalogConfirmationMode.clinicConfirmation,
  );
  static final _location = CatalogLocation(
    clinicId: 'clinic-1',
    clinicName: 'ВетКлиника Доверие',
    locationId: 'location-1',
    address: 'Москва, Тверская, 10',
    phone: '+7 495 000-00-00',
    latitude: 55.75,
    longitude: 37.61,
    hasOpenSlots: true,
    observedAt: DateTime.utc(2026, 7, 15, 10),
  );

  CatalogClinic get clinic => CatalogClinic(
        id: 'clinic-1',
        name: 'ВетКлиника Доверие',
        locationCount: 1,
        serviceCount: 1,
        nextAvailableAt: DateTime.utc(2026, 7, 15, 11),
        distanceKm: 1.2,
        telemedAvailable: true,
        emergencyAvailable: false,
        doctorCount: 1,
        priceFrom: '1500.00',
        availability: _availability,
        fitReasons: const ['Есть ветеринарные специалисты'],
      );

  @override
  Future<List<CatalogClinic>> listClinics(
          {String? query, CatalogClinicFilters? filters}) async =>
      [clinic];

  @override
  Future<CatalogClinicDetail> readClinic(String clinicId) async =>
      CatalogClinicDetail(
        id: clinic.id,
        name: clinic.name,
        locationCount: 1,
        serviceCount: 1,
        nextAvailableAt: clinic.nextAvailableAt,
        distanceKm: clinic.distanceKm,
        telemedAvailable: true,
        emergencyAvailable: false,
        doctorCount: 1,
        priceFrom: '1500.00',
        availability: _availability,
        fitReasons: clinic.fitReasons,
        locations: [_location],
      );

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async =>
      [_location];

  @override
  Future<List<CatalogService>> listLocationServices(String locationId) async =>
      const [
        CatalogService(
          id: 'service-1',
          code: 'GENERAL_VISIT',
          displayName: 'Первичный приём',
          durationMinutes: 30,
          priceAmount: '1500.00',
          currency: 'RUB',
        ),
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
      [await readDoctor('doctor-1')];

  @override
  Future<CatalogDoctor> readDoctor(String doctorId) async => CatalogDoctor(
        id: 'doctor-1',
        displayName: 'Анна Петрова',
        title: 'Ветеринарный врач',
        clinicId: 'clinic-1',
        clinicName: 'ВетКлиника Доверие',
        locationId: 'location-1',
        locationAddress: 'Москва, Тверская, 10',
        nextAvailableAt: DateTime.utc(2026, 7, 15, 11),
        availability: _availability,
      );
}
