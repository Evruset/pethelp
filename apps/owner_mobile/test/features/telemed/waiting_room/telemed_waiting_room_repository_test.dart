import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_bloc.dart';
import 'package:vethelp_owner_mobile/features/telemed/waiting_room/telemed_waiting_room_repository.dart';

void main() {
  test('cancelSession posts idempotent owner cancellation request', () async {
    final seenIdempotencyKeys = <String>[];
    final repository = HttpTelemedWaitingRepository(
      baseUrl: Uri.parse('http://127.0.0.1:3000'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/v1/telemed/sessions/session-1/cancel');
        expect(request.headers['Authorization'], 'Bearer owner-token');
        expect(request.headers['Accept'], 'application/json');
        final idempotencyKey = request.headers['Idempotency-Key'];
        expect(idempotencyKey, isNotNull);
        seenIdempotencyKeys.add(idempotencyKey!);
        return http.Response(
            '''
{
  "sessionId": "session-1",
  "state": "CANCELLED",
  "telemedCaseState": "CANCELLED_BY_OWNER",
  "paymentStatus": "VOID_REQUESTED",
  "refundState": "VOID_REQUESTED",
  "version": 2,
  "serverNow": "2026-06-26T12:00:00.000Z"
}
''',
            200,
            headers: {'content-type': 'application/json'});
      }),
    );

    final first = await repository.cancelSession('session-1');
    final second = await repository.cancelSession('session-1');

    expect(first.state, TelemedWaitingStateKind.cancelled);
    expect(first.refundState, 'VOID_REQUESTED');
    expect(second.state, TelemedWaitingStateKind.cancelled);
    expect(seenIdempotencyKeys, hasLength(2));
    expect(seenIdempotencyKeys.first, seenIdempotencyKeys.last);
  });
}
