import 'dart:convert';

import 'package:http/http.dart' as http;

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

  Future<CoverageCheckView> create({required String petId, required String partnerCode, String? consentVersion}) async {
    final token = await accessTokenProvider();
    final response = await _client.post(
      baseUrl.resolve('/v1/insurance/coverage-checks'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({
        'petId': petId,
        'partnerCode': partnerCode,
        if (consentVersion != null) 'consentVersion': consentVersion,
      }),
    );
    if (response.statusCode != 201) {
      throw StateError('Unable to create insurance coverage check.');
    }
    return _view(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<CoverageCheckView> read(String id) async {
    final token = await accessTokenProvider();
    final response = await _client.get(
      baseUrl.resolve('/v1/insurance/coverage-checks/$id'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    if (response.statusCode != 200) {
      throw StateError('Unable to read insurance coverage check.');
    }
    return _view(jsonDecode(response.body) as Map<String, dynamic>);
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
}
