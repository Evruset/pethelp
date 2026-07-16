import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/services.dart';
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
    expect(find.textContaining('1500'), findsNothing);
    expect(find.textContaining('₽'), findsNothing);
    expect(find.textContaining('рейтинг'), findsNothing);
    expect(find.textContaining('отзыв'), findsNothing);
    expect(find.text('VetHelp Central'), findsOneWidget);
  });

  testWidgets('iOS catalog keeps booking handoff as CatalogBookingSelection',
      (tester) async {
    CatalogBookingSelection? selection;
    final repository = _FakePublicCatalogRepository();

    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: repository,
          bookingPetName: 'Бим',
          onSelected: (value) => selection = value,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('VetHelp Central'));
    await tester.pumpAndSettle();

    expect(find.text('Москва, Лесная, 1'), findsOneWidget);
    expect(find.text('Первичный приём'), findsOneWidget);
    expect(find.text('Выберите услугу'), findsOneWidget);
    expect(find.text('День записи'), findsNothing);
    expect(find.text('Ближайшее время'), findsNothing);
    expect(find.text('Широта'), findsNothing);
    expect(find.text('Долгота'), findsNothing);
    expect(find.textContaining('service-1'), findsNothing);
    expect(find.textContaining('GENERAL_VISIT'), findsNothing);
    expect(find.textContaining('1500'), findsNothing);

    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();

    expect(find.text('Перед выбором времени'), findsOneWidget);
    expect(find.text('Питомец'), findsOneWidget);
    expect(find.text('Бим'), findsOneWidget);
    expect(find.text('Клиника'), findsOneWidget);
    expect(find.text('Услуга'), findsOneWidget);
    expect(find.text('Посмотреть время'), findsOneWidget);
    expect(find.text('День записи'), findsNothing);
    expect(find.text('Ближайшее время'), findsNothing);
    expect(repository.availabilityCalls, 0);
    expect(selection, isNull);

    await tester.ensureVisible(find.text('Посмотреть время'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Посмотреть время'));
    await tester.pump();

    expect(selection, isNotNull);
    expect(selection!.location.locationId, 'location-1');
    expect(selection!.service.id, 'service-1');
  });

  testWidgets('selected pet context can change without booking side effects',
      (tester) async {
    var changePetCalls = 0;
    CatalogBookingSelection? selection;
    final repository = _FakePublicCatalogRepository();

    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: repository,
          bookingPetName: 'Бим',
          onChangePet: () => changePetCalls += 1,
          onSelected: (value) => selection = value,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Клиника и услуга для Бим'), findsOneWidget);
    expect(find.text('Сменить'), findsOneWidget);

    await tester.tap(find.text('Сменить'));
    await tester.pump();

    expect(changePetCalls, 1);
    expect(selection, isNull);
    expect(repository.availabilityCalls, 0);
  });

  testWidgets('iOS empty filtered catalog can clear filters', (tester) async {
    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakePublicCatalogRepository(emptyWhenFiltered: true),
          onSelected: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();

    expect(find.text('Ничего не найдено'), findsOneWidget);
    expect(find.text('Очистить фильтры'), findsOneWidget);

    await tester.tap(find.text('Очистить фильтры'));
    await tester.pumpAndSettle();

    expect(find.text('VetHelp Central'), findsOneWidget);
  });

  testWidgets('iOS clinic detail hides missing contact and service sections',
      (tester) async {
    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakePublicCatalogRepository(
            hasPhone: false,
            services: const <CatalogService>[],
          ),
          onSelected: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('VetHelp Central'));
    await tester.pumpAndSettle();

    expect(find.text('Маршрут'), findsOneWidget);
    expect(find.text('Позвонить'), findsNothing);
    expect(find.text('Активные услуги не найдены.'), findsOneWidget);
    expect(find.text('Посмотреть время'), findsNothing);
  });

  testWidgets('iOS rebooking context explains prefilled decision journey',
      (tester) async {
    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakePublicCatalogRepository(),
          bookingPetName: 'Барсик',
          bookingContextNote:
              'Это повторная запись по контексту прошлого визита.',
          onSelected: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('VetHelp Central'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();

    expect(find.text('Барсик'), findsOneWidget);
    expect(
      find.text('Это повторная запись по контексту прошлого визита.'),
      findsOneWidget,
    );
    expect(
      find.textContaining('удержание слота'),
      findsOneWidget,
    );
    expect(find.textContaining('queue'), findsNothing);
    expect(find.textContaining('location-1'), findsNothing);
  });

  testWidgets('Material clinic detail does not render slot picker',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    CatalogBookingSelection? selection;
    final repository = _FakePublicCatalogRepository();

    await tester.pumpWidget(_materialHarness(
      PublicCatalogPage(
        platformOverride: TargetPlatform.android,
        repository: repository,
        bookingPetName: 'Бим',
        onSelected: (value) => selection = value,
      ),
      size: const Size(1280, 900),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('VetHelp Central'));
    await tester.pumpAndSettle();

    expect(find.text('День записи'), findsNothing);
    expect(find.text('Ближайшее время'), findsNothing);
    expect(find.text('Выберите услугу'), findsOneWidget);
    expect(repository.availabilityCalls, 0);

    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();

    expect(find.text('Перед выбором времени'), findsOneWidget);
    expect(find.text('Посмотреть время'), findsOneWidget);
    expect(find.text('День записи'), findsNothing);
    expect(find.text('Ближайшее время'), findsNothing);
    expect(find.textContaining('service-1'), findsNothing);
    expect(repository.availabilityCalls, 0);

    await tester.ensureVisible(find.text('Посмотреть время'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Посмотреть время'));
    await tester.pump();

    expect(selection, isNotNull);
    expect(selection!.location.locationId, 'location-1');
    expect(selection!.service.id, 'service-1');
    expect(repository.availabilityCalls, 0);
  });

  testWidgets('iOS catalog supports dark mode, Dynamic Type and tap targets',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(834, 1194));
    await tester.pumpWidget(
      _cupertinoHarness(
        PublicCatalogPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakePublicCatalogRepository(),
          bookingPetName: 'Бим',
          onSelected: (_) {},
        ),
        brightness: Brightness.dark,
        textScale: 2,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      CupertinoTheme.of(tester.element(find.text('VetHelp Central')))
          .brightness,
      Brightness.dark,
    );
    await tester.tap(find.text('VetHelp Central'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Первичный приём'));
    await tester.pumpAndSettle();

    final changeServiceButton = find.ancestor(
      of: find.text('Изменить').last,
      matching: find.byType(CupertinoButton),
    );
    expect(
      tester.getSize(changeServiceButton.first).height,
      greaterThanOrEqualTo(44),
    );
    expect(tester.takeException(), isNull);
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
    expect(find.text('Фильтры'), findsOneWidget);
    expect(find.byType(SegmentedButton), findsNothing);
    expect(find.text('Карта'), findsNothing);
    expect(find.byType(CupertinoPageScaffold), findsNothing);
  });

  testWidgets('Material web catalog uses search-first desktop filters',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));

    await tester.pumpWidget(_materialHarness(
      PublicCatalogPage(
        platformOverride: TargetPlatform.android,
        repository: _FakePublicCatalogRepository(),
        onSelected: (_) {},
      ),
      size: const Size(1280, 900),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(SearchBar), findsOneWidget);
    expect(find.text('Фильтры каталога'), findsOneWidget);
    expect(find.text('VetHelp Central'), findsOneWidget);
    expect(find.byType(SegmentedButton), findsNothing);
    expect(find.text('Карта'), findsNothing);
    expect(find.text('Широта'), findsNothing);
    expect(find.text('Долгота'), findsNothing);
    expect(find.text('Радиус'), findsNothing);
    expect(find.textContaining('координат'), findsNothing);
  });

  testWidgets('Material web catalog clears active filters', (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));

    await tester.pumpWidget(_materialHarness(
      PublicCatalogPage(
        platformOverride: TargetPlatform.android,
        repository: _FakePublicCatalogRepository(emptyWhenFiltered: true),
        onSelected: (_) {},
      ),
      size: const Size(1280, 900),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(CheckboxListTile, 'Первичный приём'));
    await tester.pumpAndSettle();

    expect(find.text('По этому запросу активных клиник не найдено.'),
        findsOneWidget);
    expect(find.text('Очистить фильтры'), findsWidgets);

    await tester.tap(find.text('Очистить фильтры').first);
    await tester.pumpAndSettle();

    expect(find.text('VetHelp Central'), findsOneWidget);
    expect(find.text('Очистить фильтры'), findsNothing);
  });

  testWidgets(
      'Material web catalog keeps focusable controls and 200 percent text',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));

    await tester.pumpWidget(_materialHarness(
      PublicCatalogPage(
        platformOverride: TargetPlatform.android,
        repository: _FakePublicCatalogRepository(),
        onSelected: (_) {},
      ),
      textScale: 2,
      size: const Size(1280, 900),
    ));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Обновить каталог'), findsOneWidget);
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();

    expect(FocusManager.instance.primaryFocus, isNotNull);
    expect(find.text('VetHelp Central'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
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
    expect(find.bySemanticsLabel(RegExp('VetCity на Ленина.*1 адреса')),
        findsOneWidget);

    await tester.tap(
      find.widgetWithText(CupertinoButton, 'VetCity на Ленина'),
    );
    await tester.pumpAndSettle();

    expect(find.text('ул. Ленина, 10'), findsOneWidget);
    expect(find.text('Терапевт'), findsOneWidget);
    expect(find.text('Вакцинация'), findsOneWidget);
    expect(find.text('Выберите услугу'), findsOneWidget);
    await tester.tap(find.widgetWithText(CupertinoButton, 'Терапевт'));
    await tester.pumpAndSettle();
    expect(find.text('Посмотреть время'), findsOneWidget);
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

    await tester.tap(
      find.widgetWithText(CupertinoButton, 'VetCity на Ленина'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(CupertinoButton, 'Вакцинация'));
    await tester.pumpAndSettle();
    final bookingButton = find.text('Посмотреть время');
    await tester.ensureVisible(bookingButton);
    await tester.pumpAndSettle();
    await tester.tap(bookingButton);
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

    await tester.tap(
      find.widgetWithText(CupertinoButton, 'VetCity на Ленина'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(CupertinoButton, 'Терапевт'));
    await tester.pumpAndSettle();

    expect(find.text('Посмотреть время'), findsOneWidget);
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
    final clinicFinder =
        find.widgetWithText(CupertinoButton, 'VetCity на Ленина');
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

    await tester.tap(
      find.widgetWithText(CupertinoButton, 'VetCity на Ленина'),
    );
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(RegExp('Терапевт.*30 минут')), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp('Вакцинация.*20 минут')),
      findsOneWidget,
    );
  });
}

