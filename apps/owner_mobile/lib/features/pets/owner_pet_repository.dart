import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/offline/offline_command.dart';
import '../../core/offline/outbox_repository.dart';
import '../../core/offline/outbox_sync_engine.dart';
import 'owner_pet.dart';

abstract class OwnerPetRepository {
  Future<List<OwnerPet>> list();
  Future<OwnerPet> read(String petId);
  Future<OwnerPet> create(OwnerPetProfileInput input);
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  });
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(String petId);
}

sealed class OwnerPetSaveResult {
  const OwnerPetSaveResult();
}

class OwnerPetSaved extends OwnerPetSaveResult {
  const OwnerPetSaved(this.pet);

  final OwnerPet pet;
}

class OwnerPetUpdateQueued extends OwnerPetSaveResult {
  const OwnerPetUpdateQueued({
    required this.petId,
    required this.mutationId,
    required this.baseServerVersion,
  });

  final String petId;
  final String mutationId;
  final int baseServerVersion;
}

class OwnerPetProfileSyncState {
  const OwnerPetProfileSyncState({
    required this.petId,
    required this.status,
    required this.changedFields,
    required this.createdAt,
  });

  final String petId;
  final OfflineCommandStatus status;
  final List<String> changedFields;
  final DateTime createdAt;
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
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async {
    final response = await _client.patch(
      _baseUrl.resolve('v1/owner/pets/$petId'),
      headers: await _headers(json: true, profileVersion: profileVersion),
      body: jsonEncode(input.toJson(includeNulls: true)),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) {
      throw OwnerPetApiException(response.statusCode, _errorCode(data));
    }
    return OwnerPetSaved(_toPet(data));
  }

  @override
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(
          String petId) async =>
      const <OwnerPetProfileSyncState>[];

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
        ageMonths: (json['ageMonths'] as num?)?.toInt(),
        sex: json['sex'] as String?,
        gender: json['gender'] as String?,
        weightKg: json['weightKg'] as String?,
        sterilized: json['sterilized'] as bool?,
        isSterilized: json['isSterilized'] as bool?,
        chipNumber: json['chipNumber'] as String?,
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

class OfflineCapableOwnerPetRepository implements OwnerPetRepository {
  OfflineCapableOwnerPetRepository({
    required OwnerPetRepository remote,
    required OutboxRepository outbox,
    required String deviceId,
    required int Function() nextDeviceSequence,
  })  : _remote = remote,
        _outbox = outbox,
        _deviceId = deviceId,
        _nextDeviceSequence = nextDeviceSequence;

  final OwnerPetRepository _remote;
  final OutboxRepository _outbox;
  final String _deviceId;
  final int Function() _nextDeviceSequence;

  @override
  Future<List<OwnerPet>> list() async {
    await syncPending();
    return _remote.list();
  }

  @override
  Future<OwnerPet> read(String petId) async {
    await syncPending();
    return _remote.read(petId);
  }

  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async {
    await syncPending();
    return _remote.create(input);
  }

  @override
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async {
    try {
      final result = await _remote.update(
        petId: petId,
        profileVersion: profileVersion,
        input: input,
      );
      await _outbox.removeCommandsForAggregate(
        aggregateType: 'pet',
        aggregateId: petId,
      );
      return result;
    } on OwnerPetApiException {
      rethrow;
    } on TimeoutException {
      return _queueUpdate(
        petId: petId,
        profileVersion: profileVersion,
        input: input,
      );
    } on http.ClientException {
      return _queueUpdate(
        petId: petId,
        profileVersion: profileVersion,
        input: input,
      );
    }
  }

  @override
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(String petId) async {
    final commands = await _outbox.commandsForAggregate(
      aggregateType: 'pet',
      aggregateId: petId,
    );
    return commands
        .map((command) => OwnerPetProfileSyncState(
              petId: petId,
              status: command.status,
              changedFields: command.changedFields,
              createdAt: command.createdAt,
            ))
        .toList(growable: false);
  }

  Future<OutboxSyncReport> syncPending() {
    return OutboxSyncEngine(
      repository: _outbox,
      transport: _OwnerPetOutboxTransport(_remote),
      canReachApi: () async => true,
    ).sync();
  }

