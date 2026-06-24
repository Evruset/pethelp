import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import 'telemed_models.dart';

class TelemedApiFailure implements Exception {
  const TelemedApiFailure(this.statusCode, this.code);

  final int? statusCode;
  final String code;
}

abstract interface class TelemedDataSource {
  Future<TelemedSnapshot> read(String sessionId);
  Future<TelemedRoomToken> issueRoomToken(String sessionId);
  Future<void> requestEnd(String sessionId, String idempotencyKey);
}

class TelemedRepository implements TelemedDataSource {
  TelemedRepository(this._client, this._uuid);

  final ApiClient _client;
  final Uuid _uuid;

  @override
  Future<TelemedSnapshot> read(String sessionId) async {
    try {
      final response = await _client.get<Map<String, dynamic>>('/v1/telemed/sessions/$sessionId');
      return TelemedSnapshot.fromJson(response.data!);
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  @override
  Future<TelemedRoomToken> issueRoomToken(String sessionId) async {
    try {
      final response = await _client.post<Map<String, dynamic>>('/v1/telemed/sessions/$sessionId/token');
      return TelemedRoomToken.fromJson(response.data!);
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  @override
  Future<void> requestEnd(String sessionId, String idempotencyKey) async {
    try {
      await _client.post<Map<String, dynamic>>(
        '/v1/telemed/sessions/$sessionId/end',
        headers: <String, dynamic>{'Idempotency-Key': idempotencyKey},
      );
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  String newOperationId() => _uuid.v4();

  TelemedApiFailure _failure(DioException error) {
    final data = error.response?.data;
    final code = data is Map<String, dynamic> && data['code'] is String
        ? data['code'] as String
        : 'NETWORK_ERROR';
    return TelemedApiFailure(error.response?.statusCode, code);
  }
}
