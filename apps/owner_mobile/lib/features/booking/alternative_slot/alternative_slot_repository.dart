import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import 'alternative_slot_models.dart';

class ApiFailure implements Exception {
  const ApiFailure(this.statusCode, this.code);

  final int? statusCode;
  final String code;
}

class AlternativeSlotRepository {
  AlternativeSlotRepository(this._client);

  final ApiClient _client;

  Future<AlternativeSlotViewModel> read(String holdId) async {
    try {
      final response = await _client.get<Map<String, dynamic>>('/v1/booking-holds/$holdId');
      return AlternativeSlotViewModel.fromJson(response.data!);
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  Future<AlternativeActionResult> accept(String holdId, int version, String operationId) {
    return _submit('/v1/booking-holds/$holdId/alternative-slot/accept', version, operationId);
  }

  Future<AlternativeActionResult> decline(String holdId, int version, String operationId) {
    return _submit('/v1/booking-holds/$holdId/alternative-slot/decline', version, operationId);
  }

  Future<AlternativeActionResult> _submit(String path, int version, String operationId) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        path,
        headers: <String, dynamic>{
          'Idempotency-Key': operationId,
          'If-Match': '"$version"',
        },
      );
      return AlternativeActionResult.fromJson(response.data!);
    } on DioException catch (error) {
      throw _failure(error);
    }
  }

  ApiFailure _failure(DioException error) {
    final data = error.response?.data;
    final code = data is Map<String, dynamic> && data['code'] is String
        ? data['code'] as String
        : 'NETWORK_ERROR';
    return ApiFailure(error.response?.statusCode, code);
  }
}
