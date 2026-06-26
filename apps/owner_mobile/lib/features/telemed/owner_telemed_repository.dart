import 'dart:convert';

import 'package:http/http.dart' as http;

class OwnerTelemedSession {
  const OwnerTelemedSession({
    required this.sessionId,
    required this.bookingHoldId,
    required this.state,
    required this.bucket,
    required this.startsAt,
    required this.endsAt,
    required this.doctorJoinDeadlineAt,
    required this.serverNow,
    required this.version,
    required this.clinicName,
    required this.clinicAddress,
    required this.petName,
    required this.petSpecies,
    required this.serviceName,
  });

  final String sessionId;
  final String bookingHoldId;
  final String state;
  final String bucket;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime doctorJoinDeadlineAt;
  final DateTime serverNow;
  final int version;
  final String clinicName;
  final String clinicAddress;
  final String petName;
  final String petSpecies;
  final String? serviceName;

  factory OwnerTelemedSession.fromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final pet = json['pet'] as Map<String, dynamic>;
    final service = json['service'] as Map<String, dynamic>;
    return OwnerTelemedSession(
      sessionId: json['sessionId'] as String,
      bookingHoldId: json['bookingHoldId'] as String,
      state: json['state'] as String,
      bucket: json['bucket'] as String? ?? 'HISTORY',
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      doctorJoinDeadlineAt:
          DateTime.parse(json['doctorJoinDeadlineAt'] as String).toLocal(),
      serverNow: DateTime.parse(json['serverNow'] as String).toLocal(),
      version: (json['version'] as num).toInt(),
      clinicName: clinic['name'] as String,
      clinicAddress: clinic['address'] as String,
      petName: pet['name'] as String,
      petSpecies: pet['species'] as String,
      serviceName: service['name'] as String?,
    );
  }
}

class OwnerTelemedApiException implements Exception {
  const OwnerTelemedApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}

abstract class OwnerTelemedRepository {
  Future<List<OwnerTelemedSession>> list();
}

class HttpOwnerTelemedRepository implements OwnerTelemedRepository {
  HttpOwnerTelemedRepository({
    required Uri baseUrl,
    required Future<String> Function() accessTokenProvider,
    http.Client? client,
  })  : _baseUrl = baseUrl,
        _accessTokenProvider = accessTokenProvider,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final Future<String> Function() _accessTokenProvider;
  final http.Client _client;

  @override
  Future<List<OwnerTelemedSession>> list() async {
    final token = await _accessTokenProvider();
    final response = await _client.get(
      _baseUrl.resolve('/v1/telemed/sessions'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! List) {
      throw OwnerTelemedApiException(
        response.statusCode,
        _errorCode(payload),
      );
    }
    return payload
        .whereType<Map<String, dynamic>>()
        .map(OwnerTelemedSession.fromJson)
        .toList(growable: false);
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
    return 'TELEMED_SESSIONS_UNAVAILABLE';
  }
}
