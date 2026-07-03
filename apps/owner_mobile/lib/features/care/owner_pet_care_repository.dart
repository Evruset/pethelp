import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../appointments/owner_appointments_repository.dart';
import '../pets/owner_pet.dart';
import '../pets/owner_pet_files.dart';

class OwnerPetCareSummary {
  const OwnerPetCareSummary({
    required this.pet,
    required this.documents,
    required this.visits,
    required this.telemedSessions,
    required this.serverNow,
  });

  final OwnerPet pet;
  final List<OwnerPetCareDocument> documents;
  final List<OwnerPetCareVisit> visits;
  final List<OwnerPetCareTelemedSession> telemedSessions;
  final DateTime serverNow;

  factory OwnerPetCareSummary.fromJson(Map<String, dynamic> json) {
    return OwnerPetCareSummary(
      pet: _pet(json['pet'] as Map<String, dynamic>),
      documents: (json['documents'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(OwnerPetCareDocument.fromJson)
          .toList(growable: false),
      visits: (json['visits'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(OwnerPetCareVisit.fromJson)
          .toList(growable: false),
      telemedSessions:
          (json['telemedSessions'] as List<dynamic>? ?? const <dynamic>[])
              .whereType<Map<String, dynamic>>()
              .map(OwnerPetCareTelemedSession.fromJson)
              .toList(growable: false),
      serverNow: DateTime.parse(json['serverNow'] as String).toLocal(),
    );
  }
}

class OwnerPetCareDocument {
  const OwnerPetCareDocument({
    this.id,
    required this.type,
    required this.label,
    required this.value,
    this.fileName,
    this.mimeType,
    this.sizeBytes,
    this.createdAt,
    this.downloadUrl,
    this.canOpen = false,
    this.canDelete = false,
    this.isImage = false,
  });

  final String? id;
  final String type;
  final String label;
  final String value;
  final String? fileName;
  final String? mimeType;
  final int? sizeBytes;
  final DateTime? createdAt;
  final String? downloadUrl;
  final bool canOpen;
  final bool canDelete;
  final bool isImage;

  factory OwnerPetCareDocument.fromJson(Map<String, dynamic> json) {
    final mimeType = json['mimeType'] as String?;
    return OwnerPetCareDocument(
      id: json['id'] as String?,
      type: json['type'] as String,
      label: json['label'] as String,
      value: json['value'] as String,
      fileName: json['fileName'] as String?,
      mimeType: mimeType,
      sizeBytes: (json['sizeBytes'] as num?)?.toInt(),
      createdAt: _optionalDateTime(json['createdAt']),
      downloadUrl: json['downloadUrl'] as String?,
      canOpen: json['canOpen'] as bool? ?? false,
      canDelete: json['canDelete'] as bool? ?? false,
      isImage:
          json['isImage'] as bool? ?? (mimeType?.startsWith('image/') ?? false),
    );
  }
}

class OwnerPetCareVisit {
  const OwnerPetCareVisit({
    required this.holdId,
    required this.appointmentId,
    required this.state,
    required this.bucket,
    required this.presentation,
    required this.startsAt,
    required this.endsAt,
    required this.clinicName,
    required this.clinicAddress,
    required this.serviceName,
    required this.priceAmount,
    required this.currency,
    this.clinicalSummary,
  });

  final String holdId;
  final String? appointmentId;
  final String state;
  final String bucket;
  final OwnerAppointmentPresentation presentation;
  final DateTime startsAt;
  final DateTime endsAt;
  final String clinicName;
  final String clinicAddress;
  final String? serviceName;
  final String? priceAmount;
  final String? currency;
  final String? clinicalSummary;

  factory OwnerPetCareVisit.fromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final service = json['service'] as Map<String, dynamic>;
    return OwnerPetCareVisit(
      holdId: json['holdId'] as String,
      appointmentId: json['appointmentId'] as String?,
      state: json['state'] as String,
      bucket: json['bucket'] as String,
      presentation: OwnerAppointmentPresentation.fromJson(
        json['presentation'],
        bucket: json['bucket'] as String,
      ),
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      clinicName: clinic['name'] as String,
      clinicAddress: clinic['address'] as String,
      serviceName: service['name'] as String?,
      priceAmount: service['priceAmount'] as String?,
      currency: service['currency'] as String?,
      clinicalSummary: json['clinicalSummary'] as String?,
    );
  }
}

class OwnerPetCareTelemedSession {
  const OwnerPetCareTelemedSession({
    required this.sessionId,
    required this.bookingHoldId,
    required this.state,
    required this.bucket,
    required this.startsAt,
    required this.endsAt,
    required this.doctorJoinDeadlineAt,
    required this.clinicName,
    required this.clinicAddress,
    required this.serviceName,
  });

  final String sessionId;
  final String bookingHoldId;
  final String state;
  final String bucket;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime doctorJoinDeadlineAt;
  final String clinicName;
  final String clinicAddress;
  final String? serviceName;

  factory OwnerPetCareTelemedSession.fromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final service = json['service'] as Map<String, dynamic>;
    return OwnerPetCareTelemedSession(
      sessionId: json['sessionId'] as String,
      bookingHoldId: json['bookingHoldId'] as String,
      state: json['state'] as String,
      bucket: json['bucket'] as String,
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      doctorJoinDeadlineAt:
          DateTime.parse(json['doctorJoinDeadlineAt'] as String).toLocal(),
      clinicName: clinic['name'] as String,
      clinicAddress: clinic['address'] as String,
      serviceName: service['name'] as String?,
    );
  }
}

class OwnerPetDocumentUpload {
  const OwnerPetDocumentUpload({
    required this.documentId,
    required this.petId,
    required this.fileUrl,
    required this.docType,
    required this.status,
    required this.createdAt,
  });

  final String documentId;
  final String petId;
  final String fileUrl;
  final String docType;
  final String status;
  final DateTime createdAt;

  factory OwnerPetDocumentUpload.fromJson(Map<String, dynamic> json) {
    return OwnerPetDocumentUpload(
      documentId: json['documentId'] as String,
      petId: json['petId'] as String,
      fileUrl: json['fileUrl'] as String,
      docType: json['docType'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    );
  }
}

abstract class OwnerPetCareRepository {
  Future<OwnerPetCareSummary> readSummary(String petId);
  Future<OwnerPetDocumentUpload> uploadDocumentFile({
    required String petId,
    required OwnerPickedPetFile file,
    required String docType,
  });
  Future<void> deleteDocument({
    required String petId,
    required String documentId,
  });
}

class HttpOwnerPetCareRepository implements OwnerPetCareRepository {
  HttpOwnerPetCareRepository({
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
  Future<OwnerPetCareSummary> readSummary(String petId) async {
    final token = await _accessTokenProvider();
    final response = await _client.get(
      _baseUrl.resolve('/v1/owner/pets/$petId/care-summary'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw OwnerPetCareApiException(response.statusCode, _errorCode(payload));
    }
    return OwnerPetCareSummary.fromJson(payload);
  }

  @override
  Future<OwnerPetDocumentUpload> uploadDocumentFile({
    required String petId,
    required OwnerPickedPetFile file,
    required String docType,
  }) async {
    final validation = ownerPetUploadValidationError(file, allowPdf: true);
    if (validation != null) {
      throw const OwnerPetCareApiException(400, 'INVALID_OWNER_PET_DOCUMENT');
    }
    final token = await _accessTokenProvider();
    final request = http.MultipartRequest(
      'POST',
      _baseUrl.resolve('/v1/owner/pets/$petId/documents'),
    )
      ..headers.addAll({
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      })
      ..fields['docType'] = docType
      ..files.add(http.MultipartFile.fromBytes(
        'file',
        file.bytes,
        filename: file.name,
        contentType: _mediaType(file.mimeType),
      ));
    final response =
        await http.Response.fromStream(await _client.send(request));
    final payload = _decode(response);
    if (response.statusCode != 201 || payload is! Map<String, dynamic>) {
      throw OwnerPetCareApiException(response.statusCode, _errorCode(payload));
    }
    return OwnerPetDocumentUpload.fromJson(payload);
  }

  @override
  Future<void> deleteDocument({
    required String petId,
    required String documentId,
  }) async {
    final token = await _accessTokenProvider();
    final response = await _client.delete(
      _baseUrl.resolve('/v1/owner/pets/$petId/documents/$documentId'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw OwnerPetCareApiException(
          response.statusCode, _errorCode(_decode(response)));
    }
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

MediaType _mediaType(String value) {
  final parts = value.split('/');
  if (parts.length != 2 ||
      parts.any((part) => part.trim().isEmpty || part.contains(';'))) {
    return MediaType('application', 'octet-stream');
  }
  return MediaType(parts[0], parts[1]);
}

class OwnerPetCareApiException implements Exception {
  const OwnerPetCareApiException(this.statusCode, this.code);

  final int statusCode;
  final String code;
}

OwnerPet _pet(Map<String, dynamic> json) {
  return OwnerPet(
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
