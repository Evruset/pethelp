import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_bloc.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_page.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_hold_status_page.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_request_coordinator.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_slot_grid.dart';

void main() {
  test('coordinator keeps correlation id and rotates released slot key', () {
    var counter = 0;
    final coordinator = BookingHoldRequestCoordinator(
      uuidFactory: () => 'uuid-${++counter}',
    );

    final first = coordinator.contextFor(slotId: 'slot-a', petId: 'pet-1');
    final repeat = coordinator.contextFor(slotId: 'slot-a', petId: 'pet-1');
    coordinator.releaseSlot('slot-a');
    final next = coordinator.contextFor(slotId: 'slot-a', petId: 'pet-1');

    expect(first.correlationId, 'uuid-1');
    expect(repeat.correlationId, first.correlationId);
    expect(repeat.idempotencyKey, first.idempotencyKey);
    expect(next.correlationId, first.correlationId);
    expect(next.idempotencyKey, isNot(first.idempotencyKey));
  });

  testWidgets('slot retry state shows Cupertino activity indicator',
      (tester) async {
    final slot = _slot('slot-a');
    final state = BookingSlotLockingInProgress(
      selectedDay: DateTime.utc(2026, 6, 29),
      slots: [slot, _slot('slot-b', startsAtHour: 12)],
      selectedSlot: slot,
      correlationId: 'corr-1',
      retryAttempt: 1,
      nextDelay: const Duration(seconds: 1),
    );

    await tester.pumpWidget(_sliverHost(
      BookingSlotGrid(
        slots: state.slots,
        selectedSlot: state.selectedSlot,
        lockingSlot: state.selectedSlot,
        lockedSlot: null,
        onSlotSelected: (_) {},
      ),
    ));

    expect(find.byType(CupertinoActivityIndicator), findsOneWidget);
  });

  testWidgets('locked slot shows native check mark and active blue background',
      (tester) async {
    final slot = _slot('slot-a');

    await tester.pumpWidget(_boxHost(
      BookingSlotTile(
        slot: slot,
        selected: true,
        locking: false,
        locked: true,
        enabled: false,
        onTap: () {},
      ),
    ));

    expect(find.byIcon(CupertinoIcons.check_mark), findsOneWidget);
    final container = tester.widget<AnimatedContainer>(
      find.byKey(const ValueKey<String>('booking-slot-slot-a')),
    );
    final decoration = container.decoration! as BoxDecoration;
    expect(decoration.color, CupertinoColors.activeBlue);
  });

  testWidgets(
      'final slot failure opens Cupertino conflict dialog without alternatives',
      (tester) async {
    final repository = _FakeBookingMarketplaceRepository(
      holdFailuresBeforeSuccess: 4,
    );

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(platform: TargetPlatform.iOS, useMaterial3: true),
      home: BookingMarketplacePage(
        clinicName: 'VetHelp Clinic',
        locationAddress: 'Москва, Лесная, 1',
        serviceName: 'Первичный прием',
        serviceId: 'service-1',
        petName: 'Бим',
        clinicLocationId: 'location-1',
        petId: 'pet-1',
        repository: repository,
        retryDelay: (_) async {},
      ),
    ));

    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey<String>('cupertino-booking-slot-slot-a')),
      warnIfMissed: false,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Записаться'));
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoAlertDialog), findsOneWidget);
    expect(find.text('Время занято'), findsOneWidget);
    expect(find.text('Это время уже заняли. Выберите другое время.'),
        findsOneWidget);
    expect(find.textContaining('SLOT_'), findsNothing);
    expect(find.textContaining('409'), findsNothing);

    await tester.tap(find.text('Выбрать другое время'));
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoActionSheet), findsNothing);
    expect(find.byType(CupertinoAlertDialog), findsNothing);
  });

  testWidgets('iOS booking page uses Cupertino presentation for slot selection',
      (tester) async {
    final repository = _FakeBookingMarketplaceRepository(
      holdFailuresBeforeSuccess: 0,
    );

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(platform: TargetPlatform.iOS, useMaterial3: true),
      home: BookingMarketplacePage(
        clinicName: 'VetHelp Clinic',
        locationAddress: 'Москва, Лесная, 1',
        serviceName: 'Первичный прием',
        serviceId: 'service-1',
        petName: 'Бим',
        clinicLocationId: 'location-1',
        petId: 'pet-1',
        repository: repository,
        retryDelay: (_) async {},
      ),
    ));

    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.byType(Scaffold), findsNothing);
    expect(find.byType(AppBar), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
    expect(find.text('Первичный прием'), findsOneWidget);
    expect(find.text('Москва, Лесная, 1'), findsOneWidget);
    expect(find.text('Утро'), findsOneWidget);
    expect(find.text('День'), findsAtLeastNWidgets(1));
    expect(find.text('Выберите время'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey<String>('cupertino-booking-slot-slot-a')),
      warnIfMissed: false,
    );
    await tester.pumpAndSettle();

    expect(
      find.descendant(
        of: find.byKey(const ValueKey<String>('cupertino-booking-slot-slot-a')),
        matching: find.byIcon(CupertinoIcons.check_mark),
      ),
      findsOneWidget,
    );
    expect(find.text('Записаться'), findsOneWidget);
    expect(repository.holdRequests, 0);
  });

  testWidgets('Android booking page keeps Material presentation',
      (tester) async {
    final repository = _FakeBookingMarketplaceRepository(
      holdFailuresBeforeSuccess: 0,
    );

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(platform: TargetPlatform.android, useMaterial3: true),
      home: BookingMarketplacePage(
        clinicName: 'VetHelp Clinic',
        locationAddress: 'Москва, Лесная, 1',
        serviceName: 'Первичный прием',
        serviceId: 'service-1',
        petName: 'Бим',
        clinicLocationId: 'location-1',
        petId: 'pet-1',
        repository: repository,
        retryDelay: (_) async {},
        platformOverride: TargetPlatform.android,
      ),
    ));

    await tester.pumpAndSettle();

    expect(find.byType(Scaffold), findsOneWidget);
    expect(find.byType(AppBar), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
    expect(find.byType(BookingSlotTile), findsWidgets);
    expect(find.byType(CupertinoPageScaffold), findsNothing);
  });

  testWidgets('successful iOS booking opens Cupertino owner status screen',
      (tester) async {
    final repository = _FakeBookingMarketplaceRepository(
      holdFailuresBeforeSuccess: 0,
    );

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(platform: TargetPlatform.iOS, useMaterial3: true),
      home: BookingMarketplacePage(
        clinicName: 'VetHelp Clinic',
        locationAddress: 'Москва, Лесная, 1',
        serviceName: 'Первичный прием',
        serviceId: 'service-1',
        petName: 'Бим',
        clinicLocationId: 'location-1',
        petId: 'pet-1',
        repository: repository,
        retryDelay: (_) async {},
      ),
    ));

    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey<String>('cupertino-booking-slot-slot-a')),
      warnIfMissed: false,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Записаться'));
    await tester.pumpAndSettle();

    expect(find.text('Вы записаны'), findsWidgets);
    expect(find.text('VetHelp Clinic'), findsOneWidget);
    expect(find.text('Москва, Лесная, 1'), findsOneWidget);
    expect(find.text('Бим'), findsOneWidget);
    expect(find.text('Первичный прием'), findsOneWidget);
    expect(find.textContaining('Заявка'), findsNothing);
    expect(find.textContaining('подтверд'), findsNothing);
    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.byType(Scaffold), findsNothing);
  });

  testWidgets('iOS booking result maps confirmed hold to owner-facing copy',
      (tester) async {
    var openedAppointments = false;
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(platform: TargetPlatform.iOS, useMaterial3: true),
      home: BookingHoldStatusPage(
        holdId: 'hold-1',
        initialState: 'CONFIRMED',
        clinicName: 'VetHelp Clinic',
        locationAddress: 'Москва, Лесная, 1',
        serviceName: 'Первичный прием',
        petName: 'Бим',
        platformOverride: TargetPlatform.iOS,
        readHold: (_) async => BookingHoldSnapshot(
          holdId: 'hold-1',
          slotId: 'slot-1',
          state: 'CONFIRMED',
          expiresAt: DateTime.utc(2026, 7, 2, 9),
          startsAt: DateTime.utc(2026, 7, 2, 10),
          endsAt: DateTime.utc(2026, 7, 2, 10, 30),
        ),
        onOpenAppointments: () => openedAppointments = true,
      ),
    ));

    await tester.pumpAndSettle();

    expect(find.text('Вы записаны'), findsWidgets);
    expect(find.text('VetHelp Clinic'), findsOneWidget);
    expect(find.text('Москва, Лесная, 1'), findsOneWidget);
    expect(find.text('Бим'), findsOneWidget);
    expect(find.text('Первичный прием'), findsOneWidget);
    expect(find.text('Открыть записи'), findsOneWidget);
    expect(find.textContaining('hold-1'), findsNothing);
    expect(find.textContaining('CONFIRMED'), findsNothing);
    expect(find.textContaining('подтверд'), findsNothing);

    await tester.ensureVisible(find.text('Открыть записи'));
    await tester.tap(find.text('Открыть записи'));
    expect(openedAppointments, isTrue);
  });
}