Widget _materialHarness(
  Widget child, {
  double textScale = 1,
  Size? size,
}) {
  return MaterialApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    theme: ThemeData(useMaterial3: true),
    builder: (context, child) {
      final media = MediaQuery.of(context).copyWith(
        size: size,
        textScaler: TextScaler.linear(textScale),
      );
      return MediaQuery(data: media, child: child ?? const SizedBox.shrink());
    },
    home: child,
  );
}

Widget _cupertinoHarness(
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1,
}) {
  return CupertinoApp(
    theme: CupertinoThemeData(brightness: brightness),
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, child) {
      final media = MediaQuery.of(context).copyWith(
        platformBrightness: brightness,
        textScaler: TextScaler.linear(textScale),
      );
      return MediaQuery(
        data: media,
        child: Theme(
          data: ThemeData(useMaterial3: true),
          child: child ?? const SizedBox.shrink(),
        ),
      );
    },
    home: child,
  );
}

class _FakePublicCatalogRepository extends PublicCatalogRepository {
  _FakePublicCatalogRepository({
    this.emptyWhenFiltered = false,
    this.hasPhone = true,
    List<CatalogService>? services,
    DateTime? nextAvailableAt,
  })  : services = services ?? _defaultServices,
        nextAvailableAt = nextAvailableAt ?? DateTime.utc(2026, 7, 2, 10);

