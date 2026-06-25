import 'dart:convert';

import 'package:http/http.dart' as http;

enum ReplayDecision { ignoreStale, apply, refreshSnapshot }

class BookingReplayEvent {
  const BookingReplayEvent({
    required this.eventId,
    required this.eventSequence,
    required this.eventType,
    required this.aggregateVersion,
    required this.occurredAt,
    required this.payload,
  });

  final String eventId;
  final int eventSequence;
  final String eventType;
  final int aggregateVersion;
  final DateTime occurredAt;
  final Map<String, Object?> payload;
}

class BookingReplaySlice {
  const BookingReplaySlice({required this.holdId, required this.serverNow, required this.events});

  final String holdId;
  final DateTime serverNow;
  final List<BookingReplayEvent> events;
}

class AggregateVersionGate {
  AggregateVersionGate([this._version = 0]);

  int _version;
  int get version => _version;

  ReplayDecision decide(BookingReplayEvent event) {
    if (event.aggregateVersion <= _version) return ReplayDecision.ignoreStale;
    if (event.aggregateVersion > _version + 1) return ReplayDecision.refreshSnapshot;
    _version = event.aggregateVersion;
    return ReplayDecision.apply;
  }

  void reset(int version) => _version = version;
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

  Future<BookingReplaySlice> replay({required String holdId, required int afterVersion, int limit = 50}) async {
    final token = await accessTokenProvider();
    final uri = baseUrl.resolve('/v1/booking-holds/$holdId/events').replace(queryParameters: {
      'afterVersion': '$afterVersion',
      'limit': '$limit',
    });
    final response = await _client.get(uri, headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'});
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
                eventSequence: int.parse(item['eventSequence'] as String),
                eventType: item['eventType'] as String,
                aggregateVersion: item['aggregateVersion'] as int,
                occurredAt: DateTime.parse(item['occurredAt'] as String),
                payload: Map<String, Object?>.from(item['payload'] as Map<String, dynamic>),
              ))
          .toList(growable: false),
    );
  }
}
