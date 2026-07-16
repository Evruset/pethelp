import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

enum OwnerBookingBucket { requiresAction, active, history }

enum OwnerBookingCancelAction { releaseHold, requestCancellation }

class OwnerBookingCardV50 {
  const OwnerBookingCardV50(
      {required this.id,
      required this.petId,
      required this.petName,
      required this.clinicName,
      required this.statusLabel,
      required this.startsAt,
      required this.bucket});
  final String id, petId, petName, clinicName, statusLabel;
  final DateTime startsAt;
  final OwnerBookingBucket bucket;
  factory OwnerBookingCardV50.fromJson(
      Map<String, dynamic> json, OwnerBookingBucket bucket) {
    final pet = (json['pet'] as Map?)?.cast<String, dynamic>() ?? const {};
    final clinic =
        (json['clinic'] as Map?)?.cast<String, dynamic>() ?? const {};
    final presentation =
        (json['presentation'] as Map?)?.cast<String, dynamic>() ?? const {};
    return OwnerBookingCardV50(
        id: (json['bookingId'] ?? json['holdId']) as String,
        petId: (pet['id'] ?? '') as String,
        petName: (pet['name'] ?? '') as String,
        clinicName: (clinic['name'] ?? '') as String,
        statusLabel:
            (json['statusLabel'] ?? presentation['label'] ?? '') as String,
        startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
        bucket: bucket);
  }
}

