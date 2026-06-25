import 'dart:convert';

import 'package:http/http.dart' as http;

import 'owner_session.dart';

class OwnerAuthApiException implements Exception {
  const OwnerAuthApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}

abstract class OwnerAuthRepository {
  Future<OtpChallenge> requestOtp(String phone);

  Future<OwnerSession> verifyOtp({
    required String phone,
    required String challengeId,
    required String code,
    String? deviceName,
  });
}

class HttpOwnerAuthRepository implements OwnerAuthRepository {
  HttpOwnerAuthRepository({required Uri baseUrl, http.Client? client})
      : _baseUrl = baseUrl,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final http.Client _client;

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    final response = await _client.post(
      _baseUrl.resolve('v1/auth/otp/request'),
      headers: const {'Accept': 'application/json', 'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone}),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw OwnerAuthApiException(response.statusCode, _errorCode(payload));
    }
    return OtpChallenge(
      id: payload['challengeId'] as String,
      expiresAt: DateTime.parse(payload['expiresAt'] as String).toLocal(),
      resendAvailableAt: DateTime.parse(payload['resendAvailableAt'] as String).toLocal(),
      developmentCode: payload['developmentCode'] as String?,
    );
  }

  @override
  Future<OwnerSession> verifyOtp({
    required String phone,
    required String challengeId,
    required String code,
    String? deviceName,
  }) async {
    final response = await _client.post(
      _baseUrl.resolve('v1/auth/otp/verify'),
      headers: const {'Accept': 'application/json', 'Content-Type': 'application/json'},
      body: jsonEncode({
        'phone': phone,
        'challengeId': challengeId,
        'code': code,
        if (deviceName != null) 'deviceName': deviceName,
      }),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw OwnerAuthApiException(response.statusCode, _errorCode(payload));
    }
    final owner = payload['owner'] as Map<String, dynamic>;
    return OwnerSession(
      accessToken: payload['accessToken'] as String,
      refreshToken: payload['refreshToken'] as String,
      accessTokenExpiresInSeconds: (payload['accessTokenExpiresInSeconds'] as num).toInt(),
      ownerId: owner['id'] as String,
      phone: owner['phone'] as String,
    );
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return null;
    }
  }

  String _errorCode(dynamic payload) {
    if (payload is Map<String, dynamic> && payload['code'] is String) {
      return payload['code'] as String;
    }
    return 'BACKEND_UNAVAILABLE';
  }
}
