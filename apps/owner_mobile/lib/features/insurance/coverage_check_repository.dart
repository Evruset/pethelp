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
    required this.providerReference,
    required this.responseSummary,
    required this.providerCheckedAt,
    required this.coverageValidUntil,
    required this.claimDraft,
    required this.version,
    required this.serverNow,
  });

  final String id;
  final String petId;
  final String partnerCode;
  final String state;
  final String? consentVersion;
  final String? providerReference;
  final Map<String, Object?> responseSummary;
  final DateTime? providerCheckedAt;
  final DateTime? coverageValidUntil;
  final InsuranceClaimDraftView? claimDraft;
  final int version;
  final DateTime serverNow;
}

class InsuranceClaimDraftView {
  const InsuranceClaimDraftView({
    required this.draftId,
    required this.partnerCode,
    required this.status,
    required this.requiredDocuments,
    required this.createdAt,
    required this.expiresAt,
  });

  final String draftId;
  final String partnerCode;
  final String status;
  final List<String> requiredDocuments;
  final DateTime createdAt;
  final DateTime expiresAt;

  factory InsuranceClaimDraftView.fromJson(Map<String, dynamic> json) {
    return InsuranceClaimDraftView(
      draftId: json['draftId'] as String,
      partnerCode: json['partnerCode'] as String,
      status: json['status'] as String,
      requiredDocuments:
          (json['requiredDocuments'] as List<dynamic>? ?? const [])
              .whereType<String>()
              .toList(growable: false),
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }
}

class InsuranceProfileView {
  const InsuranceProfileView({
    required this.id,
    required this.petId,
    required this.insurerCode,
    required this.policyReferenceMasked,
    required this.petRelation,
    required this.validFrom,
    required this.validUntil,
    required this.verificationState,
    required this.consentVersion,
    required this.version,
  });

  final String id;
  final String petId;
  final String insurerCode;
  final String policyReferenceMasked;
  final String petRelation;
  final DateTime? validFrom;
  final DateTime? validUntil;
  final String verificationState;
  final String consentVersion;
  final int version;

  factory InsuranceProfileView.fromJson(Map<String, dynamic> json) {
    return InsuranceProfileView(
      id: json['id'] as String,
      petId: json['petId'] as String,
      insurerCode: json['insurerCode'] as String,
      policyReferenceMasked: json['policyReferenceMasked'] as String,
      petRelation: json['petRelation'] as String,
      validFrom: _optionalDate(json['validFrom']),
      validUntil: _optionalDate(json['validUntil']),
      verificationState: json['verificationState'] as String,
      consentVersion: json['consentVersion'] as String,
      version: (json['version'] as num).toInt(),
    );
  }
}

class InsuranceProfileInput {
  const InsuranceProfileInput({
    required this.petId,
    required this.insurerCode,
    required this.policyReference,
    required this.petRelation,
    required this.consentVersion,
    this.validFrom,
    this.validUntil,
  });

  final String petId;
  final String insurerCode;
  final String policyReference;
  final String petRelation;
  final String consentVersion;
  final DateTime? validFrom;
  final DateTime? validUntil;

  Map<String, Object?> toJson() => {
        'petId': petId,
        'insurerCode': insurerCode,
        'policyReference': policyReference,
        'petRelation': petRelation,
        'consentVersion': consentVersion,
        if (validFrom != null) 'validFrom': _dateOnly(validFrom!),
        if (validUntil != null) 'validUntil': _dateOnly(validUntil!),
      };
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

  Future<List<InsuranceProfileView>> listProfiles() async {
    final token = await accessTokenProvider();
    final response = await _client.get(
      baseUrl.resolve('/v1/insurance/profiles'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! List) {
      throw CoverageCheckApiException(response.statusCode, _errorCode(payload));
    }
    return payload
        .whereType<Map<String, dynamic>>()
        .map(InsuranceProfileView.fromJson)
        .toList(growable: false);
  }

  Future<InsuranceProfileView> createProfile(
    InsuranceProfileInput input,
  ) async {
    final token = await accessTokenProvider();
    final response = await _client.post(
      baseUrl.resolve('/v1/insurance/profiles'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode(input.toJson()),
    );
    final payload = _decode(response);
    if (response.statusCode != 201 || payload is! Map<String, dynamic>) {
      throw CoverageCheckApiException(response.statusCode, _errorCode(payload));
    }
    return InsuranceProfileView.fromJson(payload);
  }

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
      providerReference: payload['providerReference'] as String?,
      responseSummary: _safeMap(payload['responseSummary']),
      providerCheckedAt: _optionalDateTime(payload['providerCheckedAt']),
      coverageValidUntil: _optionalDateTime(payload['coverageValidUntil']),
      claimDraft: _claimDraft(payload['claimDraft']),
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

DateTime? _optionalDate(dynamic value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

DateTime? _optionalDateTime(dynamic value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

Map<String, Object?> _safeMap(dynamic value) {
  if (value is! Map<String, dynamic>) return const <String, Object?>{};
  return value.map((key, item) => MapEntry(key, item is Object ? item : null));
}

InsuranceClaimDraftView? _claimDraft(dynamic value) {
  if (value is! Map<String, dynamic>) return null;
  if (value.isEmpty) return null;
  return InsuranceClaimDraftView.fromJson(value);
}

String _dateOnly(DateTime value) {
  return '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
}

class CoverageCheckApiException implements Exception {
  const CoverageCheckApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
