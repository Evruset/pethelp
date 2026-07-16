import 'dart:convert';

import 'package:http/http.dart' as http;

import 'catalog_models.dart';

class PublicCatalogApiException implements Exception {
  const PublicCatalogApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}

abstract class PublicCatalogRepository {
  Future<List<CatalogClinic>> listClinics(
      {String? query, CatalogClinicFilters? filters});
  Future<CatalogClinicDetail> readClinic(String clinicId);
  Future<List<CatalogLocation>> listLocations({String? query});
  Future<List<CatalogService>> listLocationServices(String locationId);
  Future<List<CatalogAvailabilitySlot>> readAvailability({
    required String locationId,
    required DateTime from,
    required DateTime to,
  });
  Future<List<CatalogDoctor>> listDoctors({
    required String clinicId,
    String? locationId,
    String? serviceCode,
  }) =>
      Future.error(
          const PublicCatalogApiException(501, 'DOCTOR_DISCOVERY_UNAVAILABLE'));
  Future<CatalogDoctor> readDoctor(String doctorId) => Future.error(
      const PublicCatalogApiException(501, 'DOCTOR_DISCOVERY_UNAVAILABLE'));
}

class HttpPublicCatalogRepository implements PublicCatalogRepository {
  HttpPublicCatalogRepository({
    required Uri baseUrl,
    this.selectedPetId,
    this.accessTokenProvider,
    http.Client? client,
  })  : _baseUrl = baseUrl,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final http.Client _client;
  final String? selectedPetId;
  final Future<String> Function()? accessTokenProvider;

  Uri _uri(String path, [Map<String, String>? queryParameters]) {
    return _baseUrl.resolve(path).replace(queryParameters: queryParameters);
  }

