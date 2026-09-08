import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_home_feature_flag.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_home_models.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_home_repository.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_selected_pet_preference.dart';

void main() {
  test('OWNER_V50_HOME is exact, default-off, and requires V50 shell', () {
    expect(resolveOwnerV50HomeFlag(shellEnabled: true), isFalse);
    expect(resolveOwnerV50HomeFlag(value: 'true', shellEnabled: true), isTrue);
    expect(resolveOwnerV50HomeFlag(value: 'TRUE', shellEnabled: true), isFalse);
    expect(resolveOwnerV50HomeFlag(value: '1', shellEnabled: true), isFalse);
    expect(
        resolveOwnerV50HomeFlag(value: 'true', shellEnabled: false), isFalse);
  });

  test('strict parser accepts schema v1 and preserves server authority', () {
    final snapshot = OwnerHomeSnapshot.fromJson(_homeJson());
    expect(snapshot.schemaVersion, 1);
    expect(snapshot.serverNow, DateTime.parse('2026-07-14T18:00:00Z'));
    expect(snapshot.selectedPet?.id, 'pet-1');
    expect(snapshot.selectionSource, 'REQUESTED');
    expect(snapshot.nextAction.actionCode, 'OPEN_ALTERNATIVE_SLOT');
    expect(snapshot.activeCare?.sourceId, 'hold-1');
  });

  test('unknown or malformed action becomes exact safe fallback', () {
    final json = _homeJson();
    (json['nextAction'] as Map<String, dynamic>)['actionCode'] = 'OPEN_URL';
    final action = OwnerHomeSnapshot.fromJson(json).nextAction;
    expect(action.isSafeFallback, isTrue);
    expect(action.title, OwnerHomeAction.fallbackTitle);
    expect(action.description, OwnerHomeAction.fallbackDescription);
    expect(action.actionCode, 'OPEN_APPOINTMENT');
  });

  test('schema and authoritative selected-pet violations are rejected', () {
    expect(
      () => OwnerHomeSnapshot.fromJson({..._homeJson(), 'schemaVersion': 2}),
      throwsFormatException,
    );
    final json = _homeJson();
    json['selectedPet'] = {
      'id': 'foreign-pet',
      'name': 'Чужой',
      'species': 'CAT',
      'breed': null,
      'photoUrl': null,
    };
    expect(() => OwnerHomeSnapshot.fromJson(json), throwsFormatException);
  });

  test('repository sends bearer token and selectedPetId hint', () async {
    late Uri requestedUri;
    late Map<String, String> requestedHeaders;
    final repository = HttpOwnerHomeRepository(
      baseUrl: Uri.parse('https://api.example.test'),
      accessToken: () async => 'owner-token',
      client: MockClient((request) async {
        requestedUri = request.url;
        requestedHeaders = request.headers;
        return http.Response.bytes(
          utf8.encode(jsonEncode(_homeJson())),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );

    final snapshot = await repository.read(selectedPetId: 'pet-1');
    expect(requestedUri.path, '/v1/owner/home');
    expect(requestedUri.queryParameters, {'selectedPetId': 'pet-1'});
    expect(requestedHeaders['authorization'], 'Bearer owner-token');
    expect(snapshot.selectedPet?.name, 'Луна');
  });

  test('repository classifies expired, offline, and malformed responses',
      () async {
    Future<OwnerHomeException> errorFor(MockClient client) async {
      final repository = HttpOwnerHomeRepository(
        baseUrl: Uri.parse('https://api.example.test'),
        accessToken: () async => 'token',
        client: client,
      );
      try {
        await repository.read();
        throw StateError('Expected read to fail.');
      } on OwnerHomeException catch (error) {
        return error;
      }
    }

    expect(
      (await errorFor(MockClient((_) async => http.Response('', 401)))).kind,
      OwnerHomeErrorKind.sessionExpired,
    );
    expect(
      (await errorFor(MockClient((_) async => http.Response('{', 200)))).kind,
      OwnerHomeErrorKind.invalidResponse,
    );
    expect(
      (await errorFor(
              MockClient((_) async => throw http.ClientException('offline'))))
          .kind,
      OwnerHomeErrorKind.offline,
    );
  });

  test('selected-pet preference is owner-scoped and durable', () async {
    SharedPreferences.setMockInitialValues({});
    final preference = SharedPreferencesOwnerSelectedPetPreference();
    await preference.write('owner-a', 'pet-a');
    await preference.write('owner-b', 'pet-b');
    expect(await preference.read('owner-a'), 'pet-a');
    expect(await preference.read('owner-b'), 'pet-b');
    await preference.clear('owner-a');
    expect(await preference.read('owner-a'), isNull);
    expect(await preference.read('owner-b'), 'pet-b');
  });

  test('JWT subject is decoded only when structurally safe', () {
    String token(Map<String, dynamic> payload) =>
        'header.${base64Url.encode(utf8.encode(jsonEncode(payload))).replaceAll('=', '')}.sig';
    expect(safeOwnerSubjectFromJwt(token({'sub': 'owner-7'})), 'owner-7');
    expect(safeOwnerSubjectFromJwt(token({'name': 'not-authority'})), isNull);
    expect(safeOwnerSubjectFromJwt('evidence-token'), isNull);
  });
}

Map<String, dynamic> _homeJson() => {
      'schemaVersion': 1,
      'serverNow': '2026-07-14T18:00:00Z',
      'pets': [
        {
          'id': 'pet-1',
          'name': 'Луна',
          'species': 'DOG',
          'breed': 'Корги',
          'photoUrl': null,
        },
      ],
      'selectedPet': {
        'id': 'pet-1',
        'name': 'Луна',
        'species': 'DOG',
        'breed': 'Корги',
        'photoUrl': null,
      },
      'selectionSource': 'REQUESTED',
      'nextAction': {
        'type': 'ALTERNATIVE_SLOT_RESPONSE',
        'priority': 'HIGH',
        'sourceType': 'BOOKING_HOLD',
        'sourceId': 'hold-1',
        'title': 'Клиника предложила другое время',
        'description': 'Ответьте до 19:30',
        'deadlineAt': '2026-07-14T16:30:00Z',
        'actionCode': 'OPEN_ALTERNATIVE_SLOT',
      },
      'activeCare': {
        'sourceType': 'BOOKING_HOLD',
        'sourceId': 'hold-1',
        'statusCode': 'ALTERNATIVE_PROPOSED',
        'title': 'Клиника предложила другое время',
        'description': 'Нужно выбрать подходящий вариант',
        'startsAt': null,
        'deadlineAt': '2026-07-14T16:30:00Z',
        'clinicName': 'ВетКлиника',
        'petId': 'pet-1',
        'actionCode': 'OPEN_ALTERNATIVE_SLOT',
      },
    };
