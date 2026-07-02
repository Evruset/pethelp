import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:vethelp_owner_mobile/features/telemed/owner_telemed_page.dart';
import 'package:vethelp_owner_mobile/features/telemed/owner_telemed_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';

void main() {
  testWidgets('groups sessions only by backend bucket', (tester) async {
    final waitingRepository = _FakeWaitingRepository();
    await tester.pumpWidget(_page(
      repository: _FakeOwnerTelemedRepository([
        _session(bucket: 'ACTIVE', state: 'WAITING_FOR_DOCTOR'),
        _session(bucket: 'HISTORY', state: 'DOCTOR_TIMEOUT'),
      ]),
      waitingRepository: waitingRepository,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Ожидаем врача'), findsOneWidget);
    expect(find.text('Врач не подключился'), findsNothing);

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Врач не подключился'), findsOneWidget);
    expect(find.text('DOCTOR_TIMEOUT'), findsNothing);
  });

  testWidgets('history rows do not open the waiting room', (tester) async {
    final waitingRepository = _FakeWaitingRepository();
    await tester.pumpWidget(_page(
      repository: _FakeOwnerTelemedRepository([
        _session(bucket: 'HISTORY', state: 'DOCTOR_TIMEOUT'),
      ]),
      waitingRepository: waitingRepository,
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Врач не подключился'));
    await tester.pumpAndSettle();

    expect(waitingRepository.readCalls, 0);
    expect(
      find.text(
          'Консультация не состоялась. Статус авторизации оплаты проверяется автоматически.'),
      findsOneWidget,
    );
  });

  testWidgets('history shows owner-cancelled session with payment void copy',
      (tester) async {
    await tester.pumpWidget(_page(
      repository: _FakeOwnerTelemedRepository([
        _session(
          bucket: 'HISTORY',
          state: 'CANCELLED',
          refundState: 'VOID_REQUESTED',
        ),
      ]),
      waitingRepository: _FakeWaitingRepository(),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Консультация отменена'), findsOneWidget);
    expect(find.text('Отменяем авторизацию оплаты.'), findsOneWidget);
    expect(find.textContaining('Возврат'), findsNothing);
  });

  testWidgets('empty active state opens controlled telemed availability',
      (tester) async {
    await tester.pumpWidget(_page(
      repository: _FakeOwnerTelemedRepository(const []),
      waitingRepository: _FakeWaitingRepository(),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Нет активных консультаций'), findsOneWidget);
    await tester.tap(find.text('Выбрать онлайн-консультацию'));
    await tester.pumpAndSettle();

    expect(find.text('Сначала проверим безопасность'), findsOneWidget);
    expect(find.text('Питомец'), findsOneWidget);
    expect(find.text('Выберите клинику'), findsNothing);
  });

  testWidgets('history shows vet recommendation and follow-up clinic CTA',
      (tester) async {
    var clinicOpens = 0;
    await tester.pumpWidget(_page(
      repository: _FakeOwnerTelemedRepository([
        _session(
          bucket: 'HISTORY',
          state: 'COMPLETED',
          recommendationText: 'Наблюдайте аппетит и активность 24 часа.',
          followUpNotes: 'Запишитесь в клинику, если симптомы вернутся.',
          safetyEscalation: true,
        ),
      ]),
      waitingRepository: _FakeWaitingRepository(),
      onBrowseClinics: () => clinicOpens += 1,
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('История'));
    await tester.pumpAndSettle();

    expect(find.text('Рекомендация врача'), findsOneWidget);
    expect(
        find.text('Наблюдайте аппетит и активность 24 часа.'), findsOneWidget);
    expect(find.text('Следующий шаг'), findsOneWidget);
    expect(find.text('Запишитесь в клинику, если симптомы вернутся.'),
        findsOneWidget);
    expect(find.text('Нужен очный осмотр'), findsOneWidget);

    await tester.tap(find.text('Выбрать клинику'));
    await tester.pumpAndSettle();

    expect(clinicOpens, 1);
  });

  testWidgets('iOS maps telemed statuses and hides raw technical values',
      (tester) async {
    await tester.pumpWidget(_iosPage(
      repository: _FakeOwnerTelemedRepository([
        _session(bucket: 'ACTIVE', state: 'WAITING_FOR_DOCTOR'),
        _session(bucket: 'HISTORY', state: 'DOCTOR_TIMEOUT'),
        _session(bucket: 'HISTORY', state: 'CANCELLED'),
        _session(bucket: 'HISTORY', state: 'COMPLETED'),
      ]),
      waitingRepository: _FakeWaitingRepository(),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    expect(find.text('Ожидаем врача'), findsOneWidget);
    expect(find.text('Врач не подключился'), findsOneWidget);
    expect(find.text('Консультация отменена'), findsOneWidget);
    expect(find.text('Консультация завершена'), findsOneWidget);
    expect(find.textContaining('WAITING_FOR_DOCTOR'), findsNothing);
    expect(find.textContaining('DOCTOR_TIMEOUT'), findsNothing);
    expect(find.textContaining('queue'), findsNothing);
    expect(find.textContaining('409'), findsNothing);
  });

  testWidgets('iOS safety escalation opens clinics and emergency actions',
      (tester) async {
    var clinicOpens = 0;
    var emergencyOpens = 0;

    await tester.pumpWidget(_iosPage(
      repository: _FakeOwnerTelemedRepository([
        _session(
          bucket: 'HISTORY',
          state: 'COMPLETED',
          followUpNotes: 'Нужен очный контроль.',
          safetyEscalation: true,
        ),
      ]),
      waitingRepository: _FakeWaitingRepository(),
      onBrowseClinics: () => clinicOpens += 1,
      onRequestEmergency: () => emergencyOpens += 1,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Нужен очный осмотр'), findsOneWidget);
    await tester.ensureVisible(find.text('Выбрать клинику'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Выбрать клинику'));
    await tester.pump();
    await tester.ensureVisible(find.text('Срочные клиники').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Срочные клиники').last);
    await tester.pump();

    expect(clinicOpens, 1);
    expect(emergencyOpens, 1);
  });

  testWidgets('iOS intake keeps consent accessible and avoids price claims',
      (tester) async {
    final repository = _FakeOwnerTelemedRepository(const []);

    await tester.pumpWidget(_iosPage(
      repository: repository,
      waitingRepository: _FakeWaitingRepository(),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Проверить онлайн-консультацию'));
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoPageScaffold), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -520));
    await tester.pumpAndSettle();
    expect(
        find.text('Понимаю ограничения онлайн-консультации и хочу продолжить'),
        findsOneWidget);
    expect(find.byType(CupertinoSwitch), findsWidgets);
    expect(find.textContaining('1500'), findsNothing);
    expect(find.textContaining('оплат'), findsNothing);

    await tester.ensureVisible(find.byType(CupertinoSwitch).last);
    await tester.pumpAndSettle();
    await tester.tap(find.byType(CupertinoSwitch).last);
    await tester.pump();
    await tester.ensureVisible(find.text('Проверить возможность онлайн'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Проверить возможность онлайн'));
    await tester.pumpAndSettle();

    expect(repository.intakeCalls, 1);
    expect(find.text('Онлайн-консультация подходит'), findsOneWidget);
    expect(find.text('Продолжить к следующему шагу'), findsOneWidget);
    expect(find.textContaining('1500'), findsNothing);
    expect(find.textContaining('Перейти к оплате'), findsNothing);
  });

  testWidgets('iOS active session preserves waiting-room handoff',
      (tester) async {
    final now = DateTime.utc(2026, 6, 26, 12);
    final waitingRepository = _FakeWaitingRepository(
      waiting: TelemedWaitingSnapshot(
        sessionId: '00000000-0000-4000-8000-000000000001',
        state: TelemedWaitingStateKind.waitingForDoctor,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 1,
      ),
    );

    await tester.pumpWidget(_iosPage(
      repository: _FakeOwnerTelemedRepository([
        _session(bucket: 'ACTIVE', state: 'WAITING_FOR_DOCTOR'),
      ]),
      waitingRepository: waitingRepository,
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ожидаем врача'));
    await tester.pumpAndSettle();

    expect(waitingRepository.readCalls, 1);
    expect(find.text('Ожидаем подключения врача'), findsOneWidget);
    expect(find.byType(CupertinoAlertDialog), findsNothing);
  });
}

Widget _page({
  required OwnerTelemedRepository repository,
  required TelemedWaitingRepository waitingRepository,
  VoidCallback? onBrowseClinics,
}) {
  return MaterialApp(
    home: OwnerTelemedPage(
      repository: repository,
      waitingRepository: waitingRepository,
      roomAccessRepository: _FakeRoomAccessRepository(),
      onBrowseClinics: onBrowseClinics,
    ),
  );
}

Widget _iosPage({
  required OwnerTelemedRepository repository,
  required TelemedWaitingRepository waitingRepository,
  VoidCallback? onBrowseClinics,
  VoidCallback? onRequestEmergency,
}) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, child) => Theme(
      data: ThemeData(useMaterial3: true, platform: TargetPlatform.iOS),
      child: child ?? const SizedBox.shrink(),
    ),
    home: OwnerTelemedPage(
      platformOverride: TargetPlatform.iOS,
      repository: repository,
      waitingRepository: waitingRepository,
      roomAccessRepository: _FakeRoomAccessRepository(),
      onBrowseClinics: onBrowseClinics,
      onRequestEmergency: onRequestEmergency,
    ),
  );
}

OwnerTelemedSession _session({
  required String bucket,
  required String state,
  String? refundState,
  String? recommendationText,
  String? followUpNotes,
  bool? safetyEscalation,
}) {
  final startsAt = DateTime.utc(2026, 6, 26, 12);
  return OwnerTelemedSession(
    sessionId: '00000000-0000-4000-8000-000000000001',
    bookingHoldId: '00000000-0000-4000-8000-000000000002',
    telemedCaseId: null,
    state: state,
    telemedCaseState: null,
    paymentStatus: null,
    refundState: refundState,
    recommendationText: recommendationText,
    followUpNotes: followUpNotes,
    safetyEscalation: safetyEscalation,
    bucket: bucket,
    startsAt: startsAt,
    endsAt: startsAt.add(const Duration(minutes: 30)),
    doctorJoinDeadlineAt: startsAt.add(const Duration(minutes: 5)),
    serverNow: startsAt,
    version: 1,
    clinicName: 'VetHelp',
    clinicAddress: 'Test address',
    petName: 'Барсик',
    petSpecies: 'CAT',
    serviceName: 'Онлайн-консультация',
  );
}

class _FakeOwnerTelemedRepository implements OwnerTelemedRepository {
  _FakeOwnerTelemedRepository(this.sessions);

  final List<OwnerTelemedSession> sessions;
  int intakeCalls = 0;
  TelemedIntakeInput? lastInput;

  @override
  Future<List<OwnerTelemedSession>> list() async => sessions;

  @override
  Future<TelemedIntakeResult> createIntake(TelemedIntakeInput input) async {
    intakeCalls += 1;
    lastInput = input;
    return TelemedIntakeResult(
      intakeId: '00000000-0000-4000-8000-000000000003',
      outcome: 'TELEMED_ELIGIBLE',
      routingTarget: 'TELEMED_PAYMENT_QUEUE',
      nextStep: 'Continue to telemedicine payment and doctor queue.',
      guardrails: const [
        'Telemedicine does not replace emergency care.',
      ],
      createdAt: DateTime.utc(2026, 6, 26, 12),
    );
  }

  @override
  Future<List<TelemedPet>> listPets() async => const [
        TelemedPet(
          id: '00000000-0000-4000-8000-000000000004',
          name: 'Барсик',
          species: 'CAT',
        ),
      ];

  @override
  Future<TelemedPaymentIntent> createPaymentIntent(String intakeId) async {
    return const TelemedPaymentIntent(
      caseId: '00000000-0000-4000-8000-000000000005',
      intakeId: '00000000-0000-4000-8000-000000000003',
      paymentIntentId: '00000000-0000-4000-8000-000000000006',
      paymentFenceToken: '00000000-0000-4000-8000-000000000007',
      refundPolicyVersion: 'telemed-refund-v1',
      amount: '1500.00',
      currency: 'RUB',
      status: 'CREATED',
      idempotencyKey: '00000000-0000-4000-8000-000000000008',
      checkoutUrl: 'https://pay.example.test/checkout',
    );
  }
}

class _FakeWaitingRepository implements TelemedWaitingRepository {
  _FakeWaitingRepository({this.waiting});

  final TelemedWaitingSnapshot? waiting;
  int readCalls = 0;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async {
    readCalls += 1;
    final snapshot = waiting;
    if (snapshot != null) return snapshot;
    throw UnsupportedError('History rows must not request the waiting room.');
  }

  @override
  Future<TelemedWaitingSnapshot> cancelSession(String sessionId) async {
    throw UnsupportedError('History rows must not cancel the waiting room.');
  }
}

class _FakeRoomAccessRepository implements TelemedRoomAccessRepository {
  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) async {
    throw UnsupportedError('History rows must not request room access.');
  }
}
