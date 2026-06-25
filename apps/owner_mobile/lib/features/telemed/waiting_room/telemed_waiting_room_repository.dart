import 'dart:convert';

import 'package:http/http.dart' as http;

import 'telemed_waiting_room_bloc.dart';

class HttpTelemedWaitingRepository implements TelemedWaitingRepository {
  HttpTelemedWaitingRepository({
    required this.baseUrl,
    required this.accessTokenProvider,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final Future<String> Function() accessTokenProvider;
  final http.Client _client;

  @override
  Future<TelemedWaitingSnapshot> readSession(String sessionId) async {
    final token = await accessTokenProvider();
    final response = await _client.get(
      baseUrl.resolve('/v1/telemed/sessions/$sessionId'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    if (response.statusCode != 200) {
      throw StateError('Unable to read telemedicine waiting room state.');
    }
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return TelemedWaitingSnapshot(
      sessionId: payload['sessionId'] as String,
      state: _state(payload['state'] as String),
      doctorJoinDeadlineAt: DateTime.parse(payload['doctorJoinDeadlineAt'] as String),
      serverNow: DateTime.parse(payload['serverNow'] as String),
      version: payload['version'] as int,
    );
  }

  TelemedWaitingStateKind _state(String value) {
    return switch (value) {
      'WAITING_FOR_DOCTOR' => TelemedWaitingStateKind.waitingForDoctor,
      'CONNECTED' => TelemedWaitingStateKind.connected,
      'DOCTOR_TIMEOUT' => TelemedWaitingStateKind.doctorTimeout,
      'COMPLETED' => TelemedWaitingStateKind.completed,
      _ => throw StateError('Unknown telemedicine state.'),
    };
  }
}
