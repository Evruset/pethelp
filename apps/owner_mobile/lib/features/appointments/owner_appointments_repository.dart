import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../booking/marketplace/booking_marketplace_repository.dart';

class OwnerAppointmentPresentation {
  const OwnerAppointmentPresentation({required this.code, required this.label, required this.description, required this.tone});
  final String code;
  final String label;
  final String description;
  final String tone;

  factory OwnerAppointmentPresentation.fromJson(dynamic json, {required String bucket}) {
    if (json is Map<String, dynamic> && json['code'] is String && json['label'] is String && json['description'] is String && json['tone'] is String) {
      return OwnerAppointmentPresentation(
        code: json['code'] as String,
        label: json['label'] as String,
        description: json['description'] as String,
        tone: json['tone'] as String,
      );
    }
    return bucket == 'HISTORY'
        ? const OwnerAppointmentPresentation(code: 'HISTORY_RECORDED', label: 'Запись сохранена в истории', description: 'Обновите приложение, чтобы увидеть подробный статус.', tone: 'neutral')
        : const OwnerAppointmentPresentation(code: 'STATUS_SYNCING', label: 'Проверяем статус', description: 'VetHelp получает актуальные данные от клиники.', tone: 'info');
  }
}

class OwnerAppointment {
  const OwnerAppointment({required this.holdId, required this.appointmentId, required this.state, required this.bucket, required this.presentation, required this.startsAt, required this.endsAt, required this.clinicName, required this.clinicAddress, required this.petName});
  final String holdId;
  final String? appointmentId;
  final String state;
  final String bucket;
  final OwnerAppointmentPresentation presentation;
  final DateTime startsAt;
  final DateTime endsAt;
  final String clinicName;
  final String clinicAddress;
  final String petName;

  factory OwnerAppointment.fromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final pet = json['pet'] as Map<String, dynamic>;
    final bucket = json['bucket'] as String? ?? 'HISTORY';
    return OwnerAppointment(
      holdId: json['holdId'] as String,
      appointmentId: json['appointmentId'] as String?,
      state: json['state'] as String,
      bucket: bucket,
      presentation: OwnerAppointmentPresentation.fromJson(json['presentation'], bucket: bucket),
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      clinicName: clinic['name'] as String,
      clinicAddress: clinic['address'] as String,
      petName: pet['name'] as String,
    );
  }
}

class OwnerAppointmentDetail {
  const OwnerAppointmentDetail({required this.holdId, required this.appointmentId, required this.state, required this.bucket, required this.presentation, required this.version, required this.startsAt, required this.endsAt, required this.expiresAt, required this.latestStatusUpdateAt, required this.serverNow, required this.clinicName, required this.clinicAddress, required this.locationPhone, required this.petName, required this.petSpecies, required this.serviceName, required this.priceAmount, required this.currency, required this.timeline, required this.actions});
  final String holdId;
  final String? appointmentId;
  final String state;
  final String bucket;
  final OwnerAppointmentPresentation presentation;
  final int version;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime expiresAt;
  final DateTime latestStatusUpdateAt;
  final DateTime serverNow;
  final String clinicName;
  final String clinicAddress;
  final String? locationPhone;
  final String petName;
  final String petSpecies;
  final String? serviceName;
  final String? priceAmount;
  final String? currency;
  final List<OwnerAppointmentTimelineItem> timeline;
  final OwnerAppointmentActions actions;

  factory OwnerAppointmentDetail.fromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final location = json['location'] as Map<String, dynamic>;
    final pet = json['pet'] as Map<String, dynamic>;
    final service = json['service'] as Map<String, dynamic>;
    final bucket = json['bucket'] as String? ?? 'HISTORY';
    return OwnerAppointmentDetail(
      holdId: json['holdId'] as String,
      appointmentId: json['appointmentId'] as String?,
      state: json['state'] as String,
      bucket: bucket,
      presentation: OwnerAppointmentPresentation.fromJson(json['presentation'], bucket: bucket),
      version: (json['version'] as num).toInt(),
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      expiresAt: DateTime.parse(json['expiresAt'] as String).toLocal(),
      latestStatusUpdateAt: DateTime.parse(json['latestStatusUpdateAt'] as String).toLocal(),
      serverNow: DateTime.parse(json['serverNow'] as String).toLocal(),
      clinicName: clinic['name'] as String,
      clinicAddress: location['address'] as String,
      locationPhone: location['phone'] as String?,
      petName: pet['name'] as String,
      petSpecies: pet['species'] as String,
      serviceName: service['name'] as String?,
      priceAmount: service['priceAmount'] as String?,
      currency: service['currency'] as String?,
      timeline: (json['timeline'] as List<dynamic>? ?? const <dynamic>[]).whereType<Map<String, dynamic>>().map(OwnerAppointmentTimelineItem.fromJson).toList(growable: false),
      actions: OwnerAppointmentActions.fromJson(json['actions'] as Map<String, dynamic>),
    );
  }
}

