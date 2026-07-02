import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_page.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_page.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_slot_grid.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';
import 'package:vethelp_owner_mobile/features/emergency/emergency_repository.dart';
import 'package:vethelp_owner_mobile/features/emergency/emergency_triage_page.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_journey_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/telemed/owner_telemed_page.dart';
import 'package:vethelp_owner_mobile/features/telemed/owner_telemed_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  testWidgets('Home and Booking follow system dark appearance', (tester) async {
    await tester.pumpWidget(_iosHarness(
      _home(),
      brightness: Brightness.dark,
    ));
    await tester.pumpAndSettle();
    expect(CupertinoTheme.of(tester.element(find.text('Главное'))).brightness,
        Brightness.dark);
    expect(find.text('Срочная помощь'), findsOneWidget);

    await tester.pumpWidget(_iosHarness(
      _booking(),
      brightness: Brightness.dark,
    ));
    await tester.pumpAndSettle();
    expect(
      CupertinoTheme.of(tester.element(find.text('Запись в клинику')))
          .brightness,
      Brightness.dark,
    );
    expect(find.text('Выберите время'), findsOneWidget);
  });

  testWidgets('critical iOS flows survive Dynamic Type scaling',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final cases = <String, Widget>{
      'Home': _home(),
      'Catalog': PublicCatalogPage(
        platformOverride: TargetPlatform.iOS,
        repository: _FakeCatalogRepository(),
        onSelected: (_) {},
      ),
      'Booking': _booking(),
      'Appointments': OwnerAppointmentsPage(
        platformOverride: TargetPlatform.iOS,
        repository: _FakeAppointmentsRepository(),
      ),
      'Emergency': EmergencyTriagePage(
        platformOverride: TargetPlatform.iOS,
        repository: _FakeEmergencyRepository(),
      ),
    };

    for (final scale in <double>[1.35, 1.60, 2.00]) {
      for (final entry in cases.entries) {
        await tester.binding.setSurfaceSize(const Size(430, 932));
        await tester.pumpWidget(_iosHarness(
          entry.value,
          textScale: scale,
        ));
        await tester.pumpAndSettle();

        expect(find.byType(CupertinoPageScaffold), findsWidgets,
            reason: '${entry.key} should stay on the iOS presentation path.');
        expect(tester.takeException(), isNull,
            reason: '${entry.key} should not overflow at text scale $scale.');
      }
    }
  });

  testWidgets('booking slot semantics and reduced motion are explicit',
      (tester) async {
    final slot = _slot('slot-1', DateTime.utc(2026, 7, 2, 10));

    await tester.pumpWidget(_iosHarness(
      CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: BookingSlotTile(
              slot: slot,
              selected: true,
              locking: false,
              locked: false,
              enabled: true,
              onTap: () {},
            ),
          ),
        ],
      ),
      disableAnimations: true,
    ));
    await tester.pump();

    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            (widget.properties.label?.startsWith('Выбрать время ') ?? false),
      ),
      findsOneWidget,
    );
    final scale = tester.widget<AnimatedScale>(find.byType(AnimatedScale));
    final container =
        tester.widget<AnimatedContainer>(find.byType(AnimatedContainer).first);
    expect(scale.duration, Duration.zero);
    expect(container.duration, Duration.zero);
  });

  testWidgets('emergency warning and telemed consent expose semantics',
      (tester) async {
    await tester.pumpWidget(_iosHarness(EmergencyTriagePage(
      platformOverride: TargetPlatform.iOS,
      repository: _FakeEmergencyRepository(),
    )));
    await tester.pumpAndSettle();
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.label ==
                'Важное предупреждение. Если питомец задыхается, потерял сознание, идёт сильное кровотечение или были судороги, не ждите онлайн-ответа.',
      ),
      findsOneWidget,
    );

    await tester.pumpWidget(_iosHarness(OwnerTelemedPage(
      platformOverride: TargetPlatform.iOS,
      repository: _FakeTelemedRepository(const []),
      waitingRepository: _FakeWaitingRepository(),
      roomAccessRepository: _FakeRoomAccessRepository(),
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Проверить онлайн-консультацию'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -520));
    await tester.pumpAndSettle();

    expect(
      find.text('Понимаю ограничения онлайн-консультации и хочу продолжить'),
      findsOneWidget,
    );
    expect(find.byType(CupertinoSwitch), findsWidgets);
  });

  testWidgets('appointment status and cancellation are accessible on iOS',
      (tester) async {
    final repository = _FakeAppointmentsRepository();
    await tester.pumpWidget(_iosHarness(OwnerAppointmentsPage(
      platformOverride: TargetPlatform.iOS,
      repository: repository,
    )));
    await tester.pumpAndSettle();

    expect(find.text('Ожидаем подтверждения'), findsOneWidget);
    expect(find.textContaining('MANUAL_CONFIRM_PENDING'), findsNothing);

    await tester.tap(find.text('VetHelp Pilot').first);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Запросить отмену'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Запросить отмену'));
    await tester.pumpAndSettle();

    final destructiveActions = tester
        .widgetList<CupertinoDialogAction>(
          find.byType(CupertinoDialogAction),
        )
        .where((action) => action.isDestructiveAction);
    expect(destructiveActions.length, 1);
  });

  testWidgets('iPad-sized iOS layout remains adaptive single-column',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1194, 834));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_iosHarness(_home()));
    await tester.pumpAndSettle();

    final listSize = tester.getSize(find.byType(ListView).first);
    expect(listSize.width, greaterThan(700));
    expect(find.text('Срочная помощь'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('iOS UI suppresses raw technical statuses across flows',
      (tester) async {
    await tester.pumpWidget(_iosHarness(OwnerTelemedPage(
      platformOverride: TargetPlatform.iOS,
      repository: _FakeTelemedRepository([
        _telemedSession(
          state: 'WAITING_FOR_DOCTOR',
          bucket: 'ACTIVE',
          refundState: 'VOID_REQUESTED',
        ),
      ]),
      waitingRepository: _FakeWaitingRepository(),
      roomAccessRepository: _FakeRoomAccessRepository(),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Ожидаем врача'), findsOneWidget);
    expect(find.textContaining('WAITING_FOR_DOCTOR'), findsNothing);
    expect(find.textContaining('VOID_REQUESTED'), findsNothing);
    expect(find.textContaining('409'), findsNothing);
  });
}

Widget _iosHarness(
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  bool disableAnimations = false,
}) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, appChild) {
      final media = MediaQuery.of(context).copyWith(
        platformBrightness: brightness,
        textScaler: TextScaler.linear(textScale),
        disableAnimations: disableAnimations,
        accessibleNavigation: disableAnimations,
      );
      return MediaQuery(
        data: media,
        child: Builder(
          builder: (context) => CupertinoTheme(
            data: VetHelpCupertinoTheme.data(context),
            child: Theme(
              data: brightness == Brightness.dark
                  ? VetHelpTheme.dark().copyWith(platform: TargetPlatform.iOS)
                  : VetHelpTheme.light().copyWith(platform: TargetPlatform.iOS),
              child: appChild ?? const SizedBox.shrink(),
            ),
          ),
        ),
      );
    },
    home: child,
  );
}

