import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../core/api/api_client.dart';
import '../core/auth/secure_token_store.dart';
import '../core/clock/server_clock.dart';
import '../core/config/app_config.dart';
import '../core/network/network_gate.dart';
import '../core/offline/local_hive_store.dart';
import '../core/offline/offline_action_policy.dart';
import '../core/offline/offline_outbox_repository.dart';
import '../core/operations/operation_id_store.dart';
import '../core/trace/journey_trace_context.dart';
import '../features/booking/alternative_slot/alternative_slot_repository.dart';
import '../features/telemed/telemed_repository.dart';

final appConfigProvider = Provider<AppConfig>((_) => throw UnimplementedError());
final localHiveStoreProvider = Provider<LocalHiveStore>((_) => throw UnimplementedError());
final secureTokenStoreProvider = Provider<SecureTokenStore>((_) => throw UnimplementedError());

final uuidProvider = Provider<Uuid>((_) => const Uuid());
final traceContextProvider = Provider<JourneyTraceContext>((ref) => JourneyTraceContext(ref.read(uuidProvider)));
final serverClockProvider = Provider<ServerClock>((_) => ServerClock());

final apiClientProvider = Provider<ApiClient>((ref) {
  final config = ref.read(appConfigProvider);
  return ApiClient(baseUrl: config.apiBaseUrl, credentialStore: ref.read(secureTokenStoreProvider), traceContext: ref.read(traceContextProvider));
});

final networkGateProvider = Provider<NetworkGate>((ref) => NetworkGate(Connectivity(), ref.read(apiClientProvider)));
final operationIdStoreProvider = Provider<OperationIdStore>((ref) => OperationIdStore(ref.read(localHiveStoreProvider), ref.read(uuidProvider)));
final offlineOutboxProvider = Provider<OfflineOutboxRepository>((ref) => OfflineOutboxRepository(store: ref.read(localHiveStoreProvider), policy: OfflineActionPolicy(), uuid: ref.read(uuidProvider)));
final alternativeSlotRepositoryProvider = Provider<AlternativeSlotRepository>((ref) => AlternativeSlotRepository(ref.read(apiClientProvider)));
final telemedRepositoryProvider = Provider<TelemedRepository>((ref) => TelemedRepository(ref.read(apiClientProvider), ref.read(uuidProvider)));
