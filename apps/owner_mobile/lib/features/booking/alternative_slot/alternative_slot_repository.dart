import 'dart:convert';

import 'package:http/http.dart' as http;

class SlotSnapshot {
  const SlotSnapshot(
      {required this.id, required this.startsAt, required this.endsAt});
  final String id;
  final DateTime startsAt;
  final DateTime endsAt;
}

class AlternativeSlotSnapshot {
  AlternativeSlotSnapshot({
    required this.bookingId,
    required this.proposalId,
    required this.originalSlot,
    required this.alternativeSlot,
    required this.deadline,
    required this.serverNow,
    required this.aggregateVersion,
    required this.state,
    required this.canAccept,
    required this.canDecline,
    this.priceCopy,
    this.actionCode,
    required this.petId,
    required this.clinicId,
    required this.locationId,
    required this.serviceId,
    this.doctorId,
    required DateTime receivedAt,
  }) : _serverOffset = serverNow.difference(receivedAt.toUtc());

  final String bookingId;
  final String proposalId;
  final SlotSnapshot originalSlot;
  final SlotSnapshot alternativeSlot;
  final DateTime deadline;
  final DateTime serverNow;
  final int aggregateVersion;
  final String state;
  final bool canAccept;
  final bool canDecline;
  final String? priceCopy;
  final String? actionCode;
  final String petId, clinicId, locationId, serviceId;
  final String? doctorId;
  final Duration _serverOffset;

  DateTime authoritativeNow(DateTime deviceNow) =>
      deviceNow.toUtc().add(_serverOffset);
  bool get isPending =>
      state == 'PENDING' ||
      state == 'ALTERNATIVE_PROPOSED' ||
      state == 'ALTERNATIVE_PENDING';
}

class AlternativeResolution {
  const AlternativeResolution(
      {required this.bookingId, required this.proposalId, required this.state});
  final String bookingId;
  final String proposalId;
  final String state;
}

class ReturnToAvailabilityIntent {
  const ReturnToAvailabilityIntent(
      {required this.bookingId,
      required this.petId,
      required this.clinicId,
      required this.locationId,
      required this.serviceId,
      this.doctorId,
      required this.excludedSlotIds,
      required this.proposalId,
      this.source = 'ALTERNATIVE_DECLINED_OR_RESELECT'});
  final String bookingId,
      petId,
      clinicId,
      locationId,
      serviceId,
      proposalId,
      source;
  final String? doctorId;
  final List<String> excludedSlotIds;
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
  const AlternativeSlotFailure(this.message, {this.ambiguous = false});
  final String message;
  final bool ambiguous;
}

class AlternativeSlotRepository {
  AlternativeSlotRepository(
      {required this.baseUrl,
      required this.accessTokenProvider,
      http.Client? client})
      : _client = client ?? http.Client();
  final Uri baseUrl;
  final Future<String> Function() accessTokenProvider;
  final http.Client _client;

  Future<AlternativeSlotResult<AlternativeSlotSnapshot>> readSnapshot(
      String bookingId) async {
    try {
      final response = await _client.get(
        baseUrl.resolve('/v1/owner/bookings/$bookingId/alternative'),
        headers: await _headers(),
      );
      final payload = _json(response);
      if (response.statusCode == 200) {
        return AlternativeSlotSuccess(
            _snapshot(payload, DateTime.now().toUtc()));
      }
      return _error(response.statusCode, payload,
          'Не удалось получить состояние предложения.');
    } catch (_) {
      return const AlternativeSlotFailure(
          'Нет подключения. Показываем только ранее загруженные данные.');
    }
  }

  Future<AlternativeSlotResult<AlternativeResolution>> resolve({
    required AlternativeSlotSnapshot snapshot,
    required bool accept,
    required String idempotencyKey,
    required String correlationId,
  }) async {
    final action = accept ? 'accept' : 'decline';
    try {
      final response = await _client.post(
        baseUrl.resolve(
            '/v1/owner/bookings/${snapshot.bookingId}/alternative/${snapshot.proposalId}/$action'),
        headers: {
          ...await _headers(),
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': correlationId,
          'If-Match': '${snapshot.aggregateVersion}',
        },
      );
      final payload = _json(response);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return AlternativeSlotSuccess(AlternativeResolution(
          bookingId: payload['bookingId'] as String? ?? snapshot.bookingId,
          proposalId: payload['proposalId'] as String? ?? snapshot.proposalId,
          state: payload['state'] as String? ?? 'PROCESSING',
        ));
      }
      return _error(
          response.statusCode, payload, 'Не удалось отправить решение.');
    } catch (_) {
      return const AlternativeSlotFailure(
          'Ответ сервера не получен. Проверяем итоговое состояние.',
          ambiguous: true);
    }
  }

  Future<Map<String, String>> _headers() async => {
        'Authorization': 'Bearer ${await accessTokenProvider()}',
        'Accept': 'application/json',
      };

  AlternativeSlotResult<T> _error<T>(
      int status, Map<String, dynamic> payload, String fallback) {
    final code = payload['code'] as String? ?? 'UNKNOWN';
    if (status == 409 && code == 'SLOT_LOCKED_RETRY') {
      return const AlternativeSlotRetry();
    }
    if (status == 401 ||
        status == 403 ||
        status == 404 ||
        status == 409 ||
        status == 410 ||
        status == 412 ||
        status == 422) {
      return AlternativeSlotFenced(code);
    }
    return AlternativeSlotFailure(fallback);
  }

  AlternativeSlotSnapshot _snapshot(
      Map<String, dynamic> payload, DateTime receivedAt) {
    final original = payload['originalSlot'] as Map<String, dynamic>;
    final proposed = (payload['proposedSlot'] ?? payload['alternativeSlot'])
        as Map<String, dynamic>;
    final actions = payload['actions'] as Map<String, dynamic>? ?? const {};
    final context = payload['context'] as Map<String, dynamic>? ?? const {};
    return AlternativeSlotSnapshot(
      bookingId: payload['bookingId'] as String? ?? payload['holdId'] as String,
      proposalId: (payload['proposalId'] ?? payload['swapGroupId']) as String,
      originalSlot: _slot(original),
      alternativeSlot: _slot(proposed),
      deadline: DateTime.parse(
          (payload['deadline'] ?? payload['expiresAt']) as String),
      serverNow: DateTime.parse(payload['serverNow'] as String),
      aggregateVersion:
          (payload['aggregateVersion'] ?? payload['version']) as int,
      state: payload['state'] as String,
      canAccept: actions['canAccept'] as bool? ??
          payload['canAccept'] as bool? ??
          false,
      canDecline: actions['canDecline'] as bool? ??
          payload['canDecline'] as bool? ??
          false,
      priceCopy: payload['priceCopy'] as String?,
      actionCode: actions['code'] as String?,
      petId: context['petId'] as String,
      clinicId: context['clinicId'] as String,
      locationId: context['locationId'] as String,
      serviceId: context['serviceId'] as String,
      doctorId: context['doctorId'] as String?,
      receivedAt: receivedAt,
    );
  }

  SlotSnapshot _slot(Map<String, dynamic> value) => SlotSnapshot(
      id: value['id'] as String,
      startsAt: DateTime.parse(value['startsAt'] as String),
      endsAt: DateTime.parse(value['endsAt'] as String));
  Map<String, dynamic> _json(http.Response response) => response.body.isEmpty
      ? <String, dynamic>{}
      : jsonDecode(response.body) as Map<String, dynamic>;
}
