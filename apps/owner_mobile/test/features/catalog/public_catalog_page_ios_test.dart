import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';

void main() {
  testWidgets('iOS catalog flow uses Cupertino scaffold without Material cards',
      (tester) async {
    await _pumpCatalog(tester);

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.byType(Scaffold), findsNothing);
    expect(find.byType(Card), findsNothing);
    expect(find.byType(ListTile), findsNothing);
    expect(find.byType(InkWell), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
    expect(find.text('VetCity на Ленина'), findsOneWidget);
  });

  testWidgets('clinic card renders real data and opens service step',
      (tester) async {
    await _pumpCatalog(tester);

    expect(find.text('VetCity на Ленина'), findsOneWidget);
    expect(find.text('1 адрес(а) · 2 услуг(и)'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Клиника VetCity на Ленина')),
        findsOneWidget);

    await tester.tap(find.bySemanticsLabel(RegExp('Клиника VetCity')));
    await tester.pumpAndSettle();

    expect(find.text('ул. Ленина, 10'), findsOneWidget);
    expect(find.text('Терапевт'), findsOneWidget);
    expect(find.text('Вакцинация'), findsOneWidget);
    expect(find.text('Выбрать время'), findsOneWidget);
    expect(find.byType(Card), findsNothing);
    expect(find.byType(ListTile), findsNothing);
    expect(find.byType(InkWell), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets('service selection preserves booking marketplace context',
      (tester) async {
    final repository = _FakeCatalogRepository();
    CatalogBookingSelection? captured;
    await _pumpCatalog(
      tester,
      repository: repository,
      onSelected: (selection) => captured = selection,
    );

    await tester.tap(find.bySemanticsLabel(RegExp('Клиника VetCity')));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel(RegExp('Услуга Вакцинация')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Выбрать время'));
    await tester.pumpAndSettle();

    expect(repository.availabilityReads, 0);
    expect(captured, isNotNull);
    expect(captured!.location.clinicId, 'clinic-1');
    expect(captured!.location.locationId, 'location-1');
    expect(captured!.location.clinicName, 'VetCity на Ленина');
    expect(captured!.service.id, 'service-vaccine');
    expect(captured!.service.displayName, 'Вакцинация');
  });

  testWidgets('iOS copy keeps booking handoff wording owner-facing',
      (tester) async {
    await _pumpCatalog(tester);

    await tester.tap(find.bySemanticsLabel(RegExp('Клиника VetCity')));
    await tester.pumpAndSettle();

    expect(find.text('Выбрать время'), findsOneWidget);
    expect(find.text('Отправить заявку в клинику'), findsNothing);
    expect(find.textContaining('hold'), findsNothing);
    expect(find.textContaining('409'), findsNothing);
  });

  testWidgets('text scale 2.0 and dark mode render without layout exception',
      (tester) async {
    await _pumpCatalog(
      tester,
      brightness: Brightness.dark,
      textScale: 2,
    );
    final clinicFinder = find.bySemanticsLabel(RegExp('Клиника VetCity'));
    await tester.ensureVisible(clinicFinder);
    await tester.pumpAndSettle();
    await tester.tap(find.text('VetCity на Ленина'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Терапевт'),
      260,
      scrollable: find.byType(Scrollable).last,
    );
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.text('Терапевт'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('service items expose accessible semantics', (tester) async {
    await _pumpCatalog(tester);

    await tester.tap(find.bySemanticsLabel(RegExp('Клиника VetCity')));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(RegExp('Услуга Терапевт')), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp('Услуга Вакцинация')),
      findsOneWidget,
    );
  });
}

Future<void> _pumpCatalog(
  WidgetTester tester, {
  _FakeCatalogRepository? repository,
  ValueChanged<CatalogBookingSelection>? onSelected,
  Brightness brightness = Brightness.light,
  double textScale = 1,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: ThemeData(platform: TargetPlatform.iOS),
      darkTheme: ThemeData(platform: TargetPlatform.iOS),
      themeMode:
          brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      locale: const Locale('ru'),
      supportedLocales: const [Locale('ru'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            platformBrightness: brightness,
            textScaler: TextScaler.linear(textScale),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
      home: PublicCatalogPage(
        repository: repository ?? _FakeCatalogRepository(),
        onSelected: onSelected ?? (_) {},
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _FakeCatalogRepository implements PublicCatalogRepository {
  int availabilityReads = 0;

  @override
  Future<List<CatalogClinic>> listClinics({
    String? query,
    CatalogClinicFilters? filters,
  }) async {
    return [
      CatalogClinic(
        id: 'clinic-1',
        name: 'VetCity на Ленина',
        locationCount: 1,
        serviceCount: 2,
        nextAvailableAt: _nextAvailableAt,
        distanceKm: null,
        telemedAvailable: true,
        emergencyAvailable: false,
      ),
    ];
  }

  @override
  Future<CatalogClinicDetail> readClinic(String clinicId) async {
    expect(clinicId, 'clinic-1');
    return CatalogClinicDetail(
      id: 'clinic-1',
      name: 'VetCity на Ленина',
      locationCount: 1,
      serviceCount: 2,
      nextAvailableAt: _nextAvailableAt,
      distanceKm: null,
      telemedAvailable: true,
      emergencyAvailable: false,
      locations: [
        CatalogLocation(
          clinicId: 'clinic-1',
          clinicName: 'VetCity на Ленина',
          locationId: 'location-1',
          address: 'ул. Ленина, 10',
          phone: '+7 495 000-00-00',
          latitude: null,
          longitude: null,
          hasOpenSlots: true,
          observedAt: _observedAt,
        ),
      ],
    );
  }

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async {
    return [
      CatalogLocation(
        clinicId: 'clinic-1',
        clinicName: 'VetCity на Ленина',
        locationId: 'location-1',
        address: 'ул. Ленина, 10',
        phone: '+7 495 000-00-00',
        latitude: null,
        longitude: null,
        hasOpenSlots: true,
        observedAt: _observedAt,
      ),
    ];
  }

  @override
  Future<List<CatalogService>> listLocationServices(String locationId) async {
    expect(locationId, 'location-1');
    return const [
      CatalogService(
        id: 'service-therapy',
        code: 'THERAPY',
        displayName: 'Терапевт',
        durationMinutes: 30,
        priceAmount: '1500.00',
        currency: 'RUB',
      ),
      CatalogService(
        id: 'service-vaccine',
        code: 'VACCINATION',
        displayName: 'Вакцинация',
        durationMinutes: 20,
        priceAmount: '1200.00',
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
    availabilityReads += 1;
    return [
      CatalogAvailabilitySlot(
        id: 'slot-1',
        startsAt: _nextAvailableAt,
        endsAt: _slotEndsAt,
        remainingCapacity: 1,
        serviceId: 'service-therapy',
        serviceName: 'Терапевт',
      ),
    ];
  }
}

final _observedAt = DateTime.utc(2026, 6, 25, 9);
final _nextAvailableAt = DateTime.utc(2026, 6, 25, 11, 30);
final _slotEndsAt = DateTime.utc(2026, 6, 25, 12);
