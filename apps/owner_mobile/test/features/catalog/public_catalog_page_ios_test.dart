import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';

void main() {
  testWidgets('iOS catalog renders a Cupertino clinic list without geo inputs',
      (tester) async {
    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakePublicCatalogRepository(),
          onSelected: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.byType(CupertinoSearchTextField), findsOneWidget);
    expect(find.byType(Scaffold), findsNothing);
    expect(find.byType(SearchBar), findsNothing);
    expect(find.byType(SegmentedButton), findsNothing);
    expect(find.text('Карта'), findsNothing);
    expect(find.text('Широта'), findsNothing);
    expect(find.text('Долгота'), findsNothing);
    expect(find.text('VetHelp Central'), findsOneWidget);
  });

  testWidgets('iOS catalog keeps booking handoff as CatalogBookingSelection',
      (tester) async {
    CatalogBookingSelection? selection;

    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakePublicCatalogRepository(),
          onSelected: (value) => selection = value,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('VetHelp Central'));
    await tester.pumpAndSettle();

    expect(find.text('Москва, Лесная, 1'), findsOneWidget);
    expect(find.text('Первичный приём'), findsOneWidget);
    expect(find.text('Выбрать время'), findsOneWidget);
    expect(find.text('Широта'), findsNothing);
    expect(find.text('Долгота'), findsNothing);

    await tester.ensureVisible(find.text('Выбрать время'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Выбрать время'));
    await tester.pump();

    expect(selection, isNotNull);
    expect(selection!.location.locationId, 'location-1');
    expect(selection!.service.id, 'service-1');
  });

  testWidgets('Material catalog path remains available on Android',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PublicCatalogPage(
          platformOverride: TargetPlatform.android,
          repository: _FakePublicCatalogRepository(),
          onSelected: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(Scaffold), findsOneWidget);
    expect(find.byType(SearchBar), findsOneWidget);
    expect(find.text('Список'), findsOneWidget);
    expect(find.text('Карта'), findsOneWidget);
    expect(find.byType(CupertinoPageScaffold), findsNothing);
  });
}

Widget _cupertinoHarness(Widget child) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, child) {
      return Theme(
        data: ThemeData(useMaterial3: true),
        child: child ?? const SizedBox.shrink(),
      );
    },
    home: child,
  );
}

class _FakePublicCatalogRepository implements PublicCatalogRepository {
  @override
  Future<List<CatalogClinic>> listClinics({
    String? query,
    CatalogClinicFilters? filters,
  }) async {
    return [
      CatalogClinic(
        id: 'clinic-1',
        name: 'VetHelp Central',
        locationCount: 1,
        serviceCount: 1,
        nextAvailableAt: DateTime.utc(2026, 7, 2, 10),
        distanceKm: null,
        telemedAvailable: true,
        emergencyAvailable: true,
      ),
    ];
  }

  @override
  Future<CatalogClinicDetail> readClinic(String clinicId) async {
    return CatalogClinicDetail(
      id: clinicId,
      name: 'VetHelp Central',
      locationCount: 1,
      serviceCount: 1,
      nextAvailableAt: DateTime.utc(2026, 7, 2, 10),
      distanceKm: null,
      telemedAvailable: true,
      emergencyAvailable: true,
      locations: [
        CatalogLocation(
          clinicId: clinicId,
          clinicName: 'VetHelp Central',
          locationId: 'location-1',
          address: 'Москва, Лесная, 1',
          phone: '+79991234567',
          latitude: 55.75,
          longitude: 37.61,
          hasOpenSlots: true,
          observedAt: DateTime.utc(2026, 7, 2),
        ),
      ],
    );
  }

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async {
    return [
      CatalogLocation(
        clinicId: 'clinic-1',
        clinicName: 'VetHelp Central',
        locationId: 'location-1',
        address: 'Москва, Лесная, 1',
        phone: '+79991234567',
        latitude: 55.75,
        longitude: 37.61,
        hasOpenSlots: true,
        observedAt: DateTime.utc(2026, 7, 2),
      ),
    ];
  }

  @override
  Future<List<CatalogService>> listLocationServices(String locationId) async {
    return const [
      CatalogService(
        id: 'service-1',
        code: 'GENERAL_VISIT',
        displayName: 'Первичный приём',
        durationMinutes: 30,
        priceAmount: '1500.00',
        currency: 'RUB',
      ),
    ];
  }

  @override
  Future<List<CatalogAvailabilitySlot>> readAvailability({
    required String locationId,
    required DateTime from,
    required DateTime to,
  }) async {
    return [
      CatalogAvailabilitySlot(
        id: 'slot-1',
        startsAt: DateTime.utc(2026, 7, 2, 10),
        endsAt: DateTime.utc(2026, 7, 2, 10, 30),
        remainingCapacity: 1,
        serviceId: 'service-1',
        serviceName: 'Первичный приём',
      ),
    ];
  }
}