  static const _defaultServices = [
    CatalogService(
      id: 'service-1',
      code: 'GENERAL_VISIT',
      displayName: 'Первичный приём',
      durationMinutes: 30,
      priceAmount: '1500.00',
      currency: 'RUB',
    ),
  ];

  final bool emptyWhenFiltered;
  final bool hasPhone;
  final List<CatalogService> services;
  final DateTime? nextAvailableAt;
  int availabilityCalls = 0;

  @override
  Future<List<CatalogClinic>> listClinics({
    String? query,
    CatalogClinicFilters? filters,
  }) async {
    if (emptyWhenFiltered && _fakeHasFilters(filters)) {
      return const <CatalogClinic>[];
    }
    return [
      CatalogClinic(
        id: 'clinic-1',
        name: 'VetHelp Central',
        locationCount: 1,
        serviceCount: 1,
        nextAvailableAt: nextAvailableAt,
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
          phone: hasPhone ? '+79991234567' : null,
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
    return services;
  }

  @override
  Future<List<CatalogAvailabilitySlot>> readAvailability({
    required String locationId,
    required DateTime from,
    required DateTime to,
  }) async {
    availabilityCalls += 1;
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

bool _fakeHasFilters(CatalogClinicFilters? filters) {
  if (filters == null) return false;
  return filters.serviceCode != null ||
      filters.availableFrom != null ||
      filters.availableTo != null ||
      filters.openNow == true ||
      filters.telemedAvailable == true ||
      filters.emergencyCapability != null ||
      filters.sort != 'soonest';
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
        platformOverride: TargetPlatform.iOS,
        repository: repository ?? _FakeCatalogRepository(),
        onSelected: onSelected ?? (_) {},
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _FakeCatalogRepository extends PublicCatalogRepository {
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
