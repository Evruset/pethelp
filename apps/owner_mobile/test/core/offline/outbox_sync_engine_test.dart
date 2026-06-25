import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/core/offline/offline_command.dart';
import 'package:vethelp_owner_mobile/core/offline/outbox_repository.dart';
import 'package:vethelp_owner_mobile/core/offline/outbox_sync_engine.dart';

class FakeTransport implements OfflineCommandTransport {
  FakeTransport(this.result);
  final OutboxRemoteResult result;

  @override
  Future<OutboxRemoteResult> send(OfflineCommand command) async => result;
}

OfflineCommand command() {
  return OfflineCommand(
    mutationId: 'mutation-1',
    kind: OfflineCommandKind.saveTriageDraft,
    aggregateType: 'triage_draft',
    aggregateId: 'draft-1',
    deviceId: 'device-a',
    deviceSequence: 1,
    baseServerVersion: 1,
    payloadSchemaVersion: 1,
    changedFields: const <String>['answer'],
    payload: const <String, Object?>{'answer': 'yes'},
    createdAt: DateTime.utc(2026, 6, 25),
  );
}

void main() {
  test('removes completed commands after a successful sync', () async {
    final repository = OutboxRepository(InMemoryOfflineCommandStore());
    await repository.enqueue(command());
    final engine = OutboxSyncEngine(
      repository: repository,
      transport: FakeTransport(const OutboxRemoteResult(OutboxRemoteResultKind.completed)),
      canReachApi: () async => true,
    );

    final report = await engine.sync();
    expect(report.completed, 1);
    expect(await repository.nextCommands(), isEmpty);
  });

  test('keeps conflicts for resolution without dropping local changes', () async {
    final repository = OutboxRepository(InMemoryOfflineCommandStore());
    await repository.enqueue(command());
    final engine = OutboxSyncEngine(
      repository: repository,
      transport: FakeTransport(const OutboxRemoteResult(OutboxRemoteResultKind.conflict)),
      canReachApi: () async => true,
    );

    final report = await engine.sync();
    expect(report.conflicts, 1);
    expect(await repository.nextCommands(), isEmpty);
  });
}