Widget _home() {
  return CupertinoPageScaffold(
    navigationBar: const CupertinoNavigationBar(middle: Text('Главное')),
    child: SafeArea(
      child: OwnerHomePage(
        platformOverride: TargetPlatform.iOS,
        selectedPet: _pet,
        appointmentsRepository: _FakeAppointmentsRepository(),
        onBrowseClinics: () {},
        onManagePets: () {},
        onOpenAppointments: () {},
        onOpenCare: () {},
        onRequestTelemed: () {},
        onRequestInsurance: () {},
        onRequestEmergency: () {},
      ),
    ),
  );
}

Widget _booking() {
  return BookingMarketplacePage(
    platformOverride: TargetPlatform.iOS,
    clinicName: 'VetHelp Pilot',
    serviceName: 'Первичный приём',
    serviceId: 'service-1',
    petName: 'Барс',
    clinicLocationId: 'location-1',
    petId: _pet.id,
    retryDelay: (_) async {},
    repository: _FakeBookingRepository(),
  );
}

const _pet = OwnerPet(id: 'pet-1', name: 'Барс', species: 'CAT');

class _FakeBookingRepository implements BookingMarketplaceRepository {
  @override
  Future<List<BookingSlot>> listSlots({
    required String clinicLocationId,
    required String serviceId,
    required DateTime from,
    required DateTime to,
  }) async {
    return [
      _slot('slot-1', DateTime.utc(2026, 7, 2, 10)),
      _slot('slot-2', DateTime.utc(2026, 7, 2, 13)),
    ];
  }

