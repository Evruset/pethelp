import 'dart:convert';

import 'package:http/http.dart' as http;

class EmergencyClinic {
  const EmergencyClinic({
    required this.clinicLocationId,
    required this.clinicId,
    required this.clinicName,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.emergencyContactPhone,
    required this.statusUpdatedAt,
    required this.validUntil,
    required this.matchingCapabilities,
    required this.straightLineDistanceKm,
  });

  final String clinicLocationId;
  final String clinicId;
  final String clinicName;
  final String address;
  final double? latitude;
  final double? longitude;
  final String? emergencyContactPhone;
  final DateTime statusUpdatedAt;
  final DateTime validUntil;
  final List<String> matchingCapabilities;
  final double? straightLineDistanceKm;

  factory EmergencyClinic.fromJson(Map<String, dynamic> json) {
    return EmergencyClinic(
      clinicLocationId: json['clinicLocationId'] as String,
      clinicId: json['clinicId'] as String,
      clinicName: json['clinicName'] as String,
      address: json['address'] as String,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      emergencyContactPhone: json['emergencyContactPhone'] as String?,
      statusUpdatedAt: DateTime.parse(json['statusUpdatedAt'] as String),
      validUntil: DateTime.parse(json['validUntil'] as String),
      matchingCapabilities:
          (json['matchingCapabilities'] as List<dynamic>? ?? const <dynamic>[])
              .whereType<String>()
              .toList(growable: false),
      straightLineDistanceKm:
          (json['straightLineDistanceKm'] as num?)?.toDouble(),
    );
  }
}

class EmergencyClinicFilters {
  const EmergencyClinicFilters({
    required this.species,
    this.requiredCapabilities = const <String>[],
    this.latitude,
    this.longitude,
    this.limit = 10,
  });

  final String species;
  final List<String> requiredCapabilities;
  final double? latitude;
  final double? longitude;
  final int limit;
}

class EmergencyRepository {
  EmergencyRepository({required Uri baseUrl, http.Client? client})
      : _baseUrl = baseUrl,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final http.Client _client;

  Future<List<EmergencyClinic>> search(EmergencyClinicFilters filters) async {
    final query = <String, String>{
      'species': filters.species,
      'limit': filters.limit.toString(),
      if (filters.requiredCapabilities.isNotEmpty)
        'requiredCapabilities': filters.requiredCapabilities.join(','),
      if (filters.latitude != null) 'latitude': '${filters.latitude}',
      if (filters.longitude != null) 'longitude': '${filters.longitude}',
    };
    final response = await _client.get(
      _baseUrl.resolve('v1/emergency/clinics').replace(queryParameters: query),
      headers: const {'Accept': 'application/json'},
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! List) {
      throw EmergencyApiException(response.statusCode, _errorCode(payload));
    }
    return payload
        .whereType<Map<String, dynamic>>()
        .map(EmergencyClinic.fromJson)
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
    return 'EMERGENCY_ROUTE_UNAVAILABLE';
  }
}

class EmergencyApiException implements Exception {
  const EmergencyApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}
