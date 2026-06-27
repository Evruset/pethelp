import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_repository.dart';

class FakeRepository implements TelemedWaitingRepository {
  FakeRepository(this.snapshot, {this.cancelSnapshot, this.cancelError});
  final TelemedWaitingSnapshot snapshot;
  final TelemedWaitingSnapshot? cancelSnapshot;
  final String? cancelError;
  int cancelCalls = 0;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async =>
      snapshot;

  @override
  Future<TelemedWaitingSnapshot> cancelSession(String sessionId) async {
    cancelCalls += 1;
    final error = cancelError;
    if (error != null) throw TelemedWaitingApiException(error);
    return cancelSnapshot ?? snapshot;
  }
}

class FakeRoomAccessRepository implements TelemedRoomAccessRepository {
  int calls = 0;

  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) async {
    calls += 1;
    return TelemedRoomAccess(
      sessionId: sessionId,
      version: 2,
      accessToken: 'owner-room-token',
      tokenExpiresAt: DateTime.utc(2026, 6, 26, 12, 30),
      livekitUrl: 'ws://127.0.0.1:7880',
    );
  }
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
    final roomAccessRepository = FakeRoomAccessRepository();
    final bloc = TelemedWaitingBloc(
      repository: FakeRepository(TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.connected,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 2,
      )),
      roomAccessRepository: roomAccessRepository,
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(bloc.state, isA<TelemedRoomReady>());
    expect(roomAccessRepository.calls, 1);
    bloc.add(const TelemedWaitingRefreshRequested());
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(bloc.state, isA<TelemedRoomReady>());
    expect(roomAccessRepository.calls, 1);
    await bloc.close();
  });

  test('doctor timeout preserves backend payment snapshot', () async {
    final now = DateTime.now().toUtc();
    final bloc = TelemedWaitingBloc(
      repository: FakeRepository(TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.doctorTimeout,
        doctorJoinDeadlineAt: now,
        serverNow: now,
        version: 2,
        paymentStatus: 'VOID_REQUESTED',
        refundState: 'VOID_REQUESTED',
      )),
      roomAccessRepository: FakeRoomAccessRepository(),
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));

    final state = bloc.state;
    expect(state, isA<TelemedDoctorTimeout>());
    expect(
        (state as TelemedDoctorTimeout).snapshot.refundState, 'VOID_REQUESTED');
    await bloc.close();
  });

  test('owner can cancel waiting session before doctor connection', () async {
    final now = DateTime.now().toUtc();
    final repository = FakeRepository(
      TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.waitingForDoctor,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 1,
      ),
      cancelSnapshot: TelemedWaitingSnapshot(
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
    final bloc = TelemedWaitingBloc(
      repository: repository,
      roomAccessRepository: FakeRoomAccessRepository(),
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    bloc.add(const TelemedWaitingCancelRequested());
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(repository.cancelCalls, 1);
    expect(bloc.state, isA<TelemedCancelled>());
    await bloc.close();
  });

  test('cancel conflict returns to waiting state with message', () async {
    final now = DateTime.now().toUtc();
    final repository = FakeRepository(
      TelemedWaitingSnapshot(
        sessionId: 'session-1',
        state: TelemedWaitingStateKind.waitingForDoctor,
        doctorJoinDeadlineAt: now.add(const Duration(minutes: 5)),
        serverNow: now,
        version: 1,
      ),
      cancelError: 'TELEMED_SESSION_NOT_CANCELLABLE',
    );
    final bloc = TelemedWaitingBloc(
      repository: repository,
      roomAccessRepository: FakeRoomAccessRepository(),
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    bloc.add(const TelemedWaitingCancelRequested());
    await Future<void>.delayed(const Duration(milliseconds: 10));

    final state = bloc.state;
    expect(state, isA<TelemedWaitingForDoctor>());
    expect((state as TelemedWaitingForDoctor).cancelError, contains('Врач'));
    await bloc.close();
  });
}