  @override
  Future<List<CatalogClinic>> listClinics(
      {String? query, CatalogClinicFilters? filters}) async {
    final parameters = <String, String>{'limit': '20'};
    if (selectedPetId != null) parameters['selectedPetId'] = selectedPetId!;
    final selectedFilters = filters;
    final value = (selectedFilters?.query ?? query)?.trim();
    if (value != null && value.isNotEmpty) parameters['q'] = value;
    final serviceCode = selectedFilters?.serviceCode?.trim();
    if (serviceCode != null && serviceCode.isNotEmpty) {
      parameters['serviceCode'] = serviceCode;
    }
    final latitude = selectedFilters?.latitude;
    final longitude = selectedFilters?.longitude;
    final radiusKm = selectedFilters?.radiusKm;
    if (latitude != null && longitude != null) {
      parameters['latitude'] = latitude.toString();
      parameters['longitude'] = longitude.toString();
      if (radiusKm != null) parameters['radiusKm'] = radiusKm.toString();
    }
    final from = selectedFilters?.availableFrom;
    if (from != null) {
      parameters['availableFrom'] = from.toUtc().toIso8601String();
    }
    final to = selectedFilters?.availableTo;
    if (to != null) parameters['availableTo'] = to.toUtc().toIso8601String();
    final openNow = selectedFilters?.openNow;
    if (openNow != null) parameters['openNow'] = openNow.toString();
    final telemedAvailable = selectedFilters?.telemedAvailable;
    if (telemedAvailable != null) {
      parameters['telemedAvailable'] = telemedAvailable.toString();
    }
    final emergencyCapability = selectedFilters?.emergencyCapability?.trim();
    if (emergencyCapability != null && emergencyCapability.isNotEmpty) {
      parameters['emergencyCapability'] = emergencyCapability;
    }
    final sort = selectedFilters?.sort;
    if (sort != null && sort.isNotEmpty) parameters['sort'] = sort;

    final response = await _client.get(
      _uri('v1/clinics', parameters),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }

    final rawClinics = payload['clinics'];
    if (rawClinics is! List) {
      throw const PublicCatalogApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return rawClinics
        .whereType<Map<String, dynamic>>()
        .map(_clinicFromJson)
        .toList(growable: false);
  }

  @override
  Future<CatalogClinicDetail> readClinic(String clinicId) async {
    final response = await _client.get(
      _uri('v1/clinics/$clinicId'),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }

    final rawLocations = payload['locations'];
    if (rawLocations is! List) {
      throw const PublicCatalogApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return CatalogClinicDetail(
      id: payload['id'] as String,
      name: payload['name'] as String,
      locationCount: (payload['locationCount'] as num?)?.toInt() ?? 0,
      serviceCount: (payload['serviceCount'] as num?)?.toInt() ?? 0,
      nextAvailableAt: _optionalDate(payload['nextAvailableAt']),
      distanceKm: (payload['distanceKm'] as num?)?.toDouble(),
      telemedAvailable: payload['telemedAvailable'] as bool? ?? false,
      emergencyAvailable: payload['emergencyAvailable'] as bool? ?? false,
      doctorCount: (payload['doctorCount'] as num?)?.toInt() ?? 0,
      priceFrom: payload['priceFrom'] as String?,
      availability: _availabilitySummary(payload['availability']),
      fitReasons: _strings(payload['fitReasons']),
      locations: rawLocations
          .whereType<Map<String, dynamic>>()
          .map(_locationFromJson)
          .toList(growable: false),
    );
  }

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async {
    final parameters = <String, String>{'limit': '20'};
    final value = query?.trim();
    if (value != null && value.isNotEmpty) parameters['q'] = value;

    final response = await _client.get(
      _uri('v1/catalog/clinic-locations', parameters),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }

    final rawLocations = payload['locations'];
    if (rawLocations is! List) {
      throw const PublicCatalogApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return rawLocations
        .whereType<Map<String, dynamic>>()
        .map(_locationFromJson)
        .toList(growable: false);
  }

  @override
  Future<List<CatalogService>> listLocationServices(String locationId) async {
    final response = await _client.get(
      _uri('v1/clinic-locations/$locationId/services'),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }

    final rawServices = payload['services'];
    if (rawServices is! List) {
      throw const PublicCatalogApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return rawServices
        .whereType<Map<String, dynamic>>()
        .map(_serviceFromJson)
        .toList(growable: false);
  }

  @override
  Future<List<CatalogAvailabilitySlot>> readAvailability({
    required String locationId,
    required DateTime from,
    required DateTime to,
  }) async {
    final response = await _client.get(
      _uri(
        'v1/clinic-locations/$locationId/availability',
        <String, String>{
          'from': from.toUtc().toIso8601String(),
          'to': to.toUtc().toIso8601String(),
          'limit': '12',
        },
      ),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }

    final rawSlots = payload['slots'];
    if (rawSlots is! List) {
      throw const PublicCatalogApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return rawSlots
        .whereType<Map<String, dynamic>>()
        .map(_availabilitySlotFromJson)
        .toList(growable: false);
  }

  CatalogClinic _clinicFromJson(Map<String, dynamic> json) {
    return CatalogClinic(
      id: json['id'] as String,
      name: json['name'] as String,
      locationCount: (json['locationCount'] as num?)?.toInt() ?? 0,
      serviceCount: (json['serviceCount'] as num?)?.toInt() ?? 0,
      nextAvailableAt: _optionalDate(json['nextAvailableAt']),
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      telemedAvailable: json['telemedAvailable'] as bool? ?? false,
      emergencyAvailable: json['emergencyAvailable'] as bool? ?? false,
      doctorCount: (json['doctorCount'] as num?)?.toInt() ?? 0,
      priceFrom: json['priceFrom'] as String?,
      availability: _availabilitySummary(json['availability']),
      fitReasons: _strings(json['fitReasons']),
    );
  }

  @override
  Future<List<CatalogDoctor>> listDoctors({
    required String clinicId,
    String? locationId,
    String? serviceCode,
  }) async {
    final parameters = <String, String>{'limit': '20'};
    if (locationId != null) parameters['locationId'] = locationId;
    if (serviceCode != null) parameters['serviceCode'] = serviceCode;
    if (selectedPetId != null) parameters['selectedPetId'] = selectedPetId!;
    final response = await _client.get(
      _uri('v1/clinics/$clinicId/doctors', parameters),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }
    final doctors = payload['doctors'];
    if (doctors is! List) {
      throw const PublicCatalogApiException(503, 'BACKEND_UNAVAILABLE');
    }
    return doctors
        .whereType<Map<String, dynamic>>()
        .map(_doctorFromJson)
        .toList(growable: false);
  }

  @override
  Future<CatalogDoctor> readDoctor(String doctorId) async {
    final response = await _client.get(
      _uri('v1/doctors/$doctorId'),
      headers: await _headers(),
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw PublicCatalogApiException(response.statusCode, _errorCode(payload));
    }
    return _doctorFromJson(payload);
  }

  CatalogDoctor _doctorFromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final location = json['location'] as Map<String, dynamic>;
    return CatalogDoctor(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      title: json['title'] as String? ?? 'Ветеринарный врач',
      clinicId: clinic['id'] as String,
      clinicName: clinic['name'] as String,
      locationId: location['id'] as String,
      locationAddress: location['address'] as String,
      nextAvailableAt: _optionalDate(json['nextAvailableAt']),
      availability: _availabilitySummary(json['availability']),
    );
  }

  CatalogAvailabilitySummary _availabilitySummary(dynamic value) {
    if (value is! Map<String, dynamic>) {
      return const CatalogAvailabilitySummary.unavailable();
    }
    return CatalogAvailabilitySummary(
      sourceUpdatedAt: _optionalDate(value['sourceUpdatedAt']),
      serverNow: _optionalDate(value['serverNow']),
      freshness: switch (value['freshness']) {
        'CURRENT' => CatalogAvailabilityFreshness.current,
        'AGING' => CatalogAvailabilityFreshness.aging,
        'STALE' => CatalogAvailabilityFreshness.stale,
        _ => CatalogAvailabilityFreshness.unavailable,
      },
      confirmationMode: switch (value['confirmationMode']) {
        'INSTANT' => CatalogConfirmationMode.instant,
        'ALTERNATIVE_POSSIBLE' => CatalogConfirmationMode.alternativePossible,
        _ => CatalogConfirmationMode.clinicConfirmation,
      },
    );
  }

  List<String> _strings(dynamic value) => value is List
      ? value.whereType<String>().toList(growable: false)
      : const <String>[];

  Future<Map<String, String>> _headers() async {
    final headers = <String, String>{'Accept': 'application/json'};
    final provider = accessTokenProvider;
    if (provider != null) {
      headers['Authorization'] = 'Bearer ${await provider()}';
    }
    return headers;
  }

  CatalogLocation _locationFromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final location = json['location'] as Map<String, dynamic>;
    final availability = json['availability'] as Map<String, dynamic>;
    return CatalogLocation(
      clinicId: clinic['id'] as String,
      clinicName: clinic['name'] as String,
      locationId: location['id'] as String,
      address: location['address'] as String,
      phone: location['phone'] as String?,
      latitude: (location['latitude'] as num?)?.toDouble(),
      longitude: (location['longitude'] as num?)?.toDouble(),
      hasOpenSlots: availability['hasOpenSlots'] as bool? ?? false,
      observedAt:
          DateTime.parse(availability['observedAt'] as String).toLocal(),
    );
  }

  CatalogService _serviceFromJson(Map<String, dynamic> json) {
    return CatalogService(
      id: json['id'] as String,
      code: json['code'] as String,
      displayName: json['displayName'] as String,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
      priceAmount: json['priceAmount'] as String,
      currency: json['currency'] as String,
    );
  }

  CatalogAvailabilitySlot _availabilitySlotFromJson(Map<String, dynamic> json) {
    final service =
        json['service'] as Map<String, dynamic>? ?? const <String, dynamic>{};
    return CatalogAvailabilitySlot(
      id: json['id'] as String,
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      remainingCapacity: (json['remainingCapacity'] as num?)?.toInt() ?? 0,
      serviceId: service['id'] as String?,
      serviceName: service['name'] as String?,
    );
  }

  DateTime? _optionalDate(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.parse(value).toLocal();
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