class OwnerBookingsPageV50 {
  const OwnerBookingsPageV50(
      {required this.serverNow,
      required this.requiresAction,
      required this.active,
      required this.history,
      this.nextCursor});
  final DateTime serverNow;
  final List<OwnerBookingCardV50> requiresAction, active, history;
  final String? nextCursor;
  Iterable<OwnerBookingCardV50> get all =>
      [...requiresAction, ...active, ...history];
  factory OwnerBookingsPageV50.fromJson(Map<String, dynamic> json) {
    List<OwnerBookingCardV50> rows(String key, OwnerBookingBucket bucket) =>
        (json[key] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map((v) => OwnerBookingCardV50.fromJson(v, bucket))
            .toList(growable: false);
    return OwnerBookingsPageV50(
        serverNow: DateTime.parse(json['serverNow'] as String).toLocal(),
        requiresAction:
            rows('requiresAction', OwnerBookingBucket.requiresAction),
        active: rows('active', OwnerBookingBucket.active),
        history: rows('history', OwnerBookingBucket.history),
        nextCursor: json['nextCursor'] as String?);
  }
}

class OwnerBookingTimelineV50 {
  const OwnerBookingTimelineV50(
      {required this.code,
      required this.title,
      required this.description,
      required this.occurredAt,
      required this.isCurrent});
  final String code, title, description;
  final DateTime occurredAt;
  final bool isCurrent;
  factory OwnerBookingTimelineV50.fromJson(Map<String, dynamic> j) =>
      OwnerBookingTimelineV50(
          code: (j['code'] ?? j['type']) as String,
          title: (j['title'] ?? j['label']) as String,
          description: j['description'] as String? ?? '',
          occurredAt:
              DateTime.parse((j['occurredAt'] ?? j['at']) as String).toLocal(),
          isCurrent: j['isCurrent'] == true);
}

class OwnerBookingDetailV50 {
  const OwnerBookingDetailV50(
      {required this.id,
      required this.petName,
      required this.clinicName,
      required this.statusLabel,
      required this.startsAt,
      required this.bucket,
      required this.aggregateVersion,
      required this.canCancel,
      required this.canReviewAlternative,
      required this.cancelAction,
      required this.cancellationReason,
      required this.timeline,
      required this.serverNow});
  final String id, petName, clinicName, statusLabel, cancellationReason;
  final DateTime startsAt, serverNow;
  final OwnerBookingBucket bucket;
  final int aggregateVersion;
  final bool canCancel;
  final bool canReviewAlternative;
  final OwnerBookingCancelAction? cancelAction;
  final List<OwnerBookingTimelineV50> timeline;
  factory OwnerBookingDetailV50.fromJson(Map<String, dynamic> j) {
    final eligibility = (j['cancellation'] as Map?)?.cast<String, dynamic>() ??
        (j['cancellationEligibility'] as Map?)?.cast<String, dynamic>() ??
        (j['actions'] as Map?)?.cast<String, dynamic>() ??
        const {};
    final actions = (j['actions'] as Map?)?.cast<String, dynamic>() ?? const {};
    final rawAction = eligibility['action'] ??
        eligibility['command'] ??
        eligibility['cancellationPolicyCode'];
    return OwnerBookingDetailV50(
        id: (j['bookingId'] ?? j['holdId']) as String,
        petName: ((j['pet'] as Map)['name']) as String,
        clinicName: ((j['clinic'] as Map)['name']) as String,
        statusLabel: (j['statusLabel'] ??
            (j['presentation'] as Map?)?['label'] ??
            '') as String,
        startsAt: DateTime.parse(j['startsAt'] as String).toLocal(),
        bucket: _bucket(j['bucket'] as String),
        aggregateVersion:
            ((j['aggregateVersion'] ?? j['version']) as num).toInt(),
        canCancel: eligibility['canCancel'] == true,
        canReviewAlternative: actions['canReviewAlternative'] == true,
        cancelAction:
            rawAction == 'RELEASE_HOLD' || rawAction == 'ACTIVE_HOLD_RELEASE_V1'
                ? OwnerBookingCancelAction.releaseHold
                : rawAction == 'REQUEST_CANCELLATION' ||
                        rawAction == 'CLINIC_CONFIRMATION_REQUIRED_V1'
                    ? OwnerBookingCancelAction.requestCancellation
                    : null,
        cancellationReason: (eligibility['safeReason'] ??
            eligibility['reason'] ??
            '') as String,
        timeline: (j['timeline'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(OwnerBookingTimelineV50.fromJson)
            .toList(growable: false),
        serverNow: DateTime.parse(j['serverNow'] as String).toLocal());
  }
}

OwnerBookingBucket _bucket(String value) => switch (value) {
      'REQUIRES_ACTION' => OwnerBookingBucket.requiresAction,
      'ACTIVE' => OwnerBookingBucket.active,
      _ => OwnerBookingBucket.history
    };

class OwnerBookingCancelResultV50 {
  const OwnerBookingCancelResultV50(
      {required this.state, required this.pending});
  final String state;
  final bool pending;
}

class OwnerBookingsV50Exception implements Exception {
  const OwnerBookingsV50Exception(this.statusCode, this.code);
  final int statusCode;
  final String code;
}

abstract class OwnerBookingsV50Repository {
  Future<OwnerBookingsPageV50> list({String? cursor, String? petId});
  Future<OwnerBookingDetailV50> detail(String id);
  Future<OwnerBookingCancelResultV50> cancel(OwnerBookingDetailV50 detail,
      {required String operationKey, required String correlationId});
}

class HttpOwnerBookingsV50Repository implements OwnerBookingsV50Repository {
  HttpOwnerBookingsV50Repository(
      {required Uri baseUrl,
      required Future<String> Function() accessToken,
      http.Client? client})
      : _baseUrl = baseUrl,
        _accessToken = accessToken,
        _client = client ?? http.Client();
  final Uri _baseUrl;
  final Future<String> Function() _accessToken;
  final http.Client _client;
  static const uuid = Uuid();
  Future<Map<String, String>> _headers(
          {String? key, String? correlation, int? version}) async =>
      {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${await _accessToken()}',
        if (key != null) 'Idempotency-Key': key,
        if (correlation != null) 'X-Correlation-ID': correlation,
        if (version != null) 'If-Match': '"$version"'
      };
  dynamic _decode(http.Response r) {
    try {
      return jsonDecode(r.body);
    } catch (_) {
      return null;
    }
  }

  Never _fail(http.Response r, dynamic body) => throw OwnerBookingsV50Exception(
      r.statusCode,
      body is Map && body['code'] is String
          ? body['code'] as String
          : 'BACKEND_UNAVAILABLE');
  @override
  Future<OwnerBookingsPageV50> list({String? cursor, String? petId}) async {
    final uri = _baseUrl.resolve('v1/owner/bookings').replace(queryParameters: {
      if (cursor != null) 'cursor': cursor,
      if (petId != null) 'petId': petId
    });
    final r = await _client.get(uri, headers: await _headers());
    final b = _decode(r);
    if (r.statusCode != 200 || b is! Map<String, dynamic>) _fail(r, b);
    return OwnerBookingsPageV50.fromJson(b);
  }

  @override
  Future<OwnerBookingDetailV50> detail(String id) async {
    final r = await _client.get(_baseUrl.resolve('v1/owner/bookings/$id'),
        headers: await _headers());
    final b = _decode(r);
    if (r.statusCode != 200 || b is! Map<String, dynamic>) _fail(r, b);
    return OwnerBookingDetailV50.fromJson(b);
  }

  @override
  Future<OwnerBookingCancelResultV50> cancel(OwnerBookingDetailV50 d,
      {required String operationKey, required String correlationId}) async {
    if (!d.canCancel || d.cancelAction == null) {
      throw const OwnerBookingsV50Exception(409, 'BOOKING_CANCEL_DENIED');
    }
    final path = 'v1/owner/bookings/${d.id}/cancel';
    final r = await _client.post(_baseUrl.resolve(path),
        headers: await _headers(
            key: operationKey,
            correlation: correlationId,
            version: d.aggregateVersion));
    final b = _decode(r);
    if (r.statusCode < 200 ||
        r.statusCode >= 300 ||
        b is! Map<String, dynamic>) {
      _fail(r, b);
    }
    final state = b['state'] as String;
    return OwnerBookingCancelResultV50(
        state: state, pending: state == 'CANCELLATION_REQUESTED');
  }
}
