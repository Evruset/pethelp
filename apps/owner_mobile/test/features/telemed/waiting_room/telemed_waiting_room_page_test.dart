import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_page.dart';

void main() {
  testWidgets('owner confirms cancellation and sees authorization void status',
      (tester) async {
    final now = DateTime.utc(2026, 6, 26, 12);
    final repository = _FakeWaitingRepository(
      waiting: TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.waitingForDoctor,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 1,
      ),
      cancelled: TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.cancelled,
        doctorJoinDeadlineAt: now,
        serverNow: now,
        version: 2,
        telemedCaseState: 'CANCELLED_BY_OWNER',
        paymentStatus: 'VOID_REQUESTED',
        refundState: 'VOID_REQUESTED',
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: TelemedWaitingRoomPage(
        sessionId: 'session-1',
        repository: repository,
        roomAccessRepository: _FakeRoomAccessRepository(),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Отменить консультацию'));
    await tester.pumpAndSettle();
    expect(find.text('Отменить онлайн-консультацию?'), findsOneWidget);

    await tester.tap(find.text('Да, отменить'));
    await tester.pumpAndSettle();

    expect(repository.cancelCalls, 1);
    expect(find.text('Консультация отменена'), findsOneWidget);
    expect(
      find.text(
          'Отменяем авторизацию оплаты. Списания по этой консультации не будет.'),
      findsOneWidget,
    );
  });

  testWidgets('doctor timeout shows backend void status and clinic CTA',
      (tester) async {
    final now = DateTime.utc(2026, 6, 26, 12);
    var clinicOpens = 0;
    final repository = _FakeWaitingRepository(
      waiting: TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.doctorTimeout,
        doctorJoinDeadlineAt: now,
        serverNow: now,
        version: 2,
        paymentStatus: 'VOID_REQUESTED',
        refundState: 'VOID_REQUESTED',
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: TelemedWaitingRoomPage(
        sessionId: 'session-1',
        repository: repository,
        roomAccessRepository: _FakeRoomAccessRepository(),
        onBrowseClinics: () => clinicOpens += 1,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Врач не вышел на связь'), findsOneWidget);
    expect(
      find.text(
          'Отменяем авторизацию оплаты. Списания по этой консультации не будет.'),
      findsOneWidget,
    );

    await tester.tap(find.text('Выбрать клинику'));
    await tester.pumpAndSettle();

    expect(clinicOpens, 1);
  });

  testWidgets('connected session opens injected live call surface',
      (tester) async {
    final now = DateTime.utc(2026, 6, 26, 12);
    final repository = _FakeWaitingRepository(
      waiting: TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.connected,
        doctorJoinDeadlineAt: now,
        serverNow: now,
        version: 2,
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: TelemedWaitingRoomPage(
        sessionId: 'session-1',
        repository: repository,
        roomAccessRepository: _FakeRoomAccessRepository(
          access: TelemedRoomAccess(
            sessionId: 'session-1',
            version: 2,
            accessToken: 'livekit-token',
            tokenExpiresAt: now.add(const Duration(minutes: 10)),
            livekitUrl: 'wss://livekit.example.test',
          ),
        ),
        liveCallBuilder: (_, access) => Text('Live call ${access.sessionId}'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Live call session-1'), findsOneWidget);
  });
}

class _FakeWaitingRepository implements TelemedWaitingRepository {
  _FakeWaitingRepository({required this.waiting, this.cancelled});

  final TelemedWaitingSnapshot waiting;
  final TelemedWaitingSnapshot? cancelled;
  int cancelCalls = 0;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async => waiting;

  @override
  Future<TelemedWaitingSnapshot> cancelSession(String sessionId) async {
    cancelCalls += 1;
    return cancelled ?? waiting;
  }
}

class _FakeRoomAccessRepository implements TelemedRoomAccessRepository {
  _FakeRoomAccessRepository({this.access});

  final TelemedRoomAccess? access;

  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) async {
    final roomAccess = access;
    if (roomAccess != null) return roomAccess;
    throw UnsupportedError('Cancellation test should not open a room.');
  }
}
