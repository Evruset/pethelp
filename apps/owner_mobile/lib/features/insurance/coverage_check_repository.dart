import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

class CoverageCheckView {
  const CoverageCheckView({
    required this.id,
    required this.petId,
    required this.partnerCode,
    required this.state,
    required this.consentVersion,
    required this.version,
    required this.serverNow,
  });

  final String id;
  final String petId;
  final String partnerCode;
  final String state;
  final String? consentVersion;
  final int version;
  final DateTime serverNow;
}

class CoverageCheckRepository {
  CoverageCheckRepository({
    required this.baseUrl,
    required this.accessTokenProvider,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final Future<String> Function() accessTokenProvider;
  final http.Client _client;
  final Uuid _uuid = const Uuid();

  Future<CoverageCheckView> create({
    required String petId,
    required String partnerCode,
    required String correlationId,
    String? consentVersion,
  }) async {
    final token = await accessTokenProvider();
    final response = await _client.post(
      baseUrl.resolve('/v1/insurance/coverage-checks'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Idempotency-Key': _uuid.v4(),
        'X-Correlation-ID': correlationId,
      },
      body: jsonEncode({
        'petId': petId,
        'partnerCode': partnerCode,
        if (consentVersion != null) 'consentVersion': consentVersion,
      }),
    );
    final payload = _decode(response);
    if (response.statusCode != 201) {
      throw CoverageCheckApiException(response.statusCode, _errorCode(payload));
    }
    if (payload is! Map<String, dynamic>) {
      throw const CoverageCheckApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return _view(payload);
  }

  Future<CoverageCheckView> read(String id) async {
    final token = await accessTokenProvider();
    final response = await _client.get(
      baseUrl.resolve('/v1/insurance/coverage-checks/$id'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    final payload = _decode(response);
    if (response.statusCode != 200) {
      throw CoverageCheckApiException(response.statusCode, _errorCode(payload));
    }
    if (payload is! Map<String, dynamic>) {
      throw const CoverageCheckApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return _view(payload);
  }

  CoverageCheckView _view(Map<String, dynamic> payload) {
    return CoverageCheckView(
      id: payload['id'] as String,
      petId: payload['petId'] as String,
      partnerCode: payload['partnerCode'] as String,
      state: payload['state'] as String,
      consentVersion: payload['consentVersion'] as String?,
      version: payload['version'] as int,
      serverNow: DateTime.parse(payload['serverNow'] as String),
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

class CoverageCheckApiException implements Exception {
  const CoverageCheckApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