  @override
  Future<CreatedBookingHold> createHold({
    required String slotId,
    required String petId,
    required String correlationId,
    required String idempotencyKey,
  }) async {
    return CreatedBookingHold(
      holdId: 'hold-1',
      state: 'MANUAL_CONFIRM_PENDING',
      slotId: slotId,
      expiresAt: DateTime.utc(2026, 7, 2, 10, 15),
      correlationId: correlationId,
    );
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    return BookingHoldSnapshot(
      holdId: holdId,
      slotId: 'slot-1',
      state: 'MANUAL_CONFIRM_PENDING',
      expiresAt: DateTime.utc(2026, 7, 2, 10, 15),
      startsAt: DateTime.utc(2026, 7, 2, 10),
      endsAt: DateTime.utc(2026, 7, 2, 10, 30),
    );
  }
}

BookingSlot _slot(String id, DateTime startsAt) {
  return BookingSlot(
    id: id,
    clinicLocationId: 'location-1',
    serviceId: 'service-1',
    serviceName: 'Первичный приём',
    startsAt: startsAt,
    endsAt: startsAt.add(const Duration(minutes: 30)),
    remainingCapacity: 1,
  );
}

class _FakeCatalogRepository implements PublicCatalogRepository {
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
  Future<List<CatalogLocation>> listLocations({String? query}) async =>
      const [];

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

class _FakeAppointmentsRepository implements OwnerAppointmentsRepository {
  int cancellationRequests = 0;

  static const _presentation = OwnerAppointmentPresentation(
    code: 'WAITING_FOR_CLINIC',
    label: 'Ожидаем подтверждения',
    description: 'Клиника проверяет возможность записи.',
    tone: 'info',
  );

  @override
  Future<List<OwnerAppointment>> list() async {
    return [
      OwnerAppointment(
        holdId: 'hold-1',
        appointmentId: null,
        state: 'MANUAL_CONFIRM_PENDING',
        bucket: 'ACTIVE',
        presentation: _presentation,
        startsAt: DateTime.utc(2026, 7, 2, 10),
        endsAt: DateTime.utc(2026, 7, 2, 10, 30),
        clinicName: 'VetHelp Pilot',
        clinicAddress: 'Москва, Лесная, 1',
        petName: 'Барс',
      ),
    ];
  }

  @override
  Future<OwnerAppointmentDetail> readDetail(String holdId) async {
    return OwnerAppointmentDetail(
      holdId: holdId,
      appointmentId: null,
      state: 'MANUAL_CONFIRM_PENDING',
      bucket: 'ACTIVE',
      presentation: _presentation,
      version: 1,
      startsAt: DateTime.utc(2026, 7, 2, 10),
      endsAt: DateTime.utc(2026, 7, 2, 10, 30),
      expiresAt: DateTime.utc(2026, 7, 2, 9, 50),
      latestStatusUpdateAt: DateTime.utc(2026, 7, 2, 9, 45),
      serverNow: DateTime.utc(2026, 7, 2, 9, 45),
      clinicName: 'VetHelp Pilot',
      clinicAddress: 'Москва, Лесная, 1',
      locationPhone: '+79991234567',
      locationLatitude: 55.75,
      locationLongitude: 37.61,
      petName: 'Барс',
      petSpecies: 'CAT',
      serviceName: 'Первичный приём',
      priceAmount: '1500.00',
      currency: 'RUB',
      timeline: [
        OwnerAppointmentTimelineItem(
          at: DateTime.utc(2026, 7, 2, 9, 45),
          type: 'CREATED',
          label: 'Заявка отправлена',
        ),
      ],
      actions: const OwnerAppointmentActions(
        canRefresh: true,
        canRebook: false,
        canOpenRoute: true,
        canReviewAlternative: false,
        canCancel: true,
      ),
    );
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    return BookingHoldSnapshot(
      holdId: holdId,
      slotId: 'slot-1',
      state: 'MANUAL_CONFIRM_PENDING',
      expiresAt: DateTime.utc(2026, 7, 2, 9, 50),
      startsAt: DateTime.utc(2026, 7, 2, 10),
      endsAt: DateTime.utc(2026, 7, 2, 10, 30),
    );
  }

