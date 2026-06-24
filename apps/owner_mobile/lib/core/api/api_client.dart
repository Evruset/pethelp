import 'package:dio/dio.dart';

import '../auth/secure_token_store.dart';
import '../trace/journey_trace_context.dart';

class ApiClient {
  ApiClient({
    required String baseUrl,
    required SecureTokenStore credentialStore,
    required JourneyTraceContext traceContext,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(milliseconds: 700),
            receiveTimeout: const Duration(seconds: 5),
            headers: const {'Accept': 'application/json'},
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final credential = await credentialStore.read();
          if (credential != null && credential.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $credential';
          }
          options.headers['X-Correlation-ID'] = traceContext.currentId;
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _dio.get<T>(path, queryParameters: queryParameters);

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? headers,
  }) =>
      _dio.post<T>(path, data: data, options: Options(headers: headers));

  Future<bool> healthCheck() async {
    try {
      final response = await _dio.get<void>('/health');
      return response.statusCode != null && response.statusCode! >= 200 && response.statusCode! < 300;
    } on DioException {
      return false;
    }
  }
}