  Future<OwnerPetUpdateQueued> _queueUpdate({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async {
    final mutationId = input.mutationId ??
        'owner-mobile-${DateTime.now().microsecondsSinceEpoch}';
    await _outbox.enqueue(OfflineCommand(
      mutationId: mutationId,
      kind: OfflineCommandKind.updatePetProfile,
      aggregateType: 'pet',
      aggregateId: petId,
      deviceId: _deviceId,
      deviceSequence: _nextDeviceSequence(),
      baseServerVersion: profileVersion,
      payloadSchemaVersion: 1,
      changedFields: OwnerPetProfileInput.profileFields,
      payload: input.toJson(includeNulls: true),
      createdAt: DateTime.now().toUtc(),
    ));
    return OwnerPetUpdateQueued(
      petId: petId,
      mutationId: mutationId,
      baseServerVersion: profileVersion,
    );
  }
}

class _OwnerPetOutboxTransport implements OfflineCommandTransport {
  const _OwnerPetOutboxTransport(this._remote);

  final OwnerPetRepository _remote;

  @override
  Future<OutboxRemoteResult> send(OfflineCommand command) async {
    if (command.kind != OfflineCommandKind.updatePetProfile) {
      return const OutboxRemoteResult(OutboxRemoteResultKind.invalid);
    }

    try {
      await _remote.update(
        petId: command.aggregateId,
        profileVersion: command.baseServerVersion,
        input: OwnerPetProfileInput.fromJson(
          command.payload,
          mutationId: command.mutationId,
        ),
      );
      return const OutboxRemoteResult(OutboxRemoteResultKind.completed);
    } on OwnerPetApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        return const OutboxRemoteResult(OutboxRemoteResultKind.unauthenticated);
      }
      if (error.statusCode == 412 ||
          error.code == 'PET_PROFILE_VERSION_MISMATCH') {
        return const OutboxRemoteResult(OutboxRemoteResultKind.conflict);
      }
      if (error.statusCode == 400) {
        return const OutboxRemoteResult(OutboxRemoteResultKind.invalid);
      }
      if (error.statusCode == 404) {
        return const OutboxRemoteResult(OutboxRemoteResultKind.denied);
      }
      return const OutboxRemoteResult(OutboxRemoteResultKind.retryableFailure);
    } on TimeoutException {
      return const OutboxRemoteResult(OutboxRemoteResultKind.retryableFailure);
    } on http.ClientException {
      return const OutboxRemoteResult(OutboxRemoteResultKind.retryableFailure);
    }
  }
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
    this.ageMonths,
    this.sex,
    this.gender,
    this.weightKg,
    this.sterilized,
    this.isSterilized,
    this.chipNumber,
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
  final int? ageMonths;
  final String? sex;
  final String? gender;
  final double? weightKg;
  final bool? sterilized;
  final bool? isSterilized;
  final String? chipNumber;
  final List<String> allergies;
  final List<String> chronicConditions;
  final String? vaccinationNotes;
  final String? photoUrl;
  final List<String> insurancePolicyLinks;
  final String? mutationId;

  static const profileFields = <String>[
    'name',
    'species',
    'breed',
    'birthDate',
    'ageMonths',
    'sex',
    'gender',
    'weightKg',
    'sterilized',
    'isSterilized',
    'chipNumber',
    'allergies',
    'chronicConditions',
    'vaccinationNotes',
    'photoUrl',
    'insurancePolicyLinks',
  ];

  factory OwnerPetProfileInput.fromJson(
    Map<String, Object?> json, {
    String? mutationId,
  }) {
    return OwnerPetProfileInput(
      name: json['name'] as String? ?? '',
      species: json['species'] as String? ?? 'OTHER',
      breed: json['breed'] as String?,
      birthDate: _optionalDate(json['birthDate']),
      ageMonths: _optionalInt(json['ageMonths']),
      sex: json['sex'] as String?,
      gender: json['gender'] as String?,
      weightKg: _optionalDouble(json['weightKg']),
      sterilized: json['sterilized'] as bool?,
      isSterilized: json['isSterilized'] as bool?,
      chipNumber: json['chipNumber'] as String?,
      allergies: _stringList(json['allergies']),
      chronicConditions: _stringList(json['chronicConditions']),
      vaccinationNotes: json['vaccinationNotes'] as String?,
      photoUrl: json['photoUrl'] as String?,
      insurancePolicyLinks: _stringList(json['insurancePolicyLinks']),
      mutationId: mutationId ?? json['mutationId'] as String?,
    );
  }

  Map<String, Object?> toJson({bool includeNulls = false}) {
    final json = <String, Object?>{
      'name': name,
      'species': species,
      'allergies': _cleanList(allergies),
      'chronicConditions': _cleanList(chronicConditions),
      'insurancePolicyLinks': _cleanList(insurancePolicyLinks),
    };
    _putOptional(json, 'breed', _text(breed), includeNulls);
    _putOptional(json, 'birthDate',
        birthDate == null ? null : _dateOnly(birthDate!), includeNulls);
    _putOptional(json, 'ageMonths', ageMonths, includeNulls);
    _putOptional(json, 'sex', sex, includeNulls);
    _putOptional(json, 'gender', gender, includeNulls);
    _putOptional(json, 'weightKg', weightKg, includeNulls);
    _putOptional(json, 'sterilized', sterilized, includeNulls);
    _putOptional(json, 'isSterilized', isSterilized, includeNulls);
    _putOptional(json, 'chipNumber', _text(chipNumber), includeNulls);
    _putOptional(
        json, 'vaccinationNotes', _text(vaccinationNotes), includeNulls);
    _putOptional(json, 'photoUrl', _text(photoUrl), includeNulls);
    _putOptional(json, 'mutationId', _text(mutationId), false);
    return json;
  }

  static void _putOptional(
    Map<String, Object?> json,
    String key,
    Object? value,
    bool includeNulls,
  ) {
    if (value != null || includeNulls) {
      json[key] = value;
    }
  }

  static DateTime? _optionalDate(Object? value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }

  static double? _optionalDouble(Object? value) {
    if (value is num) return value.toDouble();
    if (value is String && value.isNotEmpty) return double.tryParse(value);
    return null;
  }

  static int? _optionalInt(Object? value) {
    if (value is num) return value.toInt();
    if (value is String && value.isNotEmpty) return int.tryParse(value);
    return null;
  }

  static List<String> _stringList(Object? value) {
    if (value is! List) return const <String>[];
    return value.whereType<String>().toList(growable: false);
  }

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
