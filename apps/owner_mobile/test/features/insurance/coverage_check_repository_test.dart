import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/insurance/coverage_check_repository.dart';

void main() {
  test('revokes insurance consent with correlation header', () async {
    const profileId = '00000000-0000-4000-8000-000000000010';
    const correlationId = '00000000-0000-4000-8000-000000000011';
    final repository = CoverageCheckRepository(
      baseUrl: Uri.parse('http://127.0.0.1:3000'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        expect(request.method, 'DELETE');
        expect(request.url.path, '/v1/insurance/profiles/$profileId/consent');
        expect(request.headers['Authorization'], 'Bearer owner-token');
        expect(request.headers['X-Correlation-Id'], correlationId);
        return http.Response(
          '''
{
  "revoked": true,
  "profileId": "$profileId",
  "serverNow": "2026-06-29T10:00:00.000Z"
}
''',
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final result = await repository.revokeInsuranceConsent(
      profileId,
      correlationId: correlationId,
    );

    expect(result.profileId, profileId);
    expect(result.serverNow, DateTime.utc(2026, 6, 29, 10));
  });

  test('reads provider-backed coverage snapshot with claim draft', () async {
    final repository = CoverageCheckRepository(
      baseUrl: Uri.parse('http://127.0.0.1:3000'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        expect(request.url.path,
            '/v1/insurance/coverage-checks/00000000-0000-4000-8000-000000000001');
        return http.Response(
            '''
{
  "id": "00000000-0000-4000-8000-000000000001",
  "petId": "00000000-0000-4000-8000-000000000002",
  "partnerCode": "VETHELP_INSURANCE_PILOT",
  "state": "COVERED",
  "consentVersion": "owner-mobile-v1",
  "providerReference": "VETHELP_INSURANCE_PILOT-00000000",
  "responseSummary": {
    "statusText": "Partner returned a preliminary covered status for this pet.",
    "coverageScope": "Telemedicine and clinic booking review"
  },
  "providerCheckedAt": "2026-06-27T10:00:00.000Z",
  "coverageValidUntil": "2026-06-28T10:00:00.000Z",
  "claimDraft": {
    "draftId": "CLM-00000000",
    "partnerCode": "VETHELP_INSURANCE_PILOT",
    "status": "DRAFT",
    "requiredDocuments": ["Doctor recommendation", "Invoice or payment receipt"],
    "createdAt": "2026-06-27T10:00:00.000Z",
    "expiresAt": "2026-07-04T10:00:00.000Z"
  },
  "version": 3,
  "serverNow": "2026-06-27T10:00:01.000Z"
}
''',
            200,
            headers: {'content-type': 'application/json'});
      }),
    );

    final snapshot =
        await repository.read('00000000-0000-4000-8000-000000000001');

    expect(snapshot.state, 'COVERED');
    expect(snapshot.providerReference, 'VETHELP_INSURANCE_PILOT-00000000');
    expect(snapshot.responseSummary['coverageScope'],
        'Telemedicine and clinic booking review');
    expect(snapshot.providerCheckedAt, DateTime.utc(2026, 6, 27, 10));
    expect(snapshot.coverageValidUntil, DateTime.utc(2026, 6, 28, 10));
    expect(snapshot.claimDraft?.draftId, 'CLM-00000000');
    expect(snapshot.claimDraft?.requiredDocuments,
        contains('Doctor recommendation'));
  });
}
