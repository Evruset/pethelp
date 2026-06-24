import '../network/network_gate.dart';
import 'offline_command.dart';
import 'offline_outbox_repository.dart';

class SyncResponse {
  const SyncResponse({required this.statusCode, this.errorCode});
  final int statusCode;
  final String? errorCode;

  bool get isSuccess => statusCode >= 200 && statusCode < 300;
}

abstract interface class OfflineSyncClient {
  Future<SyncResponse> submit(OfflineCommand command);
}

class OfflineSyncEngine {
  OfflineSyncEngine({
    required OfflineOutboxRepository outbox,
    required NetworkGate networkGate,
    required OfflineSyncClient client,
  })  : _outbox = outbox,
        _networkGate = networkGate,
        _client = client;

  final OfflineOutboxRepository _outbox;
  final NetworkGate _networkGate;
  final OfflineSyncClient _client;

  Future<void> synchronize({required int minimumAcceptedSchemaVersion}) async {
    if (await _networkGate.check() != NetworkGateState.online) return;

    final commands = _outbox.pending();
    for (final command in commands) {
      if (command.payloadSchemaVersion < minimumAcceptedSchemaVersion) {
        await _outbox.updateState(
          command,
          OfflineCommandState.fencedSchema,
          errorCode: 'SCHEMA_VERSION_UNSUPPORTED',
        );
        continue;
      }

      await _outbox.updateState(command, OfflineCommandState.syncing);
      final response = await _client.submit(command);
      if (response.isSuccess) {
        await _outbox.updateState(command, OfflineCommandState.completed);
        continue;
      }

      if (response.statusCode == 401) {
        await _outbox.updateState(command, OfflineCommandState.pending, errorCode: 'UNAUTHENTICATED');
        return;
      }
      if (response.statusCode == 403) {
        await _outbox.updateState(command, OfflineCommandState.denied, errorCode: response.errorCode ?? 'SCOPE_DENIED');
        continue;
      }
      if (response.statusCode == 409) {
        await _outbox.updateState(command, OfflineCommandState.conflicted, errorCode: response.errorCode ?? 'ENTITY_CONFLICT');
        continue;
      }
      if (response.statusCode == 422) {
        await _outbox.updateState(command, OfflineCommandState.fencedSchema, errorCode: response.errorCode ?? 'INVALID_MUTATION');
        continue;
      }

      await _outbox.updateState(command, OfflineCommandState.pending, errorCode: response.errorCode ?? 'SYNC_RETRY');
      return;
    }
  }
}
