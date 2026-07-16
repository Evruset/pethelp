import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/booking/alternative_slot/alternative_slot_page.dart';
import 'package:vethelp_owner_mobile/features/booking/alternative_slot/alternative_slot_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/alternative_slot/alternative_slot_v50_feature_flags.dart';

const bookingId = '11111111-1111-4111-8111-111111111111';
const proposalId = '22222222-2222-4222-8222-222222222222';

Map<String, dynamic> snapshot(
        {String state = 'PENDING', bool actions = true}) =>
    {
      'bookingId': bookingId,
      'proposalId': proposalId,
      'state': state,
      'aggregateVersion': 7,
      'serverNow': '2026-07-16T09:00:00Z',
      'deadline': '2026-07-16T09:15:00Z',
      'originalSlot': {
        'id': 'old',
        'startsAt': '2026-07-17T09:00:00Z',
        'endsAt': '2026-07-17T09:30:00Z'
      },
      'proposedSlot': {
        'id': 'new',
        'startsAt': '2026-07-17T10:00:00Z',
        'endsAt': '2026-07-17T10:30:00Z'
      },
      'actions': {
        'canAccept': actions,
        'canDecline': actions,
        'code': 'OWNER_DECISION'
      },
      'priceCopy': 'Цена не изменится',
      'context': {
        'petId': 'pet',
        'clinicId': 'clinic',
        'locationId': 'location',
        'serviceId': 'service',
        'doctorId': 'doctor'
      },
    };

AlternativeSlotRepository repo(MockClient client) => AlternativeSlotRepository(
    baseUrl: Uri.parse('https://vet.test'),
    accessTokenProvider: () async => 'token',
    client: client);
http.Response jsonResponse(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status,
        headers: {'content-type': 'application/json'});

