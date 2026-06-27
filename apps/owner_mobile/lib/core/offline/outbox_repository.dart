import 'offline_command.dart';

abstract class OfflineCommandStore {
  Future<List<OfflineCommand>> readAll();
  Future<void> replaceAll(List<OfflineCommand> commands);
}

class InMemoryOfflineCommandStore implements OfflineCommandStore {
  List<OfflineCommand> _commands = <OfflineCommand>[];

  @override
  Future<List<OfflineCommand>> readAll() async =>
      List<OfflineCommand>.unmodifiable(_commands);

  @override
  Future<void> replaceAll(List<OfflineCommand> commands) async {
    _commands = List<OfflineCommand>.from(commands);
  }
}

class OfflineActionBlocked implements Exception {
  const OfflineActionBlocked(this.message);
  final String message;
}

class OutboxRepository {
  OutboxRepository(this._store);

  final OfflineCommandStore _store;

  Future<void> enqueue(OfflineCommand command) async {
    if (!OfflineCommandPolicy.canQueue(command.kind)) {
      throw OfflineActionBlocked(
          OfflineCommandPolicy.blockedMessage(command.kind));
    }

    final current = await _store.readAll();
    final next = List<OfflineCommand>.from(current);
    final existingIndex = _coalescibleIndex(next, command);
    if (existingIndex >= 0) {
      final previous = next[existingIndex];
      next[existingIndex] = OfflineCommand(
        mutationId: command.mutationId,
        kind: command.kind,
        aggregateType: command.aggregateType,
        aggregateId: command.aggregateId,
        deviceId: command.deviceId,
        deviceSequence: command.deviceSequence,
        baseServerVersion: previous.baseServerVersion,
        payloadSchemaVersion: command.payloadSchemaVersion,
        changedFields: <String>{
          ...previous.changedFields,
          ...command.changedFields
        }.toList(growable: false),
        payload: <String, Object?>{...previous.payload, ...command.payload},
        createdAt: command.createdAt,
      );
    } else {
      next.add(command);
    }
    next.sort(_compareByAggregateThenSequence);
    await _store.replaceAll(next);
  }

  Future<List<OfflineCommand>> nextCommands({int maxCount = 20}) async {
    final all = await _store.readAll();
    final result = <OfflineCommand>[];
    final seenAggregate = <String>{};

    for (final command
        in all.where((item) => item.status == OfflineCommandStatus.pending)) {
      final aggregateKey = '${command.aggregateType}:${command.aggregateId}';
      if (seenAggregate.contains(aggregateKey)) continue;
      result.add(command);
      seenAggregate.add(aggregateKey);
      if (result.length == maxCount) break;
    }
    return result;
  }

  Future<List<OfflineCommand>> commandsForAggregate({
    required String aggregateType,
    required String aggregateId,
  }) async {
    final all = await _store.readAll();
    return all
        .where((command) =>
            command.aggregateType == aggregateType &&
            command.aggregateId == aggregateId &&
            command.status != OfflineCommandStatus.completed)
        .toList(growable: false);
  }

  Future<void> removeCommandsForAggregate({
    required String aggregateType,
    required String aggregateId,
  }) async {
    final all = await _store.readAll();
    await _store.replaceAll(all
        .where((command) =>
            command.aggregateType != aggregateType ||
            command.aggregateId != aggregateId)
        .toList(growable: false));
  }

  Future<void> updateStatus(
      String mutationId, OfflineCommandStatus status) async {
    final all = await _store.readAll();
    await _store.replaceAll(all.map((command) {
      return command.mutationId == mutationId
          ? command.copyWith(status: status)
          : command;
    }).toList(growable: false));
  }

  Future<void> removeCompleted() async {
    final all = await _store.readAll();
    await _store.replaceAll(all
        .where((item) => item.status != OfflineCommandStatus.completed)
        .toList(growable: false));
  }

  int _coalescibleIndex(
      List<OfflineCommand> commands, OfflineCommand incoming) {
    if (incoming.kind != OfflineCommandKind.updatePetProfile &&
        incoming.kind != OfflineCommandKind.updateNotificationPreferences) {
      return -1;
    }
    return commands.lastIndexWhere((current) {
      return current.kind == incoming.kind &&
          current.aggregateType == incoming.aggregateType &&
          current.aggregateId == incoming.aggregateId &&
          current.status == OfflineCommandStatus.pending;
    });
  }

  int _compareByAggregateThenSequence(
      OfflineCommand left, OfflineCommand right) {
    final aggregate = '${left.aggregateType}:${left.aggregateId}'
        .compareTo('${right.aggregateType}:${right.aggregateId}');
    if (aggregate != 0) return aggregate;
    return left.deviceSequence.compareTo(right.deviceSequence);
  }
}
