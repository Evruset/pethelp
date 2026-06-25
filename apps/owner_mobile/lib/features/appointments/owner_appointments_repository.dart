import 'dart:convert';

import 'package:http/http.dart' as http;

import '../booking/marketplace/booking_marketplace_repository.dart';

class OwnerAppointment {
  const OwnerAppointment({
    required this.holdId,
    required this.appointmentId,
    required this.state,
    required this.startsAt,
    required this.endsAt,
    required this.clinicName,
    required this.clinicAddress,
    required this.petName,
  });

  final String holdId;
  final String? appointmentId;
  final String state;
  final DateTime startsAt;
  final DateTime endsAt;
  final String clinicName;
  final String clinicAddress;
  final String petName;

  factory OwnerAppointment.fromJson(Map<String, dynamic> json) {
    final clinic = json['clinic'] as Map<String, dynamic>;
    final pet = json['pet'] as Map<String, dynamic>;
    return OwnerAppointment(
      holdId: json['holdId'] as String,
      appointmentId: json['appointmentId'] as String?,
      state: json['state'] as String,
      startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
      endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
      clinicName: clinic['name'] as String,
      clinicAddress: clinic['address'] as String,
      petName: pet['name'] as String,
    );
  }
}

class OwnerAppointmentsApiException implements Exception {
  const OwnerAppointmentsApiException(this.statusCode, this.code);
  final int statusCode;
  final String code;
}

abstract class OwnerAppointmentsRepository {
  Future<List<OwnerAppointment>> list();
  Future<BookingHoldSnapshot> readHold(String holdId);
}

class HttpOwnerAppointmentsRepository implements OwnerAppointmentsRepository {
  HttpOwnerAppointmentsRepository({
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
  Future<List<OwnerAppointment>> list() async {
    final response = await _client.get(
      _baseUrl.resolve('v1/owner/appointments'),
      headers: await _headers(),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! List) {
      throw OwnerAppointmentsApiException(response.statusCode, _errorCode(data));
    }
    return data.whereType<Map<String, dynamic>>().map(OwnerAppointment.fromJson).toList(growable: false);
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) async {
    final response = await _client.get(
      _baseUrl.resolve('v1/booking-holds/$holdId'),
      headers: await _headers(),
    );
    final data = _decode(response);
    if (response.statusCode != 200 || data is! Map<String, dynamic>) {
      throw OwnerAppointmentsApiException(response.statusCode, _errorCode(data));
    }
    return BookingHoldSnapshot.fromJson(data);
  }

  Future<Map<String, String>> _headers() async {
    final token = await _accessToken();
    return {'Accept': 'application/json', 'Authorization': 'Bearer $token'};
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return null;
    }
  }

  String _errorCode(dynamic data) => data is Map<String, dynamic> && data['code'] is String
      ? data['code'] as String
      : 'BACKEND_UNAVAILABLE';
}
