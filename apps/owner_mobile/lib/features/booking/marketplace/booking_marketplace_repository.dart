import 'dart:convert';

import 'package:http/http.dart' as http;

class BookingSlot {
  const BookingSlot({
    required this.id,
    required this.clinicLocationId,
    required this.serviceId,
    required this.serviceName,
    required this.startsAt,
    required this.endsAt,
    required this.remainingCapacity,
  });

  final String id;
  final String clinicLocationId;
  final String? serviceId;
  final String? serviceName;
  final DateTime startsAt;
  final DateTime endsAt;
  final int remainingCapacity;

  factory BookingSlot.fromJson(Map<String, dynamic> json) {
    return BookingSlot(
      id: json['id'] as String,
      clinicLocationId: json['clinic_location_id'] as String,
      serviceId: json['service_id'] as String?,
      serviceName: json['service_name'] as String?,
      startsAt: DateTime.parse(json['starts_at'] as String).toUtc(),
      endsAt: DateTime.parse(json['ends_at'] as String).toUtc(),
      remainingCapacity: (json['remaining_capacity'] as num?)?.toInt() ?? 0,
    );
  }
}

class CreatedBookingHold {
  const CreatedBookingHold({
    required this.holdId,
    required this.state,
    required this.slotId,
    required this.expiresAt,
    required this.correlationId,
  });

  final String holdId;
  final String state;
  final String slotId;
  final DateTime expiresAt;
  final String correlationId;

  factory CreatedBookingHold.fromJson(Map<String, dynamic> json) {
    return CreatedBookingHold(
      holdId: json['holdId'] as String,
      state: json['state'] as String,
      slotId: json['slotId'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String).toUtc(),
      correlationId: json['correlationId'] as String,
    );
  }
}

class BookingHoldSnapshot {
  const BookingHoldSnapshot({
    required this.holdId,
    required this.slotId,
    required this.state,
    required this.expiresAt,
    required this.startsAt,
    required this.endsAt,
  });

  final String holdId;
  final String slotId;
  final String state;
  final DateTime expiresAt;
  final DateTime startsAt;
  final DateTime endsAt;

  factory BookingHoldSnapshot.fromJson(Map<String, dynamic> json) {
    return BookingHoldSnapshot(
      holdId: json['holdId'] as String,
      slotId: json['slotId'] as String,
      state: json['state'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String).toUtc(),
      startsAt: DateTime.parse(json['startsAt'] as String).toUtc(),
      endsAt: DateTime.parse(json['endsAt'] as String).toUtc(),
    );
  }
}

class BookingMarketplaceApiException implements Exception {
  const BookingMarketplaceApiException({
    required this.statusCode,
    required this.code,
  });

  final int statusCode;
  final String code;

  bool get retryable => statusCode == 409 && code == 'SLOT_LOCKED_RETRY';
  bool get slotUnavailable => statusCode == 409 && code == 'SLOT_ALREADY_TAKEN';
  bool get holdExpired => statusCode == 422 && code == 'HOLD_EXPIRED';

  @override
  String toString() => 'BookingMarketplaceApiException($statusCode, $code)';
}

abstract class BookingMarketplaceRepository {
  Future<List<BookingSlot>> listSlots({
    required String clinicLocationId,
    required String serviceId,
    required DateTime from,
    required DateTime to,
  });

  Future<CreatedBookingHold> createHold({
    required String slotId,
    required String petId,
    required String correlationId,
    required String idempotencyKey,
  });

  Future<BookingHoldSnapshot> readHold(String holdId);
}

class HttpBookingMarketplaceRepository implements BookingMarketplaceRepository {
  HttpBookingMarketplaceRepository({
    required Uri baseUrl,
    required Future<String> Function() accessTokenProvider,
    http.Client? client,
  })  : _baseUrl = baseUrl,
        _accessTokenProvider = accessTokenProvider,
        _client = client ?? http.Client();

  final Uri _baseUrl;
  final Future<String> Function() _accessTokenProvider;
  final http.Client _client;

  Uri _uri(String path, [Map<String, String>? queryParameters]) {
    return _baseUrl.resolve(path).replace(queryParameters: queryParameters);
  }

  @override
  Future<List<BookingSlot>> listSlots({
    required String clinicLocationId,
    required String serviceId,
    required DateTime from,
    required DateTime to,
  }) async {
    final response = await _client.get(
      _uri(
        'v1/clinic-locations/$clinicLocationId/slots',
        <String, String>{
          'from': from.toUtc().toIso8601String(),
          'to': to.toUtc().toIso8601String(),
          'serviceId': serviceId,
        },
      ),
      headers: const <String, String>{'Accept': 'application/json'},
    );
    final payload = _decode(response);
    if (response.statusCode != 200) {
      throw _apiException(response.statusCode, payload);
    }
    if (payload is! List) {
      throw const BookingMarketplaceApiException(
        statusCode: 503,
        code: 'BACKEND_UNAVAILABLE',
      );
    }
    return payload
        .whereType<Map<String, dynamic>>()
        .map(BookingSlot.fromJson)
        .where((slot) => slot.remainingCapacity > 0)
        .toList(growable: false);
  }

  @override
  Future<CreatedBookingHold> createHold({
    required String slotId,
    required String petId,
    required String correlationId,
    required String idempotencyKey,
  }) async {
    final token = await _accessTokenProvider();
    final response = await _client.post(
      _uri('v1/booking-holds'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId,
      },
      body: jsonEncode(<String, String>{'slotId': slotId, 'petId': petId}),
    );
    final payload = _decode(response);
    if (response.statusCode != 201 || payload is! Map<String, dynamic>) {
      throw _apiException(response.statusCode, payload);
    }
    return CreatedBookingHold.fromJson(payload);
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    final token = await _accessTokenProvider();
    final response = await _client.get(
      _uri('v1/booking-holds/$holdId'),
      headers: <String, String>{
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    final payload = _decode(response);
    if (response.statusCode != 200 || payload is! Map<String, dynamic>) {
      throw _apiException(response.statusCode, payload);
    }
    return BookingHoldSnapshot.fromJson(payload);
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return null;
    }
  }

  BookingMarketplaceApiException _apiException(
      int statusCode, dynamic payload) {
    final code = payload is Map<String, dynamic> && payload['code'] is String
        ? payload['code'] as String
        : 'BACKEND_UNAVAILABLE';
    return BookingMarketplaceApiException(statusCode: statusCode, code: code);
  }
}
