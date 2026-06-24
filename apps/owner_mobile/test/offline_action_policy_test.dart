import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/core/offline/offline_action_policy.dart';
import 'package:vethelp_owner_mobile/core/offline/offline_command.dart';

void main() {
  group('OfflineActionPolicy', () {
    test('allows only the safe mutation allowlist', () {
      final policy = OfflineActionPolicy();

      expect(policy.canEnqueue(_command(OfflineCommandType.updatePetProfile)), isTrue);
      expect(policy.canEnqueue(_command(OfflineCommandType.saveTriageDraft)), isTrue);
      expect(policy.canEnqueue(_command(OfflineCommandType.saveMessageDraft)), isTrue);
      expect(policy.canEnqueue(_command(OfflineCommandType.markReminderRead)), isTrue);
      expect(policy.canEnqueue(_command(OfflineCommandType.updatePreferences)), isTrue);
    });

    test('blocks unknown transactional actions while offline', () {
      final policy = OfflineActionPolicy();

      expect(policy.mustBlock('CreateHold'), isTrue);
      expect(policy.mustBlock('AcceptAlternativeSlot'), isTrue);
      expect(policy.mustBlock('CreatePaymentIntent'), isTrue);
      expect(policy.mustBlock('JoinTelemedSession'), isTrue);
      expect(policy.mustBlock('CoverageCheck'), isTrue);
    });
  });
}

OfflineCommand _command(OfflineCommandType type) => OfflineCommand(
      mutationId: 'mutation',
      commandType: type,
      aggregateId: 'pet',
      deviceId: 'device',
      deviceSequence: 1,
      baseServerVersion: 1,
      payloadSchemaVersion: 1,
      changedFields: const <String>['name'],
      clientOccurredAt: DateTime.utc(2026),
      payload: const <String, dynamic>{'name': 'Барсик'},
      state: OfflineCommandState.pending,
    );