  @override
  Future<ReleasedBookingHold> releaseHold(String holdId) {
    throw UnimplementedError();
  }

  @override
  Future<RequestedBookingCancellation> requestCancellation(
      String holdId) async {
    cancellationRequests++;
    return const RequestedBookingCancellation(
      holdId: 'hold-1',
      state: 'CANCELLATION_REQUESTED',
      slotId: 'slot-1',
      correlationId: 'correlation-1',
    );
  }
}

class _FakeEmergencyRepository extends EmergencyRepository {
  _FakeEmergencyRepository() : super(baseUrl: Uri.parse('http://127.0.0.1'));

  @override
  Future<EmergencyTriageDraft?> readTriageDraft() async => null;
}

class _FakeTelemedRepository implements OwnerTelemedRepository {
  const _FakeTelemedRepository(this.sessions);

  final List<OwnerTelemedSession> sessions;

  @override
  Future<List<OwnerTelemedSession>> list() async => sessions;

  @override
  Future<List<TelemedPet>> listPets() async => const [
        TelemedPet(id: 'pet-1', name: 'Барс', species: 'CAT'),
      ];

  @override
  Future<TelemedIntakeResult> createIntake(TelemedIntakeInput input) async {
    return TelemedIntakeResult(
      intakeId: 'intake-1',
      outcome: 'TELEMED_ELIGIBLE',
      routingTarget: 'TELEMED_PAYMENT_QUEUE',
      nextStep: 'Continue to telemedicine payment and doctor queue.',
      guardrails: const ['Telemedicine does not replace emergency care.'],
      createdAt: DateTime.utc(2026, 7, 2, 10),
    );
  }

  @override
  Future<TelemedPaymentIntent> createPaymentIntent(String intakeId) {
    throw UnimplementedError();
  }
}

OwnerTelemedSession _telemedSession({
  required String state,
  required String bucket,
  String? refundState,
}) {
  final startsAt = DateTime.utc(2026, 7, 2, 10);
  return OwnerTelemedSession(
    sessionId: 'session-1',
    bookingHoldId: 'hold-1',
    telemedCaseId: null,
    state: state,
    telemedCaseState: null,
    paymentStatus: null,
    refundState: refundState,
    recommendationText: null,
    followUpNotes: null,
    safetyEscalation: false,
    bucket: bucket,
    startsAt: startsAt,
    endsAt: startsAt.add(const Duration(minutes: 30)),
    doctorJoinDeadlineAt: startsAt.add(const Duration(minutes: 5)),
    serverNow: startsAt,
    version: 1,
    clinicName: 'VetHelp Pilot',
    clinicAddress: 'Москва, Лесная, 1',
    petName: 'Барс',
    petSpecies: 'CAT',
    serviceName: 'Онлайн-консультация',
  );
}

class _FakeWaitingRepository implements TelemedWaitingRepository {
  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) {
    throw UnimplementedError();
  }

  @override
  Future<TelemedWaitingSnapshot> cancelSession(String sessionId) {
    throw UnimplementedError();
  }
}

class _FakeRoomAccessRepository implements TelemedRoomAccessRepository {
  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) {
    throw UnimplementedError();
  }
}