class OwnerAppointmentTimelineItem {
  const OwnerAppointmentTimelineItem({required this.at, required this.type, required this.label});
  final DateTime at;
  final String type;
  final String label;
  factory OwnerAppointmentTimelineItem.fromJson(Map<String, dynamic> json) => OwnerAppointmentTimelineItem(at: DateTime.parse(json['at'] as String).toLocal(), type: json['type'] as String, label: json['label'] as String);
}

class OwnerAppointmentActions {
  const OwnerAppointmentActions({required this.canRefresh, required this.canRebook, required this.canOpenRoute, required this.canReviewAlternative, required this.canCancel});
  final bool canRefresh;
  final bool canRebook;
  final bool canOpenRoute;
  final bool canReviewAlternative;
  final bool canCancel;
  factory OwnerAppointmentActions.fromJson(Map<String, dynamic> json) => OwnerAppointmentActions(canRefresh: json['canRefresh'] == true, canRebook: json['canRebook'] == true, canOpenRoute: json['canOpenRoute'] == true, canReviewAlternative: json['canReviewAlternative'] == true, canCancel: json['canCancel'] == true);
}

class OwnerAppointmentsApiException implements Exception {
  const OwnerAppointmentsApiException(this.statusCode, this.code);
  final int statusCode;
  final String code;
}

class ReleasedBookingHold {
  const ReleasedBookingHold({required this.holdId, required this.state, required this.slotId, required this.correlationId});
  final String holdId;
  final String state;
  final String slotId;
  final String correlationId;
  factory ReleasedBookingHold.fromJson(Map<String, dynamic> json) => ReleasedBookingHold(holdId: json['holdId'] as String, state: json['state'] as String, slotId: json['slotId'] as String, correlationId: json['correlationId'] as String);
}

abstract class OwnerAppointmentsRepository {
  Future<List<OwnerAppointment>> list();
  Future<OwnerAppointmentDetail> readDetail(String holdId);
  Future<BookingHoldSnapshot> readHold(String holdId);
  Future<ReleasedBookingHold> releaseHold(String holdId);
}

class HttpOwnerAppointmentsRepository implements OwnerAppointmentsRepository {
  HttpOwnerAppointmentsRepository({required Uri baseUrl, required Future<String> Function() accessToken, http.Client? client}) : _baseUrl = baseUrl, _accessToken = accessToken, _client = client ?? http.Client();
  final Uri _baseUrl;
  final Future<String> Function() _accessToken;
  final http.Client _client;
  final Uuid _uuid = const Uuid();

  @override
  Future<List<OwnerAppointment>> list() async {
    final response = await _client.get(_baseUrl.resolve('v1/owner/appointments'), headers: await _headers());
    final data = _decode(response);
    if (response.statusCode != 200 || data is! List) throw OwnerAppointmentsApiException(response.statusCode, _errorCode(data));
    return data.whereType<Map<String, dynamic>>().map(OwnerAppointment.fromJson).toList(growable: false);
  }

  @override
  Future<OwnerAppointmentDetail> readDetail(String holdId) async {
    final response = await _client.get(_baseUrl.resolve('v1/owner/appointments/$holdId'), headers: await _headers());
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) throw OwnerAppointmentsApiException(response.statusCode, _errorCode(data));
    return OwnerAppointmentDetail.fromJson(data);
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    final response = await _client.get(_baseUrl.resolve('v1/booking-holds/$holdId'), headers: await _headers());
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) throw OwnerAppointmentsApiException(response.statusCode, _errorCode(data));
    return BookingHoldSnapshot.fromJson(data);
  }

  @override
  Future<ReleasedBookingHold> releaseHold(String holdId) async {
    final correlationId = _uuid.v4();
    final response = await _client.post(
      _baseUrl.resolve('v1/booking-holds/$holdId/release'),
      headers: await _headers(idempotencyKey: _uuid.v4(), correlationId: correlationId),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) throw OwnerAppointmentsApiException(response.statusCode, _errorCode(data));
    return ReleasedBookingHold.fromJson(data);
  }

  Future<Map<String, String>> _headers({String? idempotencyKey, String? correlationId}) async {
    final token = await _accessToken();
    return {'Accept': 'application/json', 'Authorization': 'Bearer $token', if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey, if (correlationId != null) 'X-Correlation-ID': correlationId};
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try { return jsonDecode(response.body); } on FormatException { return null; }
  }

  String _errorCode(dynamic data) => data is Map<String, dynamic> && data['code'] is String ? data['code'] as String : 'BACKEND_UNAVAILABLE';
}
