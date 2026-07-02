import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';

void main() {
  testWidgets('iOS production shell renders four real root tabs',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        const OwnerAdaptiveShell(
          platformOverride: TargetPlatform.iOS,
          home: Text('Home content'),
          clinics: Text('Clinics content'),
          appointments: Text('Appointments content'),
          pets: Text('Pets content'),
        ),
      ),
    );

    expect(find.byType(CupertinoTabScaffold), findsOneWidget);
    expect(find.byType(CupertinoTabBar), findsOneWidget);
    expect(find.text('Главная'), findsWidgets);
    expect(find.text('Клиники'), findsWidgets);
    expect(find.text('Записи'), findsWidgets);
    expect(find.text('Питомцы'), findsWidgets);
    expect(find.text('Профиль'), findsNothing);

    await tester.tap(find.text('Клиники').last);
    await tester.pumpAndSettle();

    expect(find.text('Clinics content'), findsOneWidget);
    expect(find.bySemanticsLabel('Раздел Клиники'), findsOneWidget);
  });

  testWidgets('Clinics tab mounts the real public catalog page',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        OwnerAdaptiveShell(
          platformOverride: TargetPlatform.iOS,
          home: const Text('Home content'),
          clinics: PublicCatalogPage(
            repository: _FakePublicCatalogRepository(),
            onSelected: (_) {},
          ),
          appointments: const Text('Appointments content'),
          pets: const Text('Pets content'),
        ),
      ),
    );

    await tester.tap(find.text('Клиники').last);
    await tester.pumpAndSettle();

    expect(find.byType(PublicCatalogPage), findsOneWidget);
    expect(find.text('Выберите клинику'), findsOneWidget);
    expect(find.text('VetHelp Central'), findsOneWidget);
  });

  testWidgets('Cupertino navigation stack is preserved when switching tabs',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        const OwnerAdaptiveShell(
          platformOverride: TargetPlatform.iOS,
          home: Text('Home content'),
          clinics: _PushableClinicProbe(),
          appointments: Text('Appointments content'),
          pets: Text('Pets content'),
        ),
      ),
    );

    await tester.tap(find.text('Клиники').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open clinic detail'));
    await tester.pumpAndSettle();

    expect(find.text('Clinic detail'), findsOneWidget);

    await tester.tap(find.text('Главная').last);
    await tester.pumpAndSettle();
    expect(find.text('Home content'), findsOneWidget);

    await tester.tap(find.text('Клиники').last);
    await tester.pumpAndSettle();
    expect(find.text('Clinic detail'), findsOneWidget);
  });

  testWidgets('Android and web path keeps Material subtree without Cupertino',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: OwnerAdaptiveShell(
          platformOverride: TargetPlatform.android,
          home: Scaffold(body: Text('Material home')),
          clinics: Text('iOS clinics'),
          appointments: Text('iOS appointments'),
          pets: Text('iOS pets'),
        ),
      ),
    );

    expect(find.text('Material home'), findsOneWidget);
    expect(find.byType(Scaffold), findsOneWidget);
    expect(find.text('iOS clinics'), findsNothing);
    expect(find.byType(CupertinoTabScaffold), findsNothing);
    expect(find.byType(CupertinoTabBar), findsNothing);
  });

  testWidgets('iOS shell does not generate placeholder tab content',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        const OwnerAdaptiveShell(
          platformOverride: TargetPlatform.iOS,
          home: Text('Home content'),
          clinics: Text('Real clinics root'),
          appointments: Text('Real appointments root'),
          pets: Text('Real pets root'),
        ),
      ),
    );

    await tester.tap(find.text('Записи').last);
    await tester.pumpAndSettle();
    expect(find.text('Real appointments root'), findsOneWidget);

    await tester.tap(find.text('Питомцы').last);
    await tester.pumpAndSettle();
    expect(find.text('Real pets root'), findsOneWidget);
    expect(find.text('Профиль'), findsNothing);
  });

  testWidgets('Cupertino shell adapts theme to dark mode', (tester) async {
    await tester.pumpWidget(
      CupertinoApp(
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const [Locale('ru'), Locale('en')],
        home: MediaQuery(
          data: const MediaQueryData(
            platformBrightness: Brightness.dark,
            textScaler: TextScaler.linear(1.4),
          ),
          child: const OwnerAdaptiveShell(
            platformOverride: TargetPlatform.iOS,
            home: Text('Home content'),
            clinics: Text('Clinics content'),
            appointments: Text('Appointments content'),
            pets: Text('Pets content'),
          ),
        ),
      ),
    );

    final theme = CupertinoTheme.of(
      tester.element(find.byType(CupertinoTabScaffold)),
    );

    expect(theme.brightness, Brightness.dark);
    expect(theme.scaffoldBackgroundColor, isA<CupertinoDynamicColor>());
    expect(theme.primaryColor, isA<CupertinoDynamicColor>());
  });
}

Widget _iosHarness(Widget child) {
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

class _PushableClinicProbe extends StatelessWidget {
  const _PushableClinicProbe();

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      child: Center(
        child: CupertinoButton(
          onPressed: () {
            Navigator.of(context).push(
              CupertinoPageRoute<void>(
                builder: (_) => const CupertinoPageScaffold(
                  child: Center(child: Text('Clinic detail')),
                ),
              ),
            );
          },
          child: const Text('Open clinic detail'),
        ),
      ),
    );
  }
}

class _FakePublicCatalogRepository implements PublicCatalogRepository {
  @override
  Future<List<CatalogClinic>> listClinics({
    String? query,
    CatalogClinicFilters? filters,
  }) async {
    return const [
      CatalogClinic(
        id: 'clinic-1',
        name: 'VetHelp Central',
        locationCount: 1,
        serviceCount: 1,
        nextAvailableAt: null,
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
      nextAvailableAt: null,
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
        code: 'CHECKUP',
        displayName: 'Осмотр',
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
        startsAt: DateTime.utc(2026, 7, 2, 9),
        endsAt: DateTime.utc(2026, 7, 2, 9, 30),
        remainingCapacity: 1,
        serviceId: 'service-1',
        serviceName: 'Осмотр',
      ),
    ];
  }
}
