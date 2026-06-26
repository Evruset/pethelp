import 'dart:convert';

import 'package:http/http.dart' as http;

class TelemedRoomAccess {
  const TelemedRoomAccess({
    required this.sessionId,
    required this.version,
    required this.accessToken,
    required this.tokenExpiresAt,
    required this.livekitUrl,
  });

  final String sessionId;
  final int version;
  final String accessToken;
  final DateTime tokenExpiresAt;
  final String livekitUrl;
}

class TelemedRoomAccessUnavailable implements Exception {
  const TelemedRoomAccessUnavailable(this.code);
  final String code;
}

abstract class TelemedRoomAccessRepository {
  Future<TelemedRoomAccess> createRoomAccess(String sessionId);
}

class HttpTelemedRoomAccessRepository implements TelemedRoomAccessRepository {
  HttpTelemedRoomAccessRepository({
    required this.baseUrl,
    required this.accessTokenProvider,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final Future<String> Function() accessTokenProvider;
  final http.Client _client;

  @override
  Future<TelemedRoomAccess> createRoomAccess(String sessionId) async {
    final token = await accessTokenProvider();
    final response = await _client.post(
      baseUrl.resolve('/v1/telemed/sessions/$sessionId/room-token'),
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    final payload = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw TelemedRoomAccessUnavailable(
          payload['code'] as String? ?? 'ROOM_ACCESS_UNAVAILABLE');
    }
    return TelemedRoomAccess(
      sessionId: payload['sessionId'] as String,
      version: payload['version'] as int,
      accessToken: payload['accessToken'] as String,
      tokenExpiresAt: DateTime.parse(payload['tokenExpiresAt'] as String),
      livekitUrl: payload['livekitUrl'] as String,
    );
  }
}
