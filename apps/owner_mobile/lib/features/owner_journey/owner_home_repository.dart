import 'dart:convert';

import 'package:http/http.dart' as http;

import 'owner_home_models.dart';

abstract class OwnerHomeRepository {
  Future<OwnerHomeSnapshot> read({String? selectedPetId});
}

class OwnerHomeException implements Exception {
  const OwnerHomeException({required this.kind, this.statusCode});

  final OwnerHomeErrorKind kind;
  final int? statusCode;
}

enum OwnerHomeErrorKind {
  offline,
  sessionExpired,
  invalidResponse,
  unavailable
}

class HttpOwnerHomeRepository implements OwnerHomeRepository {
  HttpOwnerHomeRepository({
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
  Future<OwnerHomeSnapshot> read({String? selectedPetId}) async {
    final endpoint = _baseUrl.resolve('v1/owner/home');
    final uri = selectedPetId == null
        ? endpoint
        : endpoint.replace(queryParameters: {'selectedPetId': selectedPetId});
    http.Response response;
    try {
      response = await _client.get(
        uri,
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer ${await _accessToken()}',
        },
      );
    } on http.ClientException {
      throw const OwnerHomeException(kind: OwnerHomeErrorKind.offline);
    }
    if (response.statusCode == 401) {
      throw const OwnerHomeException(
        kind: OwnerHomeErrorKind.sessionExpired,
        statusCode: 401,
      );
    }
    if (response.statusCode != 200) {
      throw OwnerHomeException(
        kind: OwnerHomeErrorKind.unavailable,
        statusCode: response.statusCode,
      );
    }
    try {
      final data = jsonDecode(response.body);
      if (data is! Map<String, dynamic>) throw const FormatException();
      return OwnerHomeSnapshot.fromJson(data);
    } on FormatException {
      throw const OwnerHomeException(kind: OwnerHomeErrorKind.invalidResponse);
    } on TypeError {
      throw const OwnerHomeException(kind: OwnerHomeErrorKind.invalidResponse);
    }
  }
}
