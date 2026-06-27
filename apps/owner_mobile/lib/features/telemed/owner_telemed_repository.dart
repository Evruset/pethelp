import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

class OwnerTelemedSession {
  const OwnerTelemedSession({
    required this.sessionId,
    required this.bookingHoldId,
    required this.telemedCaseId,
    required this.state,
    required this.telemedCaseState,
    required this.paymentStatus,
    required this.refundState,
    required this.recommendationText,
    required this.followUpNotes,
    required this.safetyEscalation,
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
  final String? bookingHoldId;
  final String? telemedCaseId;
  final String state;
  final String? telemedCaseState;
  final String? paymentStatus;
  final String? refundState;
  final String? recommendationText;
  final String? followUpNotes;
  final bool? safetyEscalation;
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
      bookingHoldId: json['bookingHoldId'] as String?,
      telemedCaseId: json['telemedCaseId'] as String?,
      state: json['state'] as String,
      telemedCaseState: json['telemedCaseState'] as String?,
      paymentStatus: json['paymentStatus'] as String?,
      refundState: json['refundState'] as String?,
      recommendationText: json['recommendationText'] as String?,
      followUpNotes: json['followUpNotes'] as String?,
      safetyEscalation: json['safetyEscalation'] as bool?,
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

class TelemedPet {
  const TelemedPet({
    required this.id,
    required this.name,
    required this.species,
  });

  final String id;
  final String name;
  final String species;

  factory TelemedPet.fromJson(Map<String, dynamic> json) {
    return TelemedPet(
      id: json['id'] as String,
      name: json['name'] as String,
      species: json['species'] as String,
    );
  }
}

class TelemedIntakeInput {
  const TelemedIntakeInput({
    required this.petId,
    required this.category,
    required this.symptomDuration,
    required this.priorClinicVisit,
    required this.emergencyRedFlags,
    required this.consentVersion,
    this.expectedServiceLevel = 'STANDARD',
  });

  final String petId;
  final String category;
  final String symptomDuration;
  final bool priorClinicVisit;
  final List<String> emergencyRedFlags;
  final String consentVersion;
  final String expectedServiceLevel;

  Map<String, Object> toJson() => <String, Object>{
        'petId': petId,
        'category': category,
        'symptomDuration': symptomDuration,
        'priorClinicVisit': priorClinicVisit,
        'emergencyRedFlags': emergencyRedFlags,
        'consentVersion': consentVersion,
        'expectedServiceLevel': expectedServiceLevel,
      };
}

class TelemedIntakeResult {
  const TelemedIntakeResult({
    required this.intakeId,
    required this.outcome,
    required this.routingTarget,
    required this.nextStep,
    required this.guardrails,
    required this.createdAt,
  });

  final String intakeId;
  final String outcome;
  final String routingTarget;
  final String nextStep;
  final List<String> guardrails;
  final DateTime createdAt;

  factory TelemedIntakeResult.fromJson(Map<String, dynamic> json) {
    return TelemedIntakeResult(
      intakeId: json['intakeId'] as String,
      outcome: json['outcome'] as String,
      routingTarget: json['routingTarget'] as String,
      nextStep: json['nextStep'] as String,
      guardrails: (json['guardrails'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<String>()
          .toList(growable: false),
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    );
  }
}

class TelemedPaymentIntent {
  const TelemedPaymentIntent({
    required this.caseId,
    required this.intakeId,
    required this.paymentIntentId,
    required this.paymentFenceToken,
    required this.refundPolicyVersion,
    required this.amount,
    required this.currency,
    required this.status,
    required this.idempotencyKey,
    required this.checkoutUrl,
  });

  final String caseId;
  final String intakeId;
  final String paymentIntentId;
  final String paymentFenceToken;
  final String refundPolicyVersion;
  final String amount;
  final String currency;
  final String status;
  final String idempotencyKey;
  final String? checkoutUrl;

  factory TelemedPaymentIntent.fromJson(Map<String, dynamic> json) {
    return TelemedPaymentIntent(
      caseId: json['caseId'] as String,
      intakeId: json['intakeId'] as String,
      paymentIntentId: json['paymentIntentId'] as String,
      paymentFenceToken: json['paymentFenceToken'] as String,
      refundPolicyVersion: json['refundPolicyVersion'] as String,
      amount: json['amount'] as String,
      currency: json['currency'] as String,
      status: json['status'] as String,
      idempotencyKey: json['idempotencyKey'] as String,
      checkoutUrl: json['checkoutUrl'] as String?,
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
  Future<List<TelemedPet>> listPets();
  Future<TelemedIntakeResult> createIntake(TelemedIntakeInput input);
  Future<TelemedPaymentIntent> createPaymentIntent(String intakeId);
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
  final Uuid _uuid = const Uuid();

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

  @override
  Future<List<TelemedPet>> listPets() async {
    final token = await _accessTokenProvider();
    final response = await _client.get(
      _baseUrl.resolve('/v1/owner/pets'),
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
        .map(TelemedPet.fromJson)
        .toList(growable: false);
  }

  @override
  Future<TelemedIntakeResult> createIntake(TelemedIntakeInput input) async {
    final token = await _accessTokenProvider();
    final response = await _client.post(
      _baseUrl.resolve('/v1/telemed/intakes'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(input.toJson()),
    );
    final payload = _decode(response);
    if (response.statusCode != 201 || payload is! Map<String, dynamic>) {
      throw OwnerTelemedApiException(
        response.statusCode,
        _errorCode(payload),
      );
    }
    return TelemedIntakeResult.fromJson(payload);
  }

  @override
  Future<TelemedPaymentIntent> createPaymentIntent(String intakeId) async {
    final token = await _accessTokenProvider();
    final response = await _client.post(
      _baseUrl.resolve('/v1/telemed/intakes/$intakeId/payment-intents'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
        'Idempotency-Key': _uuid.v4(),
      },
    );
    final payload = _decode(response);
    if (response.statusCode != 201 || payload is! Map<String, dynamic>) {
      throw OwnerTelemedApiException(
        response.statusCode,
        _errorCode(payload),
      );
    }
    return TelemedPaymentIntent.fromJson(payload);
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
