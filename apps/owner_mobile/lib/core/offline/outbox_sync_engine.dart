import 'offline_command.dart';
import 'outbox_repository.dart';

enum OutboxRemoteResultKind {
  completed,
  conflict,
  denied,
  fencedSchema,
  invalid,
  unauthenticated,
  retryableFailure,
}

class OutboxRemoteResult {
  const OutboxRemoteResult(this.kind);
  final OutboxRemoteResultKind kind;
}

abstract class OfflineCommandTransport {
  Future<OutboxRemoteResult> send(OfflineCommand command);
}

class OutboxSyncReport {
  const OutboxSyncReport({
    required this.completed,
    required this.conflicts,
    required this.pausedForAuth,
    required this.retryableFailure,
  });

  final int completed;
  final int conflicts;
  final bool pausedForAuth;
  final bool retryableFailure;
}

class OutboxSyncEngine {
  OutboxSyncEngine({
    required OutboxRepository repository,
    required OfflineCommandTransport transport,
    required Future<bool> Function() canReachApi,
  })  : _repository = repository,
        _transport = transport,
        _canReachApi = canReachApi;

  final OutboxRepository _repository;
  final OfflineCommandTransport _transport;
  final Future<bool> Function() _canReachApi;

  Future<OutboxSyncReport> sync() async {
    if (!await _canReachApi()) {
      return const OutboxSyncReport(completed: 0, conflicts: 0, pausedForAuth: false, retryableFailure: true);
    }

    var completed = 0;
    var conflicts = 0;
    for (final command in await _repository.nextCommands()) {
      await _repository.updateStatus(command.mutationId, OfflineCommandStatus.syncing);
      final result = await _transport.send(command);
      switch (result.kind) {
        case OutboxRemoteResultKind.completed:
          completed += 1;
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.completed);
        case OutboxRemoteResultKind.conflict:
          conflicts += 1;
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.conflict);
        case OutboxRemoteResultKind.denied:
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.denied);
        case OutboxRemoteResultKind.fencedSchema:
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.fencedSchema);
        case OutboxRemoteResultKind.invalid:
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.invalid);
        case OutboxRemoteResultKind.unauthenticated:
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.pending);
          return OutboxSyncReport(completed: completed, conflicts: conflicts, pausedForAuth: true, retryableFailure: false);
        case OutboxRemoteResultKind.retryableFailure:
          await _repository.updateStatus(command.mutationId, OfflineCommandStatus.pending);
          return OutboxSyncReport(completed: completed, conflicts: conflicts, pausedForAuth: false, retryableFailure: true);
      }
    }

    await _repository.removeCompleted();
    return OutboxSyncReport(completed: completed, conflicts: conflicts, pausedForAuth: false, retryableFailure: false);
  }
}
