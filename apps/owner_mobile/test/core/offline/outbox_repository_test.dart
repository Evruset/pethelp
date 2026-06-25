import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/core/offline/offline_command.dart';
import 'package:vethelp_owner_mobile/core/offline/outbox_repository.dart';

void main() {
  OfflineCommand command({
    required String id,
    required int sequence,
    required String aggregateId,
    OfflineCommandKind kind = OfflineCommandKind.updatePetProfile,
    Map<String, Object?> payload = const <String, Object?>{},
  }) {
    return OfflineCommand(
      mutationId: id,
      kind: kind,
      aggregateType: 'pet',
      aggregateId: aggregateId,
      deviceId: 'device-a',
      deviceSequence: sequence,
      baseServerVersion: 3,
      payloadSchemaVersion: 1,
      changedFields: payload.keys.toList(growable: false),
      payload: payload,
      createdAt: DateTime.utc(2026, 6, 25),
    );
  }

  test('does not queue booking commands offline', () async {
    final outbox = OutboxRepository(InMemoryOfflineCommandStore());

    expect(
      () => outbox.enqueue(command(id: '1', sequence: 1, aggregateId: 'pet-a', kind: OfflineCommandKind.createHold)),
      throwsA(isA<OfflineActionBlocked>()),
    );
  });

  test('coalesces pending pet profile updates for the same aggregate', () async {
    final outbox = OutboxRepository(InMemoryOfflineCommandStore());
    await outbox.enqueue(command(id: '1', sequence: 1, aggregateId: 'pet-a', payload: <String, Object?>{'name': 'Барсик'}));
    await outbox.enqueue(command(id: '2', sequence: 2, aggregateId: 'pet-a', payload: <String, Object?>{'weightKg': 5.2}));

    final commands = await outbox.nextCommands();
    expect(commands, hasLength(1));
    expect(commands.single.payload, <String, Object?>{'name': 'Барсик', 'weightKg': 5.2});
    expect(commands.single.baseServerVersion, 3);
  });

  test('returns only the earliest pending command for each aggregate', () async {
    final outbox = OutboxRepository(InMemoryOfflineCommandStore());
    await outbox.enqueue(command(id: '1', sequence: 1, aggregateId: 'pet-a', kind: OfflineCommandKind.saveTriageDraft));
    await outbox.enqueue(command(id: '2', sequence: 2, aggregateId: 'pet-a', kind: OfflineCommandKind.saveTriageDraft));
    await outbox.enqueue(command(id: '3', sequence: 1, aggregateId: 'pet-b', kind: OfflineCommandKind.saveTriageDraft));

    final commands = await outbox.nextCommands();
    expect(commands.map((item) => item.mutationId), containsAllInOrder(<String>['1', '3']));
  });
}
