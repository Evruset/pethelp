import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

class AlternativeSlotSnapshot {
  const AlternativeSlotSnapshot({
    required this.holdId,
    required this.sourceSlotId,
    required this.alternativeSlotId,
    required this.expiresAt,
    required this.serverNow,
    required this.version,
  });

  final String holdId;
  final String sourceSlotId;
  final String alternativeSlotId;
  final DateTime expiresAt;
  final DateTime serverNow;
  final int version;
}

class AlternativeSlotAccepted {
  const AlternativeSlotAccepted({required this.holdId, required this.slotId});

  final String holdId;
  final String slotId;
}

sealed class AlternativeSlotResult<T> {
  const AlternativeSlotResult();
}

class AlternativeSlotSuccess<T> extends AlternativeSlotResult<T> {
  const AlternativeSlotSuccess(this.value);
  final T value;
}

class AlternativeSlotRetry<T> extends AlternativeSlotResult<T> {
  const AlternativeSlotRetry();
}

class AlternativeSlotFenced<T> extends AlternativeSlotResult<T> {
  const AlternativeSlotFenced(this.reason);
  final String reason;
}

class AlternativeSlotFailure<T> extends AlternativeSlotResult<T> {
  const AlternativeSlotFailure(this.message);
  final String message;
}

class AlternativeSlotRepository {
  AlternativeSlotRepository({
    required this.baseUrl,
    required this.accessTokenProvider,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final Future<String> Function() accessTokenProvider;
  final http.Client _client;
  final Uuid _uuid = const Uuid();

  Future<AlternativeSlotResult<AlternativeSlotSnapshot>> readSnapshot(String holdId) async {
    final token = await accessTokenProvider();
    final response = await _client.get(
      baseUrl.resolve('/v1/booking-holds/$holdId'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    final payload = _json(response);
    if (response.statusCode == 200) {
      return AlternativeSlotSuccess(_snapshot(payload));
    }
    if (response.statusCode == 401) return const AlternativeSlotFenced('UNAUTHENTICATED');
    if (response.statusCode == 403) return const AlternativeSlotFenced('FORBIDDEN');
    if (response.statusCode == 422) return AlternativeSlotFenced(_code(payload));
    return const AlternativeSlotFailure('Не удалось получить состояние предложения.');
  }

  Future<AlternativeSlotResult<AlternativeSlotAccepted>> acceptAlternative({
    required String holdId,
    required String correlationId,
    String? idempotencyKey,
  }) async {
    final token = await accessTokenProvider();
    final response = await _client.post(
      baseUrl.resolve('/v1/booking-holds/$holdId/alternative-slot/accept'),
      headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
        'Idempotency-Key': idempotencyKey ?? _uuid.v4(),
        'X-Correlation-ID': correlationId,
      },
    );
    final payload = _json(response);
    if (response.statusCode == 200) {
      return AlternativeSlotSuccess(AlternativeSlotAccepted(
        holdId: payload['holdId'] as String,
        slotId: payload['slotId'] as String,
      ));
    }
    final code = _code(payload);
    if (response.statusCode == 409 && code == 'SLOT_LOCKED_RETRY') return const AlternativeSlotRetry();
    if (response.statusCode == 409 || response.statusCode == 422) return AlternativeSlotFenced(code);
    if (response.statusCode == 401 || response.statusCode == 403) return AlternativeSlotFenced(code);
    return const AlternativeSlotFailure('Не удалось принять другое время.');
  }

  AlternativeSlotSnapshot _snapshot(Map<String, dynamic> payload) {
    return AlternativeSlotSnapshot(
      holdId: payload['id'] as String,
      sourceSlotId: payload['slot_id'] as String,
      alternativeSlotId: payload['alternative_slot_id'] as String,
      expiresAt: DateTime.parse(payload['alternative_expires_at'] as String),
      serverNow: DateTime.now().toUtc(),
      version: payload['version'] as int,
    );
  }

  Map<String, dynamic> _json(http.Response response) {
    if (response.body.isEmpty) return <String, dynamic>{};
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  String _code(Map<String, dynamic> payload) => payload['code'] as String? ?? 'UNKNOWN';
}
