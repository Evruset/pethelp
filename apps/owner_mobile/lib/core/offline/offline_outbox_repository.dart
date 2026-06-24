import 'package:uuid/uuid.dart';

import 'local_hive_store.dart';
import 'offline_action_policy.dart';
import 'offline_command.dart';

class OfflineActionBlocked implements Exception {
  const OfflineActionBlocked(this.commandType);
  final String commandType;
}

class OfflineOutboxRepository {
  OfflineOutboxRepository({
    required LocalHiveStore store,
    required OfflineActionPolicy policy,
    required Uuid uuid,
  })  : _store = store,
        _policy = policy,
        _uuid = uuid;

  final LocalHiveStore _store;
  final OfflineActionPolicy _policy;
  final Uuid _uuid;

  Future<OfflineCommand> enqueuePetProfilePatch({
    required String petId,
    required int baseServerVersion,
    required List<String> changedFields,
    required Map<String, dynamic> payload,
  }) async {
    const commandType = OfflineCommandType.updatePetProfile;
    final command = OfflineCommand(
      mutationId: _uuid.v4(),
      commandType: commandType,
      aggregateId: petId,
      deviceId: await _deviceId(),
      deviceSequence: await _nextDeviceSequence(),
      baseServerVersion: baseServerVersion,
      payloadSchemaVersion: 1,
      changedFields: changedFields,
      clientOccurredAt: DateTime.now().toUtc(),
      payload: payload,
      state: OfflineCommandState.pending,
    );
    await enqueue(command);
    return command;
  }

  Future<void> enqueue(OfflineCommand command) async {
    if (!_policy.canEnqueue(command)) throw OfflineActionBlocked(command.commandType.name);
    final box = _store.outboxBox();
    final obsolete = box.values
        .whereType<Map<dynamic, dynamic>>()
        .map(OfflineCommand.fromMap)
        .where(
          (item) =>
              item.aggregateId == command.aggregateId &&
              item.commandType == command.commandType &&
              item.state == OfflineCommandState.pending,
        )
        .toList();
    for (final item in obsolete) {
      await box.delete(item.mutationId);
    }
    await box.put(command.mutationId, command.toMap());
  }

  List<OfflineCommand> pendingForAggregate(String aggregateId) {
    return _store.outboxBox().values
        .whereType<Map<dynamic, dynamic>>()
        .map(OfflineCommand.fromMap)
        .where((command) => command.aggregateId == aggregateId && command.state == OfflineCommandState.pending)
        .toList()
      ..sort((left, right) => left.deviceSequence.compareTo(right.deviceSequence));
  }

  List<OfflineCommand> pending() {
    final commands = _store.outboxBox().values
        .whereType<Map<dynamic, dynamic>>()
        .map(OfflineCommand.fromMap)
        .where((command) => command.state == OfflineCommandState.pending)
        .toList();
    commands.sort((left, right) {
      final aggregate = left.aggregateId.compareTo(right.aggregateId);
      return aggregate == 0 ? left.deviceSequence.compareTo(right.deviceSequence) : aggregate;
    });
    return commands;
  }

  Future<void> updateState(
    OfflineCommand command,
    OfflineCommandState state, {
    String? errorCode,
  }) async {
    final updated = command.toMap()
      ..['state'] = state.name
      ..['lastErrorCode'] = errorCode;
    await _store.outboxBox().put(command.mutationId, updated);
  }

  Future<String> _deviceId() async {
    final metadata = _store.metadataBox();
    final existing = metadata.get('device-id') as String?;
    if (existing != null) return existing;
    final created = _uuid.v4();
    await metadata.put('device-id', created);
    return created;
  }

  Future<int> _nextDeviceSequence() async {
    final metadata = _store.metadataBox();
    final previous = metadata.get('device-sequence') as int? ?? 0;
    final next = previous + 1;
    await metadata.put('device-sequence', next);
    return next;
  }
}
