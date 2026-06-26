import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';

class FakeRepository implements TelemedWaitingRepository {
  FakeRepository(this.snapshot);
  final TelemedWaitingSnapshot snapshot;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async =>
      snapshot;
}

class FakeRoomAccessRepository implements TelemedRoomAccessRepository {
  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) async =>
      TelemedRoomAccess(
        sessionId: sessionId,
        version: 2,
        accessToken: 'owner-room-token',
        tokenExpiresAt: DateTime.utc(2026, 6, 26, 12, 30),
        livekitUrl: 'ws://127.0.0.1:7880',
      );
}

void main() {
  test('remaining time uses the server clock offset', () {
    final now = DateTime.now().toUtc();
    final snapshot = TelemedWaitingSnapshot(
      sessionId: 'session-1',
      state: TelemedWaitingStateKind.waitingForDoctor,
      doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
      serverNow: now.add(const Duration(seconds: 10)),
      version: 1,
    );

    expect(snapshot.remainingAt(now).inMinutes, inInclusiveRange(4, 5));
  });

  test('repository snapshot is mapped to waiting state', () async {
    final now = DateTime.now().toUtc();
    final bloc = TelemedWaitingBloc(
      repository: FakeRepository(TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.waitingForDoctor,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 1,
      )),
      roomAccessRepository: FakeRoomAccessRepository(),
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(bloc.state, isA<TelemedWaitingForDoctor>());
    await bloc.close();
  });

  test('connected snapshot requests owner room access', () async {
    final now = DateTime.now().toUtc();
    final bloc = TelemedWaitingBloc(
      repository: FakeRepository(TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.connected,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 2,
      )),
      roomAccessRepository: FakeRoomAccessRepository(),
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(bloc.state, isA<TelemedRoomReady>());
    await bloc.close();
  });
}
