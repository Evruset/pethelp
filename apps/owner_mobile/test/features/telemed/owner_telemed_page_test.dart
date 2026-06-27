import 'package:flutter/material.dart';
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
          'Консультация не состоялась. Статус оплаты проверяется автоматически.'),
      findsOneWidget,
    );
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
}

Widget _page({
  required OwnerTelemedRepository repository,
  required TelemedWaitingRepository waitingRepository,
}) {
  return MaterialApp(
    home: OwnerTelemedPage(
      repository: repository,
      waitingRepository: waitingRepository,
      roomAccessRepository: _FakeRoomAccessRepository(),
    ),
  );
}

OwnerTelemedSession _session({required String bucket, required String state}) {
  final startsAt = DateTime.utc(2026, 6, 26, 12);
  return OwnerTelemedSession(
    sessionId: '00000000-0000-4000-8000-000000000001',
    bookingHoldId: '00000000-0000-4000-8000-000000000002',
    telemedCaseId: null,
    state: state,
    telemedCaseState: null,
    paymentStatus: null,
    refundState: null,
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
  const _FakeOwnerTelemedRepository(this.sessions);

  final List<OwnerTelemedSession> sessions;

  @override
  Future<List<OwnerTelemedSession>> list() async => sessions;

  @override
  Future<TelemedIntakeResult> createIntake(TelemedIntakeInput input) async {
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
  int readCalls = 0;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async {
    readCalls += 1;
    throw UnsupportedError('History rows must not request the waiting room.');
  }
}

class _FakeRoomAccessRepository implements TelemedRoomAccessRepository {
  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) async {
    throw UnsupportedError('History rows must not request room access.');
  }
}
