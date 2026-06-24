import 'offline_command.dart';

enum ActionAvailability { allowedOffline, requiresNetwork }

class OfflineActionPolicy {
  static const _offlineTypes = <OfflineCommandType>{
    OfflineCommandType.updatePetProfile,
    OfflineCommandType.saveTriageDraft,
    OfflineCommandType.saveMessageDraft,
    OfflineCommandType.markReminderRead,
    OfflineCommandType.updatePreferences,
  };

  ActionAvailability evaluate(String commandType) {
    final known = OfflineCommandType.values.map((type) => type.name).contains(commandType);
    return known ? ActionAvailability.allowedOffline : ActionAvailability.requiresNetwork;
  }

  bool canEnqueue(OfflineCommand command) => _offlineTypes.contains(command.commandType);

  bool mustBlock(String commandType) => evaluate(commandType) == ActionAvailability.requiresNetwork;
}
