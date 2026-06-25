import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/core/realtime/booking_event_replay.dart';

BookingReplayEvent event(int version) {
  return BookingReplayEvent(
    eventId: 'event-$version',
    eventSequence: version,
    eventType: 'booking.hold.updated.v1',
    aggregateVersion: version,
    occurredAt: DateTime.utc(2026, 6, 25),
    payload: const <String, Object?>{},
  );
}

void main() {
  test('ignores stale events and asks for snapshot on a version gap', () {
    final gate = AggregateVersionGate(2);

    expect(gate.decide(event(2)), ReplayDecision.ignoreStale);
    expect(gate.decide(event(4)), ReplayDecision.refreshSnapshot);
    expect(gate.version, 2);
    expect(gate.decide(event(3)), ReplayDecision.apply);
    expect(gate.version, 3);
  });
}
