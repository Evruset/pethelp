import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/auth/owner_auth_repository.dart';

void main() {
  test('requests OTP and parses development challenge', () async {
    final repository = HttpOwnerAuthRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      client: MockClient((request) async {
        expect(request.url.path, '/v1/auth/otp/request');
        expect(request.method, 'POST');
        return http.Response('''
          {
            "challengeId":"11111111-1111-4111-8111-111111111111",
            "expiresAt":"2026-06-25T12:05:00.000Z",
            "resendAvailableAt":"2026-06-25T12:01:00.000Z",
            "developmentCode":"000000"
          }
        ''', 200, headers: const {'content-type': 'application/json'});
      }),
    );

    final challenge = await repository.requestOtp('+79991234567');

    expect(challenge.id, '11111111-1111-4111-8111-111111111111');
    expect(challenge.developmentCode, '000000');
  });

  test('parses authenticated owner session', () async {
    final repository = HttpOwnerAuthRepository(
      baseUrl: Uri.parse('http://localhost:3000'),
      client: MockClient((_) async => http.Response('''
        {
          "accessToken":"access-token",
          "refreshToken":"refresh-token-value-which-is-long-enough",
          "accessTokenExpiresInSeconds":900,
          "owner":{"id":"22222222-2222-4222-8222-222222222222","phone":"+79991234567"}
        }
      ''', 200, headers: const {'content-type': 'application/json'})),
    );

    final session = await repository.verifyOtp(
      phone: '+79991234567',
      challengeId: '11111111-1111-4111-8111-111111111111',
      code: '000000',
    );

    expect(session.ownerId, '22222222-2222-4222-8222-222222222222');
    expect(session.accessToken, 'access-token');
  });
}
