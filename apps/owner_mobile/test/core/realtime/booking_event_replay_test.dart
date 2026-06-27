import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/core/realtime/booking_event_replay.dart';

BookingReplayEvent event(int version, {int? sequence}) {
  return BookingReplayEvent(
    eventId: 'event-$version',
    sequence: sequence ?? version,
    eventType: 'booking.hold.updated.v1',
    schemaVersion: 1,
    aggregateType: 'booking_hold',
    aggregateId: 'hold-1',
    aggregateVersion: version,
    occurredAt: DateTime.utc(2026, 6, 25),
    correlationId: null,
    causationId: null,
    traceparent: null,
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

  test('ignores duplicate sequence and asks for snapshot on sequence gap', () {
    final gate = AggregateVersionGate(2, 9);

    expect(gate.decide(event(3, sequence: 9)), ReplayDecision.ignoreStale);
    expect(gate.decide(event(3, sequence: 12)), ReplayDecision.refreshSnapshot);
    expect(gate.lastSequence, 9);
    expect(gate.decide(event(3, sequence: 10)), ReplayDecision.apply);
    expect(gate.lastSequence, 10);
  });

  test('replay uses sequence cursor and parses realtime envelope', () async {
    final repository = BookingEventReplayRepository(
      baseUrl: Uri.parse('http://127.0.0.1:3000'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        expect(request.url.queryParameters['afterVersion'], '7');
        expect(request.url.queryParameters['afterSequence'], '19');
        return http.Response(
            '''
{
  "holdId": "00000000-0000-4000-8000-000000000001",
  "serverNow": "2026-06-27T10:00:00.000Z",
  "events": [
    {
      "eventId": "00000000-0000-4000-8000-000000000002",
      "eventType": "booking.confirmed.v1",
      "schemaVersion": 1,
      "aggregateType": "booking_hold",
      "aggregateId": "00000000-0000-4000-8000-000000000001",
      "aggregateVersion": 8,
      "sequence": "20",
      "eventSequence": "20",
      "occurredAt": "2026-06-27T09:59:59.000Z",
      "correlationId": "00000000-0000-4000-8000-000000000003",
      "causationId": "00000000-0000-4000-8000-000000000004",
      "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
      "payload": {"state": "CONFIRMED"}
    }
  ]
}
''',
            200,
            headers: {'content-type': 'application/json'});
      }),
    );

    final slice = await repository.replay(
      holdId: '00000000-0000-4000-8000-000000000001',
      afterVersion: 7,
      afterSequence: 19,
    );

    expect(slice.events.single.sequence, 20);
    expect(slice.events.single.aggregateType, 'booking_hold');
    expect(slice.events.single.aggregateVersion, 8);
    expect(slice.events.single.causationId,
        '00000000-0000-4000-8000-000000000004');
    expect(slice.events.single.traceparent,
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
    expect(slice.events.single.payload['state'], 'CONFIRMED');
  });
}
