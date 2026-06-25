import 'dart:convert';

import 'package:http/http.dart' as http;

import 'owner_pet.dart';

abstract class OwnerPetRepository {
  Future<List<OwnerPet>> list();
  Future<OwnerPet> create({required String name, required String species});
}

class HttpOwnerPetRepository implements OwnerPetRepository {
  HttpOwnerPetRepository({
    required Uri baseUrl,
    required Future<String> Function() accessToken,
    http.Client? client,
  })  : _baseUrl = baseUrl,
        _accessToken = accessToken,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final Future<String> Function() _accessToken;
  final http.Client _client;

  @override
  Future<List<OwnerPet>> list() async {
    final response = await _client.get(
      _baseUrl.resolve('v1/owner/pets'),
      headers: await _headers(),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! List) throw OwnerPetApiException(response.statusCode, _errorCode(data));
    return data.whereType<Map<String, dynamic>>().map(_toPet).toList(growable: false);
  }

  @override
  Future<OwnerPet> create({required String name, required String species}) async {
    final response = await _client.post(
      _baseUrl.resolve('v1/owner/pets'),
      headers: await _headers(json: true),
      body: jsonEncode({'name': name, 'species': species}),
    );
    final data = _decode(response);
    if (response.statusCode != 201 || data is! Map<String, dynamic>) throw OwnerPetApiException(response.statusCode, _errorCode(data));
    return _toPet(data);
  }

  Future<Map<String, String>> _headers({bool json = false}) async {
    final token = await _accessToken();
    return {
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
      if (json) 'Content-Type': 'application/json',
    };
  }

  OwnerPet _toPet(Map<String, dynamic> json) => OwnerPet(
        id: json['id'] as String,
        name: json['name'] as String,
        species: json['species'] as String,
      );

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return null;
    }
  }

  String _errorCode(dynamic data) => data is Map<String, dynamic> && data['code'] is String ? data['code'] as String : 'BACKEND_UNAVAILABLE';
}

class OwnerPetApiException implements Exception {
  const OwnerPetApiException(this.statusCode, this.code);
  final int statusCode;
  final String code;
}
