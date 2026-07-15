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

    await tester.tap(find.text('Карта'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('catalog-map-mode')), findsOneWidget);
    expect(
        find.text('Карта недоступна — полный список сохранён'), findsOneWidget);
  });

  testWidgets('mobile filters stay reachable and local map selection is synced',
      (tester) async {
    await _setMobile(tester);
    await tester.pumpWidget(_app(repository: _FakeCatalogRepository()));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('catalog-filter-open')), findsOneWidget);
    expect(
        find.byKey(const ValueKey('catalog-filter-service')), findsOneWidget);
    expect(find.byKey(const ValueKey('catalog-filter-telemed')), findsNothing);
    expect(
        tester
            .getSize(find.byKey(const ValueKey('catalog-filter-open')))
            .height,
        greaterThanOrEqualTo(44));

    await tester.tap(find.byKey(const ValueKey('catalog-filter-open')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('catalog-filters-reset')), findsOneWidget);
    expect(
        tester
            .widget<FilterChip>(
                find.byKey(const ValueKey('catalog-filter-open')))
            .selected,
        isTrue);

    await tester
        .ensureVisible(find.byKey(const ValueKey('catalog-secondary-filters')));
    await tester.tap(find.byKey(const ValueKey('catalog-secondary-filters')));
    await tester.pump();
    expect(
        find.byKey(const ValueKey('catalog-filter-telemed')), findsOneWidget);
    expect(
        tester
            .getSize(find.byKey(const ValueKey('catalog-secondary-filters')))
            .height,
        greaterThanOrEqualTo(44));

    await tester
        .ensureVisible(find.byKey(const ValueKey('catalog-filters-reset')));
    await tester.tap(find.byKey(const ValueKey('catalog-filters-reset')));
    await tester.pumpAndSettle();
    expect(
        tester
            .widget<FilterChip>(
                find.byKey(const ValueKey('catalog-filter-open')))
            .selected,
        isFalse);

    await tester.ensureVisible(find.text('Карта'));
    await tester.tap(find.text('Карта'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('catalog-map-mode')), findsOneWidget);
    expect(find.byKey(const ValueKey('catalog-map-card-clinic-1-selected')),
        findsOneWidget);

    await tester.ensureVisible(
        find.byKey(const ValueKey('catalog-map-marker-clinic-2')));
    await tester.tap(find.byKey(const ValueKey('catalog-map-marker-clinic-2')));
    await tester.pump();
    expect(find.byKey(const ValueKey('catalog-map-card-clinic-2-selected')),
        findsOneWidget);
    expect(find.byKey(const ValueKey('catalog-map-card-clinic-1-idle')),
        findsOneWidget);
  });

  testWidgets('catalog and clinic expose decision facts in safe visual order',
      (tester) async {
    await _setMobile(tester);
    await tester.pumpWidget(_app(repository: _FakeCatalogRepository()));
    await tester.pumpAndSettle();

    final mobileMedia =
        find.byKey(const ValueKey('catalog-clinic-media-clinic-1'));
    expect(tester.getSize(mobileMedia).height, 112);
    expect(tester.getSize(mobileMedia).width, greaterThan(280));
    final fitY = tester.getTopLeft(find.text('Почему подходит').first).dy;
    final availabilityY = tester
        .getTopLeft(
            find.byKey(const ValueKey('catalog-card-availability')).first)
        .dy;
    final confirmationY = tester
        .getTopLeft(
            find.byKey(const ValueKey('catalog-card-confirmation')).first)
        .dy;
    final priceY = tester
        .getTopLeft(find.byKey(const ValueKey('catalog-card-price')).first)
        .dy;
    expect(find.byKey(const ValueKey('catalog-card-freshness')), findsWidgets);
    expect(find.text('Расписание обновлено недавно'), findsWidgets);
    expect(fitY, lessThan(availabilityY));
    expect(availabilityY, lessThan(confirmationY));
    expect(confirmationY, lessThan(priceY));

    await tester
        .ensureVisible(find.byKey(const ValueKey('catalog-clinic-clinic-1')));
    await tester.tap(find.byKey(const ValueKey('catalog-clinic-clinic-1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('clinic-compact-hero')), findsOneWidget);
    expect(find.text('Выбрать услугу'), findsOneWidget);
    expect(find.text('Анна Петрова'), findsOneWidget);
    expect(find.textContaining('Ветеринарный врач ·'), findsOneWidget);
    final heroY =
        tester.getTopLeft(find.byKey(const ValueKey('clinic-compact-hero'))).dy;
    final availabilitySectionY = tester
        .getTopLeft(find.byKey(const ValueKey('clinic-availability-section')))
        .dy;
    final doctorsY = tester
        .getTopLeft(find.byKey(const ValueKey('clinic-doctors-section')))
        .dy;
    final contactY = tester
        .getTopLeft(find.byKey(const ValueKey('clinic-contact-section')))
        .dy;
    final freshnessY = tester
        .getTopLeft(find.byKey(const ValueKey('clinic-freshness-section')))
        .dy;
    expect(heroY, lessThan(availabilitySectionY));
    expect(availabilitySectionY, lessThan(doctorsY));
    expect(doctorsY, lessThan(contactY));
    expect(contactY, lessThan(freshnessY));
    expect(find.textContaining('итоговая стоимость известна'), findsOneWidget);
    expect(find.text('Часы работы не опубликованы'), findsOneWidget);
  });

  testWidgets('catalog renders server-authored stale freshness explicitly',
      (tester) async {
    await _setMobile(tester);
    await tester.pumpWidget(_app(
      repository: _FakeCatalogRepository(
        availability: CatalogAvailabilitySummary(
          sourceUpdatedAt: DateTime.utc(2026, 7, 15, 6),
          serverNow: DateTime.utc(2026, 7, 15, 10),
          freshness: CatalogAvailabilityFreshness.stale,
          confirmationMode: CatalogConfirmationMode.alternativePossible,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Расписание устарело'), findsNWidgets(2));
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

    final desktopMedia =
        find.byKey(const ValueKey('catalog-clinic-media-clinic-1'));
    expect(tester.getSize(desktopMedia), const Size(140, 140));
    expect(tester.getSemantics(desktopMedia).label,
        contains('Иллюстрация клиники ВетКлиника Доверие'));
    await tester
        .ensureVisible(find.byKey(const ValueKey('catalog-clinic-clinic-1')));
    await tester.tap(find.byKey(const ValueKey('catalog-clinic-clinic-1')));
    await tester.pumpAndSettle();
    expect(find.text('Карточка клиники'), findsOneWidget);
    expect(find.text('Расписание обновлено недавно'), findsWidgets);
    final availabilityTop = tester
        .getTopLeft(find.byKey(const ValueKey('clinic-availability-section')))
        .dy;
    final doctorsTop = tester
        .getTopLeft(find.byKey(const ValueKey('clinic-doctors-section')))
        .dy;
    expect((availabilityTop - doctorsTop).abs(), lessThan(2));
    expect(
        tester.getTopLeft(find.byKey(const ValueKey('clinic-hero-media'))).dx,
        lessThan(tester
            .getTopLeft(find.byKey(const ValueKey('clinic-hero-action')))
            .dx));

    await tester.ensureVisible(find.text('Первичный приём'));
    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();
    await tester
        .ensureVisible(find.byKey(const ValueKey('clinic-booking-action')));
    await tester.tap(find.byKey(const ValueKey('clinic-booking-action')));
    expect(selection, isNotNull);
    expect(selection!.location.locationId, 'location-1');
    expect(selection!.service.code, 'GENERAL_VISIT');

    await tester
        .ensureVisible(find.byKey(const ValueKey('clinic-doctors-action')));
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

Future<void> _setMobile(WidgetTester tester) async {
  tester.view.physicalSize = const Size(375, 812);
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
  _FakeCatalogRepository({CatalogAvailabilitySummary? availability})
      : availability = availability ?? _currentAvailability;

  static final _currentAvailability = CatalogAvailabilitySummary(
    sourceUpdatedAt: DateTime.utc(2026, 7, 15, 9, 55),
    serverNow: DateTime.utc(2026, 7, 15, 10),
    freshness: CatalogAvailabilityFreshness.current,
    confirmationMode: CatalogConfirmationMode.clinicConfirmation,
  );
  final CatalogAvailabilitySummary availability;
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
        availability: availability,
        fitReasons: const ['Есть ветеринарные специалисты'],
      );

  CatalogClinic get clinic2 => CatalogClinic(
        id: 'clinic-2',
        name: 'ВетКлиника Рядом',
        locationCount: 2,
        serviceCount: 1,
        nextAvailableAt: DateTime.utc(2026, 7, 15, 12, 30),
        distanceKm: 2.4,
        telemedAvailable: false,
        emergencyAvailable: false,
        doctorCount: 2,
        priceFrom: '1800.00',
        availability: availability,
        fitReasons: const ['Есть первичный приём'],
      );

  @override
  Future<List<CatalogClinic>> listClinics(
          {String? query, CatalogClinicFilters? filters}) async =>
      [clinic, clinic2];

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
        availability: availability,
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
        availability: availability,
      );
}
