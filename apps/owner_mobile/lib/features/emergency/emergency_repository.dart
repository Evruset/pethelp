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

  String get cacheKey {
    final capabilities = requiredCapabilities
        .map((value) => value.trim().toUpperCase())
        .where((value) => value.isNotEmpty)
        .toList(growable: false)
      ..sort();
    return [
      species,
      capabilities.join(','),
      latitude?.toStringAsFixed(4) ?? '',
      longitude?.toStringAsFixed(4) ?? '',
      '$limit',
    ].join('|');
  }
}

class EmergencyCachedClinics {
  const EmergencyCachedClinics({
    required this.clinics,
    required this.cachedAt,
  });

  final List<EmergencyClinic> clinics;
  final DateTime cachedAt;
}

abstract class EmergencyClinicCacheStore {
  Future<void> write(String key, EmergencyCachedClinics value);
  Future<EmergencyCachedClinics?> read(String key);
}

class InMemoryEmergencyClinicCacheStore implements EmergencyClinicCacheStore {
  final Map<String, EmergencyCachedClinics> _values =
      <String, EmergencyCachedClinics>{};

  @override
  Future<void> write(String key, EmergencyCachedClinics value) async {
    _values[key] = value;
  }

  @override
  Future<EmergencyCachedClinics?> read(String key) async => _values[key];
}

class EmergencyTriageDecision {
  const EmergencyTriageDecision({
    required this.sessionId,
    required this.ruleSetVersion,
    required this.outcome,
    required this.requiredCapabilities,
    required this.ownerMessage,
    required this.selectedSignals,
  });

  final String sessionId;
  final String ruleSetVersion;
  final String outcome;
  final List<String> requiredCapabilities;
  final String ownerMessage;
  final List<String> selectedSignals;

  factory EmergencyTriageDecision.fromJson(Map<String, dynamic> json) {
    return EmergencyTriageDecision(
      sessionId: json['sessionId'] as String,
      ruleSetVersion: json['ruleSetVersion'] as String,
      outcome: json['outcome'] as String,
      requiredCapabilities:
          (json['requiredCapabilities'] as List<dynamic>? ?? const <dynamic>[])
              .whereType<String>()
              .toList(growable: false),
      ownerMessage: json['ownerMessage'] as String,
      selectedSignals:
          (json['selectedSignals'] as List<dynamic>? ?? const <dynamic>[])
              .whereType<String>()
              .toList(growable: false),
    );
  }
}

class EmergencyRouteActionResult {
  const EmergencyRouteActionResult({
    required this.actionId,
    required this.action,
    required this.clinicLocationId,
    required this.triageSessionId,
    required this.followUpDueAt,
    required this.createdAt,
  });

  final String actionId;
  final String action;
  final String clinicLocationId;
  final String? triageSessionId;
  final DateTime? followUpDueAt;
  final DateTime createdAt;

  factory EmergencyRouteActionResult.fromJson(Map<String, dynamic> json) {
    return EmergencyRouteActionResult(
      actionId: json['actionId'] as String,
      action: json['action'] as String,
      clinicLocationId: json['clinicLocationId'] as String,
      triageSessionId: json['triageSessionId'] as String?,
      followUpDueAt: json['followUpDueAt'] == null
          ? null
          : DateTime.parse(json['followUpDueAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class EmergencyTriageDraft {
  const EmergencyTriageDraft({
    required this.species,
    required this.signalCodes,
    required this.disclaimerAccepted,
    required this.updatedAt,
  });

  final String species;
  final List<String> signalCodes;
  final bool disclaimerAccepted;
  final DateTime updatedAt;

  bool get isEmpty => signalCodes.isEmpty && !disclaimerAccepted;
}

abstract class EmergencyTriageDraftStore {
  Future<void> write(EmergencyTriageDraft draft);
  Future<EmergencyTriageDraft?> read();
  Future<void> clear();
}

class InMemoryEmergencyTriageDraftStore implements EmergencyTriageDraftStore {
  EmergencyTriageDraft? _draft;

  @override
  Future<void> write(EmergencyTriageDraft draft) async {
    _draft = draft;
  }

  @override
  Future<EmergencyTriageDraft?> read() async => _draft;

  @override
  Future<void> clear() async {
    _draft = null;
  }
}

class EmergencyRepository {
  EmergencyRepository({
    required Uri baseUrl,
    http.Client? client,
    EmergencyClinicCacheStore? cacheStore,
    EmergencyTriageDraftStore? triageDraftStore,
  })  : _baseUrl = baseUrl,
        _client = client ?? http.Client(),
        _cacheStore = cacheStore ?? _sharedCacheStore,
        _triageDraftStore = triageDraftStore ?? _sharedTriageDraftStore;

  final Uri _baseUrl;
  final http.Client _client;
  final EmergencyClinicCacheStore _cacheStore;
  final EmergencyTriageDraftStore _triageDraftStore;
  static final InMemoryEmergencyClinicCacheStore _sharedCacheStore =
      InMemoryEmergencyClinicCacheStore();
  static final InMemoryEmergencyTriageDraftStore _sharedTriageDraftStore =
      InMemoryEmergencyTriageDraftStore();

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
    final clinics = payload
        .whereType<Map<String, dynamic>>()
        .map(EmergencyClinic.fromJson)
        .toList(growable: false);
    await _cacheStore.write(
      filters.cacheKey,
      EmergencyCachedClinics(
        clinics: clinics,
        cachedAt: DateTime.now().toUtc(),
      ),
    );
    return clinics;
  }

  Future<EmergencyCachedClinics?> cached(EmergencyClinicFilters filters) {
    return _cacheStore.read(filters.cacheKey);
  }

  Future<EmergencyTriageDecision> assessTriage({
    required String species,
    required List<String> signalCodes,
    required bool disclaimerAccepted,
  }) async {
    final response = await _client.post(
      _baseUrl.resolve('v1/emergency/triage-decisions'),
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(<String, Object>{
        'species': species,
        'signalCodes': signalCodes,
        'disclaimerAccepted': disclaimerAccepted,
      }),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw EmergencyApiException(response.statusCode, _errorCode(payload));
    }
    return EmergencyTriageDecision.fromJson(payload);
  }

  Future<EmergencyRouteActionResult> recordRouteAction({
    required String clinicLocationId,
    required String action,
    String? triageSessionId,
  }) async {
    final response = await _client.post(
      _baseUrl.resolve('v1/emergency/route-actions'),
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(<String, Object>{
        'clinicLocationId': clinicLocationId,
        'action': action,
        'source': 'owner_mobile',
        if (triageSessionId != null) 'triageSessionId': triageSessionId,
      }),
    );
    final payload = _decode(response);
    if (response.statusCode != 201 || payload is! Map<String, dynamic>) {
      throw EmergencyApiException(response.statusCode, _errorCode(payload));
    }
    return EmergencyRouteActionResult.fromJson(payload);
  }

  Future<EmergencyTriageDraft?> readTriageDraft() {
    return _triageDraftStore.read();
  }

  Future<void> saveTriageDraft({
    required String species,
    required List<String> signalCodes,
    required bool disclaimerAccepted,
  }) {
    return _triageDraftStore.write(EmergencyTriageDraft(
      species: species,
      signalCodes: signalCodes,
      disclaimerAccepted: disclaimerAccepted,
      updatedAt: DateTime.now().toUtc(),
    ));
  }

  Future<void> clearTriageDraft() {
    return _triageDraftStore.clear();
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
