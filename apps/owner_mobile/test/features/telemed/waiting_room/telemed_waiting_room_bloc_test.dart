import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';

class FakeRepository implements TelemedWaitingRepository {
  FakeRepository(this.snapshot);
  final TelemedWaitingSnapshot snapshot;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async => snapshot;
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
    );

    bloc.add(const TelemedWaitingOpened('session-1'));
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(bloc.state, isA<TelemedWaitingForDoctor>());
    await bloc.close();
  });
}
