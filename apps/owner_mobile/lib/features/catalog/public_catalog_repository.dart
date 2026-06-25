import 'dart:convert';

import 'package:http/http.dart' as http;

import 'catalog_models.dart';

class PublicCatalogApiException implements Exception {
  const PublicCatalogApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}

abstract class PublicCatalogRepository {
  Future<List<CatalogLocation>> listLocations({String? query});
}

class HttpPublicCatalogRepository implements PublicCatalogRepository {
  HttpPublicCatalogRepository({required Uri baseUrl, http.Client? client})
      : _baseUrl = baseUrl,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final http.Client _client;

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async {
    final parameters = <String, String>{'limit': '20'};
    final value = query?.trim();
    if (value != null && value.isNotEmpty) parameters['q'] = value;

    final response = await _client.get(
      _baseUrl.resolve('v1/catalog/clinic-locations').replace(queryParameters: parameters),
      headers: const {'Accept': 'application/json'},
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
      hasOpenSlots: availability['hasOpenSlots'] as bool? ?? false,
      observedAt: DateTime.parse(availability['observedAt'] as String).toLocal(),
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
