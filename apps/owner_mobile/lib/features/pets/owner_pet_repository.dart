import 'dart:convert';

import 'package:http/http.dart' as http;

import 'owner_pet.dart';

abstract class OwnerPetRepository {
  Future<List<OwnerPet>> list();
  Future<OwnerPet> read(String petId);
  Future<OwnerPet> create(OwnerPetProfileInput input);
  Future<OwnerPet> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  });
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
    if (response.statusCode != 200 || data is! List) {
      throw OwnerPetApiException(response.statusCode, _errorCode(data));
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map(_toPet)
        .toList(growable: false);
  }

  @override
  Future<OwnerPet> read(String petId) async {
    final response = await _client.get(
      _baseUrl.resolve('v1/owner/pets/$petId'),
      headers: await _headers(),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) {
      throw OwnerPetApiException(response.statusCode, _errorCode(data));
    }
    return _toPet(data);
  }

  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async {
    final response = await _client.post(
      _baseUrl.resolve('v1/owner/pets'),
      headers: await _headers(json: true),
      body: jsonEncode(input.toJson()),
    );
    final data = _decode(response);
    if (response.statusCode != 201 || data is! Map<String, dynamic>) {
      throw OwnerPetApiException(response.statusCode, _errorCode(data));
    }
    return _toPet(data);
  }

  @override
  Future<OwnerPet> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async {
    final response = await _client.patch(
      _baseUrl.resolve('v1/owner/pets/$petId'),
      headers: await _headers(json: true, profileVersion: profileVersion),
      body: jsonEncode(input.toJson()),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) {
      throw OwnerPetApiException(response.statusCode, _errorCode(data));
    }
    return _toPet(data);
  }

  Future<Map<String, String>> _headers({
    bool json = false,
    int? profileVersion,
  }) async {
    final token = await _accessToken();
    return {
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
      if (json) 'Content-Type': 'application/json',
      if (profileVersion != null) 'If-Match': '"$profileVersion"',
    };
  }

  OwnerPet _toPet(Map<String, dynamic> json) => OwnerPet(
        id: json['id'] as String,
        name: json['name'] as String,
        species: json['species'] as String,
        breed: json['breed'] as String?,
        birthDate: _optionalDate(json['birthDate']),
        sex: json['sex'] as String?,
        weightKg: json['weightKg'] as String?,
        sterilized: json['sterilized'] as bool?,
        allergies: _stringList(json['allergies']),
        chronicConditions: _stringList(json['chronicConditions']),
        vaccinationNotes: json['vaccinationNotes'] as String?,
        photoUrl: json['photoUrl'] as String?,
        insurancePolicyLinks: _stringList(json['insurancePolicyLinks']),
        profileVersion: (json['profileVersion'] as num?)?.toInt() ?? 1,
        createdAt: _optionalDateTime(json['createdAt']),
        updatedAt: _optionalDateTime(json['updatedAt']),
      );

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return null;
    }
  }

  DateTime? _optionalDate(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }

  DateTime? _optionalDateTime(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toLocal();
  }

  List<String> _stringList(dynamic value) {
    if (value is! List) return const <String>[];
    return value.whereType<String>().toList(growable: false);
  }

  String _errorCode(dynamic data) =>
      data is Map<String, dynamic> && data['code'] is String
          ? data['code'] as String
          : 'BACKEND_UNAVAILABLE';
}

class OwnerPetApiException implements Exception {
  const OwnerPetApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}

class OwnerPetProfileInput {
  const OwnerPetProfileInput({
    required this.name,
    required this.species,
    this.breed,
    this.birthDate,
    this.sex,
    this.weightKg,
    this.sterilized,
    this.allergies = const <String>[],
    this.chronicConditions = const <String>[],
    this.vaccinationNotes,
    this.photoUrl,
    this.insurancePolicyLinks = const <String>[],
    this.mutationId,
  });

  final String name;
  final String species;
  final String? breed;
  final DateTime? birthDate;
  final String? sex;
  final double? weightKg;
  final bool? sterilized;
  final List<String> allergies;
  final List<String> chronicConditions;
  final String? vaccinationNotes;
  final String? photoUrl;
  final List<String> insurancePolicyLinks;
  final String? mutationId;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'species': species,
        if (_text(breed) != null) 'breed': _text(breed),
        if (birthDate != null) 'birthDate': _dateOnly(birthDate!),
        if (sex != null) 'sex': sex,
        if (weightKg != null) 'weightKg': weightKg,
        if (sterilized != null) 'sterilized': sterilized,
        'allergies': _cleanList(allergies),
        'chronicConditions': _cleanList(chronicConditions),
        if (_text(vaccinationNotes) != null)
          'vaccinationNotes': _text(vaccinationNotes),
        if (_text(photoUrl) != null) 'photoUrl': _text(photoUrl),
        'insurancePolicyLinks': _cleanList(insurancePolicyLinks),
        if (_text(mutationId) != null) 'mutationId': _text(mutationId),
      };

  static String? _text(String? value) {
    final normalized = value?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }

  static List<String> _cleanList(List<String> value) {
    return value
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  static String _dateOnly(DateTime value) {
    return '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }
}
