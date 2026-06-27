import 'dart:convert';

import 'package:http/http.dart' as http;

enum ReplayDecision { ignoreStale, apply, refreshSnapshot }

class BookingReplayEvent {
  const BookingReplayEvent({
    required this.eventId,
    required this.sequence,
    required this.eventType,
    required this.schemaVersion,
    required this.aggregateType,
    required this.aggregateId,
    required this.aggregateVersion,
    required this.occurredAt,
    required this.correlationId,
    required this.causationId,
    required this.traceparent,
    required this.payload,
  });

  final String eventId;
  final int sequence;
  int get eventSequence => sequence;
  final String eventType;
  final int schemaVersion;
  final String aggregateType;
  final String aggregateId;
  final int aggregateVersion;
  final DateTime occurredAt;
  final String? correlationId;
  final String? causationId;
  final String? traceparent;
  final Map<String, Object?> payload;
}

class BookingReplaySlice {
  const BookingReplaySlice(
      {required this.holdId, required this.serverNow, required this.events});

  final String holdId;
  final DateTime serverNow;
  final List<BookingReplayEvent> events;
}

class AggregateVersionGate {
  AggregateVersionGate([this._version = 0, this._lastSequence = 0]);

  int _version;
  int _lastSequence;
  int get version => _version;
  int get lastSequence => _lastSequence;

  ReplayDecision decide(BookingReplayEvent event) {
    if (event.sequence <= _lastSequence) return ReplayDecision.ignoreStale;
    if (_lastSequence > 0 && event.sequence > _lastSequence + 1) {
      return ReplayDecision.refreshSnapshot;
    }
    if (event.aggregateVersion <= _version) return ReplayDecision.ignoreStale;
    if (event.aggregateVersion > _version + 1) {
      return ReplayDecision.refreshSnapshot;
    }
    _version = event.aggregateVersion;
    _lastSequence = event.sequence;
    return ReplayDecision.apply;
  }

  void reset(int version, {int? lastSequence}) {
    _version = version;
    if (lastSequence != null) _lastSequence = lastSequence;
  }
}

class BookingEventReplayRepository {
  BookingEventReplayRepository({
    required this.baseUrl,
    required this.accessTokenProvider,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final Future<String> Function() accessTokenProvider;
  final http.Client _client;

  Future<BookingReplaySlice> replay({
    required String holdId,
    required int afterVersion,
    int afterSequence = 0,
    int limit = 50,
  }) async {
    final token = await accessTokenProvider();
    final uri = baseUrl
        .resolve('/v1/booking-holds/$holdId/events')
        .replace(queryParameters: {
      'afterVersion': '$afterVersion',
      'afterSequence': '$afterSequence',
      'limit': '$limit',
    });
    final response = await _client.get(uri, headers: {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json'
    });
    if (response.statusCode != 200) {
      throw StateError('Unable to replay booking events.');
    }
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return BookingReplaySlice(
      holdId: payload['holdId'] as String,
      serverNow: DateTime.parse(payload['serverNow'] as String),
      events: (payload['events'] as List<dynamic>)
          .map((item) => item as Map<String, dynamic>)
          .map((item) => BookingReplayEvent(
                eventId: item['eventId'] as String,
                sequence: _intCursor(item['sequence'] ?? item['eventSequence']),
                eventType: item['eventType'] as String,
                schemaVersion: (item['schemaVersion'] as num).toInt(),
                aggregateType: item['aggregateType'] as String,
                aggregateId: item['aggregateId'] as String,
                aggregateVersion: item['aggregateVersion'] as int,
                occurredAt: DateTime.parse(item['occurredAt'] as String),
                correlationId: item['correlationId'] as String?,
                causationId: item['causationId'] as String?,
                traceparent: item['traceparent'] as String?,
                payload: Map<String, Object?>.from(
                    item['payload'] as Map<String, dynamic>),
              ))
          .toList(growable: false),
    );
  }
}

int _intCursor(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.parse(value);
  throw const FormatException('Invalid replay cursor.');
}
