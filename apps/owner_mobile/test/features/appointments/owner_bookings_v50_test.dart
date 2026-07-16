import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_bookings_v50_feature_flags.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_bookings_v50_repository.dart';

void main() {
  test('flags are default off and dependency ordered', () {
    expect(ownerBookingsV50Flags(shellEnabled: true),
        const TypeMatcher<OwnerBookingsV50Flags>());
    expect(ownerBookingsV50Flags(shellEnabled: true).myBookings, isFalse);
    final invalid = ownerBookingsV50Flags(
        shellEnabled: false,
        myBookingsValue: 'true',
        detailValue: 'true',
        cancellationValue: 'true');
    expect([invalid.myBookings, invalid.detail, invalid.cancellation],
        everyElement(isFalse));
    final partial = ownerBookingsV50Flags(
        shellEnabled: true,
        myBookingsValue: 'true',
        detailValue: 'false',
        cancellationValue: 'true');
    expect(partial.myBookings, isTrue);
    expect(partial.cancellation, isFalse);
  });
  test(
      'parses server buckets without client rebucketing and sends filters/cursor',
      () async {
    final repo = HttpOwnerBookingsV50Repository(
        baseUrl: Uri.parse('http://x/'),
        accessToken: () async => 't',
        client: MockClient((r) async {
          expect(r.url.queryParameters['cursor'], 'next');
          expect(r.url.queryParameters['petId'], 'pet-1');
          return http.Response.bytes(
              utf8.encode(
                  '{"serverNow":"2026-07-16T10:00:00Z","requiresAction":[],"active":[${_card('ACTIVE')}],"history":[${_card('HISTORY')}],"nextCursor":"more"}'),
              200);
        }));
    final page = await repo.list(cursor: 'next', petId: 'pet-1');
    expect(page.active.single.bucket, OwnerBookingBucket.active);
    expect(page.history.single.bucket, OwnerBookingBucket.history);
    expect(page.nextCursor, 'more');
  });
  test('distinct cancellation action reuses supplied keys and If-Match',
      () async {
    var calls = 0;
    final repo = HttpOwnerBookingsV50Repository(
        baseUrl: Uri.parse('http://x/'),
        accessToken: () async => 't',
        client: MockClient((r) async {
          calls++;
          expect(r.url.path, '/v1/owner/bookings/b/cancel');
          expect(r.headers['idempotency-key'], 'same-key');
          expect(r.headers['x-correlation-id'], 'same-correlation');
          expect(r.headers['if-match'], '"7"');
          return http.Response('{"state":"CANCELLATION_REQUESTED"}', 200);
        }));
    final d =
        OwnerBookingDetailV50.fromJson(_detail(action: 'REQUEST_CANCELLATION'));
    final a = await repo.cancel(d,
        operationKey: 'same-key', correlationId: 'same-correlation');
    final b = await repo.cancel(d,
        operationKey: 'same-key', correlationId: 'same-correlation');
    expect(a.pending && b.pending, isTrue);
    expect(calls, 2);
  });
  test(
      'release action uses canonical cancel endpoint and denied detail never dispatches',
      () async {
    var calls = 0;
    final repo = HttpOwnerBookingsV50Repository(
        baseUrl: Uri.parse('http://x/'),
        accessToken: () async => 't',
        client: MockClient((r) async {
          calls++;
          expect(r.url.path, '/v1/owner/bookings/b/cancel');
          return http.Response('{"state":"RELEASED"}', 200);
        }));
    await repo.cancel(
        OwnerBookingDetailV50.fromJson(_detail(action: 'RELEASE_HOLD')),
        operationKey: 'k',
        correlationId: 'c');
    expect(calls, 1);
    final denied = OwnerBookingDetailV50.fromJson({
      ..._detail(action: 'RELEASE_HOLD'),
      'cancellationEligibility': {'canCancel': false, 'action': 'RELEASE_HOLD'}
    });
    expect(() => repo.cancel(denied, operationKey: 'k', correlationId: 'c'),
        throwsA(isA<OwnerBookingsV50Exception>()));
  });
}

String _card(String bucket) =>
    '{"bookingId":"b-$bucket","startsAt":"2026-07-20T10:00:00Z","pet":{"id":"pet-1","name":"Барс"},"clinic":{"name":"Клиника"},"statusLabel":"Статус"}';
Map<String, dynamic> _detail({required String action}) => {
      'bookingId': 'b',
      'startsAt': '2026-07-20T10:00:00Z',
      'serverNow': '2026-07-16T10:00:00Z',
      'bucket': 'ACTIVE',
      'aggregateVersion': 7,
      'pet': {'name': 'Барс'},
      'clinic': {'name': 'Клиника'},
      'statusLabel': 'Подтверждено',
      'cancellationEligibility': {
        'canCancel': true,
        'action': action,
        'safeReason': 'Можно отменить'
      },
      'timeline': [
        {
          'code': 'CREATED',
          'title': 'Создано',
          'description': '',
          'occurredAt': '2026-07-16T10:00:00Z',
          'isCurrent': true
        }
      ]
    };