void main() {
  test('canonical proposal routes carry persistent UUID headers and If-Match',
      () async {
    final requests = <http.Request>[];
    var reads = 0;
    final repository = repo(MockClient((request) async {
      requests.add(request);
      if (request.method == 'GET') {
        reads++;
        return jsonResponse(snapshot(
            state: reads == 1 ? 'PENDING' : 'ACCEPTED', actions: reads == 1));
      }
      return jsonResponse({
        'bookingId': bookingId,
        'proposalId': proposalId,
        'state': 'ACCEPTED'
      });
    }));
    final first = await repository.readSnapshot(bookingId)
        as AlternativeSlotSuccess<AlternativeSlotSnapshot>;
    await repository.resolve(
        snapshot: first.value,
        accept: true,
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
        correlationId: '44444444-4444-4444-8444-444444444444');
    expect(requests[0].url.path, '/v1/owner/bookings/$bookingId/alternative');
    expect(requests[1].url.path,
        '/v1/owner/bookings/$bookingId/alternative/$proposalId/accept');
    expect(requests[1].headers['If-Match'], '7');
    expect(requests[1].headers['Idempotency-Key'], isNotEmpty);
    expect(requests[1].headers['X-Correlation-ID'], isNotEmpty);
  });

  testWidgets(
      'renders comparison, server price, deadline and large text finitely',
      (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.8)),
        child: MaterialApp(
            home: AlternativeSlotPage(
                holdId: bookingId,
                repository:
                    repo(MockClient((_) async => jsonResponse(snapshot())))))));
    await tester.pumpAndSettle();
    expect(find.text('Текущее время'), findsOneWidget);
    expect(find.text('Предложение клиники'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Цена не изменится'), 200);
    expect(find.text('Цена не изменится'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'accept never claims local success and uses authoritative readback',
      (tester) async {
    var reads = 0;
    final repository = repo(MockClient((request) async {
      if (request.method == 'GET') {
        reads++;
        return jsonResponse(snapshot(
            state: reads == 1 ? 'PENDING' : 'ACCEPTED', actions: reads == 1));
      }
      return jsonResponse({'state': 'ACCEPTED'});
    }));
    await tester.pumpWidget(MaterialApp(
        home: AlternativeSlotPage(holdId: bookingId, repository: repository)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Принять новое время'));
    await tester.pumpAndSettle();
    expect(reads, 2);
    expect(find.text('Новое время принято сервером.'), findsOneWidget);
  });

  testWidgets('transport ambiguity performs readback with same command once',
      (tester) async {
    var posts = 0, reads = 0;
    final repository = repo(MockClient((request) async {
      if (request.method == 'POST') {
        posts++;
        throw Exception('lost response');
      }
      reads++;
      return jsonResponse(snapshot(
          state: reads == 1 ? 'PENDING' : 'ACCEPTED', actions: reads == 1));
    }));
    await tester.pumpWidget(MaterialApp(
        home: AlternativeSlotPage(holdId: bookingId, repository: repository)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Принять новое время'));
    await tester.pumpAndSettle();
    expect(posts, 1);
    expect(reads, 2);
  });

  testWidgets('decline requires confirmation and returns typed intent',
      (tester) async {
    var reads = 0;
    Object? result;
    final repository = repo(MockClient((request) async {
      if (request.method == 'GET') {
        reads++;
        return jsonResponse(snapshot(
            state: reads == 1 ? 'PENDING' : 'DECLINED', actions: reads == 1));
      }
      return jsonResponse({'state': 'DECLINED'});
    }));
    await tester.pumpWidget(MaterialApp(
        home: Builder(
            builder: (context) => ElevatedButton(
                onPressed: () async {
                  result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => AlternativeSlotPage(
                              holdId: bookingId, repository: repository)));
                },
                child: const Text('open')))));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Не подходит'));
    await tester.pumpAndSettle();
    expect(find.text('Отклонить предложение?'), findsOneWidget);
    await tester.tap(find.text('Отклонить'));
    await tester.pumpAndSettle();
    await tester.pump();
    expect(result, isA<ReturnToAvailabilityIntent>());
    final intent = result as ReturnToAvailabilityIntent;
    expect(intent.excludedSlotIds, ['old', 'new']);
    expect(intent.proposalId, proposalId);
    expect(intent.petId, 'pet');
    expect(intent.clinicId, 'clinic');
    expect(intent.locationId, 'location');
    expect(intent.serviceId, 'service');
    expect(intent.doctorId, 'doctor');
    expect(intent.source, 'ALTERNATIVE_DECLINED_OR_RESELECT');
  });

  testWidgets('offline blocks mutation', (tester) async {
    var posts = 0;
    final repository = repo(MockClient((request) async {
      if (request.method == 'POST') posts++;
      return jsonResponse(snapshot());
    }));
    await tester.pumpWidget(MaterialApp(
        home: AlternativeSlotPage(
            holdId: bookingId, repository: repository, offline: true)));
    await tester.pumpAndSettle();
    expect(posts, 0);
    expect(find.textContaining('Нет сети'), findsOneWidget);
    expect(find.textContaining('Подключитесь к интернету'), findsOneWidget);
  });

  for (final entry in {
    'EXPIRED': 'Срок предложения истёк.',
    'SUPERSEDED': 'Есть более новое предложение.',
    'UNAVAILABLE': 'Время уже недоступно.'
  }.entries) {
    testWidgets('${entry.key} is server-authored and disables actions',
        (tester) async {
      var posts = 0;
      await tester.pumpWidget(MaterialApp(
          home: AlternativeSlotPage(
              holdId: bookingId,
              repository: repo(MockClient((request) async {
                if (request.method == 'POST') posts++;
                return jsonResponse(snapshot(state: entry.key, actions: false));
              })))));
      await tester.pumpAndSettle();
      expect(find.text(entry.value), findsOneWidget);
      await tester.tap(find.text('Принять новое время'));
      await tester.pump();
      expect(posts, 0);
    });
  }

  test('resolution flag is dependency ordered and default off', () {
    expect(AlternativeSlotV50FeatureFlags.enabled, isFalse);
  });
}
