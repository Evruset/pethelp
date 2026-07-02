import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_page.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';

void main() {
  testWidgets('renders active appointments from backend presentation',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OwnerAppointmentsPage(
            repository: _FakeOwnerAppointmentsRepository(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('VetHelp Pilot'), findsOneWidget);
    expect(find.textContaining('Барс'), findsOneWidget);
    expect(find.text('Ждём подтверждения клиники'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('history shows server-owned past-visit wording', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OwnerAppointmentsPage(
            repository: _FakeOwnerAppointmentsRepository(historyOnly: true),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Время визита прошло'), findsOneWidget);
    expect(find.text('Обновляется'), findsNothing);
    expect(find.text('Визит состоялся'), findsNothing);
  });

  testWidgets('iOS appointments list uses Cupertino and hides raw states',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        OwnerAppointmentsPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeOwnerAppointmentsRepository(
            state: 'CANCELLATION_REQUESTED',
            presentation: const OwnerAppointmentPresentation(
              code: 'STATUS_SYNCING',
              label: 'CANCELLATION_REQUESTED',
              description: 'snapshot 409 CANCELLATION_REQUESTED',
              tone: 'warning',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.byType(CupertinoSlidingSegmentedControl<int>), findsOneWidget);
    expect(find.byType(TabBar), findsNothing);
    expect(find.byType(Card), findsNothing);
    expect(find.text('Запрошена отмена'), findsOneWidget);
    expect(find.textContaining('CANCELLATION_REQUESTED'), findsNothing);
    expect(find.textContaining('409'), findsNothing);
    expect(find.textContaining('snapshot'), findsNothing);
  });

  testWidgets('iOS detail cancellation uses destructive confirmation',
      (tester) async {
    final repository = _FakeOwnerAppointmentsRepository(
      actions: const OwnerAppointmentActions(
        canRefresh: true,
        canRebook: true,
        canOpenRoute: true,
        canReviewAlternative: false,
        canCancel: true,
      ),
      locationPhone: '+79991234567',
    );

    await tester.pumpWidget(
      _iosHarness(
        OwnerAppointmentsPage(
          platformOverride: TargetPlatform.iOS,
          repository: repository,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('VetHelp Pilot').first);
    await tester.pumpAndSettle();

    expect(find.text('Когда и где'), findsOneWidget);
    expect(find.text('Что сейчас важно'), findsOneWidget);
    expect(find.text('Перед визитом'), findsOneWidget);
    expect(find.text('Питомец и услуга'), findsOneWidget);
    expect(find.text('История статуса'), findsOneWidget);
    expect(find.text('Маршрут'), findsOneWidget);
    expect(find.text('Позвонить в клинику'), findsOneWidget);
    expect(find.text('Обновить'), findsOneWidget);

    await tester.ensureVisible(find.text('Запросить отмену'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Запросить отмену'));
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoAlertDialog), findsOneWidget);
    final destructiveActions = tester
        .widgetList<CupertinoDialogAction>(
          find.byType(CupertinoDialogAction),
        )
        .where((action) => action.isDestructiveAction);
    expect(destructiveActions.length, 1);

    await tester.tap(find.text('Запросить отмену').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();

    expect(repository.cancellationRequests, 1);
    expect(find.text('Запрошена отмена'), findsWidgets);
    expect(find.textContaining('CANCELLATION_REQUESTED'), findsNothing);
    expect(find.textContaining('возврат'), findsNothing);
    expect(find.textContaining('мгновенно отменена'), findsNothing);
    expect(
        find.text(
            'Запрос на отмену отправлен. Клиника подтвердит итоговый статус.'),
        findsOneWidget);
  });

  testWidgets('iOS appointment lifecycle shows hierarchy and no fake actions',
      (tester) async {
    await tester.pumpWidget(
      _iosHarness(
        OwnerAppointmentsPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeOwnerAppointmentsRepository(
            state: 'CONFIRMED',
            presentation: const OwnerAppointmentPresentation(
              code: 'CONFIRMED_UPCOMING',
              label: 'CONFIRMED',
              description: 'snapshot 409',
              tone: 'success',
            ),
            actions: const OwnerAppointmentActions(
              canRefresh: true,
              canRebook: false,
              canOpenRoute: true,
              canReviewAlternative: false,
              canCancel: true,
            ),
            locationPhone: '+79991234567',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('VetHelp Pilot').first);
    await tester.pumpAndSettle();

    expect(find.text('Визит подтверждён'), findsWidgets);
    expect(find.text('Что сейчас важно'), findsOneWidget);
    expect(find.text('Когда и где'), findsOneWidget);
    expect(find.text('Перед визитом'), findsOneWidget);
    expect(find.text('Питомец и услуга'), findsOneWidget);
    expect(find.text('Действия'), findsOneWidget);
    expect(find.text('Маршрут'), findsOneWidget);
    expect(find.text('Позвонить в клинику'), findsOneWidget);
    expect(find.textContaining('CONFIRMED'), findsNothing);
    expect(find.textContaining('snapshot'), findsNothing);
    expect(find.textContaining('409'), findsNothing);
    expect(find.textContaining('Календар'), findsNothing);
    expect(find.textContaining('возврат'), findsNothing);
    expect(find.textContaining('Перенести'), findsNothing);
  });

  testWidgets('completed iOS appointment opens Pet Diary and rebooking context',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(834, 1194));
    var openedDiary = false;
    var openedRebooking = false;
    await tester.pumpWidget(
      _iosHarness(
        OwnerAppointmentsPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeOwnerAppointmentsRepository(
            historyOnly: true,
            state: 'COMPLETED',
            detailBucket: 'HISTORY',
            presentation: const OwnerAppointmentPresentation(
              code: 'HISTORY_RECORDED',
              label: 'COMPLETED',
              description: 'snapshot payload',
              tone: 'success',
            ),
            actions: const OwnerAppointmentActions(
              canRefresh: false,
              canRebook: true,
              canOpenRoute: false,
              canReviewAlternative: false,
              canCancel: false,
            ),
          ),
          onOpenPetDiary: () => openedDiary = true,
          onRebookAppointment: () => openedRebooking = true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('VetHelp Pilot').first);
    await tester.pumpAndSettle();

    expect(find.text('Визит завершён'), findsWidgets);
    expect(find.text('После визита'), findsOneWidget);
    expect(find.text('Открыть дневник питомца'), findsOneWidget);
    expect(find.text('Подобрать повторную запись'), findsOneWidget);
    expect(find.textContaining('COMPLETED'), findsNothing);
    expect(find.textContaining('snapshot'), findsNothing);

    await tester.ensureVisible(find.text('Открыть дневник питомца'));
    await tester.tap(find.text('Открыть дневник питомца'));
    expect(openedDiary, isTrue);
    await tester.ensureVisible(find.text('Подобрать повторную запись'));
    await tester.tap(find.text('Подобрать повторную запись'));
    expect(openedRebooking, isTrue);
  });

  testWidgets('iOS appointment detail supports dark mode and Dynamic Type',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(834, 1194));
    await tester.pumpWidget(
      _iosHarness(
        OwnerAppointmentsPage(
          platformOverride: TargetPlatform.iOS,
          repository: _FakeOwnerAppointmentsRepository(
            locationPhone: '+79991234567',
          ),
        ),
        brightness: Brightness.dark,
        textScale: 2,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('VetHelp Pilot').first);
    await tester.pumpAndSettle();

    expect(
      CupertinoTheme.of(tester.element(find.text('Детали записи'))).brightness,
      Brightness.dark,
    );
    final cancelButton = find.ancestor(
      of: find.text('Запросить отмену'),
      matching: find.byType(CupertinoButton),
    );
    await tester.ensureVisible(find.text('Запросить отмену'));
    expect(tester.getSize(cancelButton.first).height, greaterThanOrEqualTo(44));
    expect(tester.takeException(), isNull);
  });

  testWidgets('iOS status mapper suppresses raw state names for known states',
      (tester) async {
    const states = [
      'MANUAL_CONFIRM_PENDING',
      'MIS_RESERVATION_PENDING',
      'ALTERNATIVE_PENDING',
      'CONFIRMED',
      'CANCELLATION_REQUESTED',
      'RESCHEDULE_REQUESTED',
      'COMPLETED',
      'SLA_BREACHED',
      'RELEASED',
      'MIS_BOOKING_FAILED',
    ];

    for (final state in states) {
      await tester.pumpWidget(
        _iosHarness(
          OwnerAppointmentsPage(
            platformOverride: TargetPlatform.iOS,
            repository: _FakeOwnerAppointmentsRepository(
              state: state,
              presentation: OwnerAppointmentPresentation(
                code: 'RAW_$state',
                label: state,
                description: 'snapshot $state 409',
                tone: 'info',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining(state), findsNothing);
      expect(find.textContaining('snapshot'), findsNothing);
      expect(find.textContaining('409'), findsNothing);
    }
  });
}

Widget _iosHarness(
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
          data: ThemeData(useMaterial3: true, platform: TargetPlatform.iOS),
          child: child ?? const SizedBox.shrink(),
        ),
      );
    },
    home: child,
  );
}

class _FakeOwnerAppointmentsRepository implements OwnerAppointmentsRepository {
  _FakeOwnerAppointmentsRepository({
    this.historyOnly = false,
    this.state,
    this.presentation,
    this.actions = const OwnerAppointmentActions(
      canRefresh: true,
      canRebook: true,
      canOpenRoute: false,
      canReviewAlternative: false,
      canCancel: true,
    ),
    this.locationPhone,
    this.detailBucket,
  });

  final bool historyOnly;
  final String? state;
  final OwnerAppointmentPresentation? presentation;
  final OwnerAppointmentActions actions;
  final String? locationPhone;
  final String? detailBucket;
  int cancellationRequests = 0;

  static const _activePresentation = OwnerAppointmentPresentation(
    code: 'WAITING_FOR_CLINIC',
    label: 'Ожидаем подтверждения',
    description: 'Клиника проверяет возможность записи.',
    tone: 'info',
  );

  static const _historyPresentation = OwnerAppointmentPresentation(
    code: 'VISIT_TIME_PASSED',
    label: 'Время визита прошло',
    description: 'Клиника пока не передала отметку о фактическом визите.',
    tone: 'neutral',
  );

  @override
  Future<List<OwnerAppointment>> list() async => [
        OwnerAppointment(
          holdId: '11111111-1111-4111-8111-111111111111',
          appointmentId: null,
          state:
              state ?? (historyOnly ? 'CONFIRMED' : 'MANUAL_CONFIRM_PENDING'),
          bucket: historyOnly ? 'HISTORY' : 'ACTIVE',
          presentation: presentation ??
              (historyOnly ? _historyPresentation : _activePresentation),
          startsAt: DateTime.utc(2026, 6, 26, 10),
          endsAt: DateTime.utc(2026, 6, 26, 10, 30),
          clinicName: 'VetHelp Pilot',
          clinicAddress: 'Pilotnaya 1',
          petName: 'Барс',
        ),
      ];

  @override
  Future<OwnerAppointmentDetail> readDetail(String holdId) async {
    final cancelled = cancellationRequests > 0;
    return OwnerAppointmentDetail(
      holdId: holdId,
      appointmentId: null,
      state: cancelled
          ? 'CANCELLATION_REQUESTED'
          : state ?? 'MANUAL_CONFIRM_PENDING',
      bucket: detailBucket ?? (historyOnly ? 'HISTORY' : 'ACTIVE'),
      presentation: cancelled
          ? const OwnerAppointmentPresentation(
              code: 'STATUS_SYNCING',
              label: 'Запрошена отмена',
              description:
                  'Менеджер поддержки свяжется с клиникой и подтвердит результат.',
              tone: 'warning',
            )
          : presentation ?? _activePresentation,
      version: 1,
      startsAt: DateTime.utc(2026, 6, 26, 10),
      endsAt: DateTime.utc(2026, 6, 26, 10, 30),
      expiresAt: DateTime.utc(2026, 6, 25, 20),
      latestStatusUpdateAt: DateTime.utc(2026, 6, 25, 19),
      serverNow: DateTime.utc(2026, 6, 25, 19, 5),
      clinicName: 'VetHelp Pilot',
      clinicAddress: 'Pilotnaya 1',
      locationPhone: locationPhone,
      locationLatitude: null,
      locationLongitude: null,
      petName: 'Барс',
      petSpecies: 'CAT',
      serviceName: 'Первичный приём',
      priceAmount: '1000.00',
      currency: 'RUB',
      timeline: [
        OwnerAppointmentTimelineItem(
          at: DateTime.utc(2026, 6, 25, 19),
          type: 'booking.hold.created',
          label: 'Заявка создана',
        ),
      ],
      actions: actions,
    );
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async =>
      BookingHoldSnapshot(
        holdId: holdId,
        slotId: 'slot-1',
        state: 'MANUAL_CONFIRM_PENDING',
        expiresAt: DateTime.utc(2026, 6, 25, 20),
        startsAt: DateTime.utc(2026, 6, 26, 10),
        endsAt: DateTime.utc(2026, 6, 26, 10, 30),
      );

  @override
  Future<ReleasedBookingHold> releaseHold(String holdId) async =>
      ReleasedBookingHold(
        holdId: holdId,
        state: 'RELEASED',
        slotId: 'slot-1',
        correlationId: '11111111-1111-4111-8111-111111111112',
      );

  @override
  Future<RequestedBookingCancellation> requestCancellation(
      String holdId) async {
    cancellationRequests += 1;
    return RequestedBookingCancellation(
      holdId: holdId,
      state: 'CANCELLATION_REQUESTED',
      slotId: 'slot-1',
      correlationId: '11111111-1111-4111-8111-111111111113',
    );
  }
}
