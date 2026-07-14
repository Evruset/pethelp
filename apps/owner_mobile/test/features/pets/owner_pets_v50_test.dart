import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_care_repository.dart';
import 'package:vethelp_owner_mobile/features/care/owner_pet_diary_v50_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_v50_feature_flags.dart';

void main() {
  test('V50 flags fail closed when shell or parent flag is disabled', () {
    expect(resolveOwnerV50PetsFlag(value: 'true', shellEnabled: false), false);
    expect(
      resolveOwnerV50PetProfileFlag(
        value: 'true',
        shellEnabled: true,
        petsEnabled: false,
      ),
      false,
    );
    expect(
      resolveOwnerV50PetDiaryFlag(
        value: 'true',
        shellEnabled: true,
        petsEnabled: true,
        profileEnabled: false,
      ),
      false,
    );
  });

  test('diary parser keeps backend order and pagination', () {
    final page = OwnerPetDiaryPageData.fromJson({
      'petId': 'pet-1',
      'entries': [
        {
          'type': 'DOCUMENT',
          'sourceId': 'doc-2',
          'occurredAt': '2026-07-02T12:00:00Z',
          'endsAt': null,
          'title': 'Второй на сервере',
          'summary': 'PDF',
          'lifecycleStatus': 'PROCESSING',
          'downloadUrl': null,
        },
        {
          'type': 'VISIT',
          'sourceId': 'visit-1',
          'occurredAt': '2026-07-03T12:00:00Z',
          'endsAt': '2026-07-03T12:30:00Z',
          'title': 'Первый по дате',
          'summary': 'Осмотр',
          'lifecycleStatus': null,
          'downloadUrl': null,
        },
      ],
      'page': {'limit': 20, 'offset': 0, 'nextOffset': 20, 'total': 21},
    });
    expect(page.events.map((event) => event.sourceId), ['doc-2', 'visit-1']);
    expect(page.nextOffset, 20);
    expect(page.total, 21);
  });

  test('PDF open fetches bytes only from the exact authenticated stream',
      () async {
    final requests = <http.Request>[];
    final repository = HttpOwnerPetCareRepository(
      baseUrl: Uri.parse('https://api.vethelp.test'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        requests.add(request);
        if (requests.length == 1) {
          return http.Response(
              '''{
            "fileName":"Заключение.pdf","mimeType":"application/pdf",
            "sizeBytes":8,"lifecycleStatus":"READY",
            "downloadUrl":"/v1/owner/pets/pet-1/documents/doc-1/download"
          }''',
              200,
              headers: {'content-type': 'application/json'});
        }
        return http.Response.bytes('%PDF-1.4'.codeUnits, 200);
      }),
    );
    final detail = await repository.readDocument('pet-1', 'doc-1');
    expect(detail.contentBytes, isNotEmpty);
    expect(requests, hasLength(2));
    expect(requests.last.url.path,
        '/v1/owner/pets/pet-1/documents/doc-1/download');
    expect(requests.last.headers['Authorization'], 'Bearer owner-token');
  });

  test('unknown MIME remains metadata-only and never follows an arbitrary URL',
      () async {
    var calls = 0;
    final repository = HttpOwnerPetCareRepository(
      baseUrl: Uri.parse('https://api.vethelp.test'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((_) async {
        calls++;
        return http.Response('''{
          "fileName":"unknown.bin","mimeType":"text/html","sizeBytes":4,
          "lifecycleStatus":"READY","downloadUrl":"https://evil.test/x"
        }''', 200);
      }),
    );
    final detail = await repository.readDocument('pet-1', 'doc-1');
    expect(detail.contentBytes, isNull);
    expect(calls, 1);
  });

  test('expired or rejected authenticated stream is a controlled API error',
      () async {
    var calls = 0;
    final repository = HttpOwnerPetCareRepository(
      baseUrl: Uri.parse('https://api.vethelp.test'),
      accessTokenProvider: () async => 'expired-token',
      client: MockClient((_) async {
        calls++;
        if (calls == 1) {
          return http.Response(
              '''{
            "fileName":"Заключение.pdf","mimeType":"application/pdf",
            "sizeBytes":8,"lifecycleStatus":"READY",
            "downloadUrl":"/v1/owner/pets/pet-1/documents/doc-1/download"
          }''',
              200,
              headers: {'content-type': 'application/json; charset=utf-8'});
        }
        return http.Response('{"code":"SESSION_EXPIRED"}', 401);
      }),
    );
    await expectLater(
      repository.readDocument('pet-1', 'doc-1'),
      throwsA(isA<OwnerPetCareApiException>()
          .having((error) => error.statusCode, 'statusCode', 401)),
    );
  });

  testWidgets('diary renders lifecycle states and preserves server order',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: OwnerPetDiaryV50Page(
        pet: _pet,
        repository: _DiaryRepository(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Документ'), findsOneWidget);
    expect(find.textContaining('Обрабатывается'), findsOneWidget);
    expect(find.text('Визит'), findsOneWidget);
    final documentY = tester.getTopLeft(find.text('Документ')).dy;
    final visitY = tester.getTopLeft(find.text('Визит')).dy;
    expect(documentY, lessThan(visitY));
  });

  testWidgets('diary empty state is usable at 375px and large text',
      (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(2)),
      child: MaterialApp(
        home: OwnerPetDiaryV50Page(
          pet: _pet,
          repository: _DiaryRepository(empty: true),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('В дневнике пока нет событий.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

const _pet = OwnerPet(id: 'pet-1', name: 'Барсик', species: 'CAT');

class _DiaryRepository implements OwnerPetDiaryRepository {
  _DiaryRepository({this.empty = false});
  final bool empty;

  @override
  Future<OwnerPetDocumentDetail> readDocument(
    String petId,
    String documentId,
  ) async =>
      const OwnerPetDocumentDetail(
        fileName: 'Анализ.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1200,
        status: 'READY',
        contentBytes: null,
      );

  @override
  Future<OwnerPetDiaryPageData> readDiary(
    String petId, {
    int offset = 0,
    int limit = 20,
  }) async =>
      OwnerPetDiaryPageData(
        events: empty
            ? const []
            : [
                OwnerPetDiaryEvent(
                  type: 'DOCUMENT',
                  sourceId: 'doc-1',
                  occurredAt: DateTime(2026, 7, 1),
                  title: 'Документ',
                  summary: 'Анализ',
                  status: 'PROCESSING',
                  downloadUrl: null,
                ),
                OwnerPetDiaryEvent(
                  type: 'VISIT',
                  sourceId: 'visit-1',
                  occurredAt: DateTime(2026, 7, 2),
                  title: 'Визит',
                  summary: 'Осмотр',
                  status: 'READY',
                ),
              ],
        nextOffset: null,
        total: empty ? 0 : 2,
      );
}