Widget _sliverHost(Widget sliver) {
  return MaterialApp(
    theme: ThemeData(platform: TargetPlatform.iOS, useMaterial3: true),
    home: MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(1.4)),
      child: CustomScrollView(slivers: [sliver]),
    ),
  );
}

Widget _boxHost(Widget child) {
  return MaterialApp(
    theme: ThemeData(platform: TargetPlatform.iOS, useMaterial3: true),
    home: MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(1.4)),
      child: Scaffold(body: Center(child: child)),
    ),
  );
}

BookingSlot _slot(String id, {int startsAtHour = 10}) {
  return BookingSlot(
    id: id,
    clinicLocationId: 'location-1',
    serviceId: 'service-1',
    serviceName: 'Первичный прием',
    startsAt: DateTime.utc(2026, 6, 29, startsAtHour),
    endsAt: DateTime.utc(2026, 6, 29, startsAtHour, 30),
    remainingCapacity: 1,
  );
}

class _FakeBookingMarketplaceRepository
    implements BookingMarketplaceRepository {
  _FakeBookingMarketplaceRepository({required this.holdFailuresBeforeSuccess});

  final int holdFailuresBeforeSuccess;
  int holdRequests = 0;
  final List<BookingSlot> slots = [
    _slot('slot-a', startsAtHour: 6),
    _slot('slot-b', startsAtHour: 11),
    _slot('slot-c', startsAtHour: 12),
    _slot('slot-d', startsAtHour: 18),
  ];

  @override
  Future<List<BookingSlot>> listSlots({
    required String clinicLocationId,
    required String serviceId,
    required DateTime from,
    required DateTime to,
  }) async {
    return slots;
  }

  @override
  Future<CreatedBookingHold> createHold({
    required String slotId,
    required String petId,
    required String correlationId,
    required String idempotencyKey,
  }) async {
    holdRequests += 1;
    if (holdRequests <= holdFailuresBeforeSuccess) {
      throw const BookingMarketplaceApiException(
        statusCode: 409,
        code: 'SLOT_LOCKED_RETRY',
      );
    }
    return CreatedBookingHold(
      holdId: 'hold-1',
      appointmentId: 'appointment-1',
      state: 'CONFIRMED',
      slotId: slotId,
      expiresAt: DateTime.utc(2026, 6, 29, 10, 10),
      correlationId: correlationId,
    );
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    return BookingHoldSnapshot(
      holdId: holdId,
      slotId: 'slot-a',
      state: 'CONFIRMED',
      expiresAt: DateTime.utc(2026, 6, 29, 10, 10),
      startsAt: DateTime.utc(2026, 6, 29, 10),
      endsAt: DateTime.utc(2026, 6, 29, 10, 30),
    );
  }
}
