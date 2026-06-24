enum OfflineCommandState {
  pending,
  syncing,
  conflicted,
  denied,
  fencedSchema,
  completed,
}

enum OfflineCommandType {
  updatePetProfile,
  saveTriageDraft,
  saveMessageDraft,
  markReminderRead,
  updatePreferences,
}

class OfflineCommand {
  const OfflineCommand({
    required this.mutationId,
    required this.commandType,
    required this.aggregateId,
    required this.deviceId,
    required this.deviceSequence,
    required this.baseServerVersion,
    required this.payloadSchemaVersion,
    required this.changedFields,
    required this.clientOccurredAt,
    required this.payload,
    required this.state,
    this.lastErrorCode,
  });

  final String mutationId;
  final OfflineCommandType commandType;
  final String aggregateId;
  final String deviceId;
  final int deviceSequence;
  final int baseServerVersion;
  final int payloadSchemaVersion;
  final List<String> changedFields;
  final DateTime clientOccurredAt;
  final Map<String, dynamic> payload;
  final OfflineCommandState state;
  final String? lastErrorCode;

  Map<String, dynamic> toMap() => <String, dynamic>{
        'mutationId': mutationId,
        'commandType': commandType.name,
        'aggregateId': aggregateId,
        'deviceId': deviceId,
        'deviceSequence': deviceSequence,
        'baseServerVersion': baseServerVersion,
        'payloadSchemaVersion': payloadSchemaVersion,
        'changedFields': changedFields,
        'clientOccurredAt': clientOccurredAt.toUtc().toIso8601String(),
        'payload': payload,
        'state': state.name,
        'lastErrorCode': lastErrorCode,
      };

  factory OfflineCommand.fromMap(Map<dynamic, dynamic> map) {
    return OfflineCommand(
      mutationId: map['mutationId'] as String,
      commandType: OfflineCommandType.values.byName(map['commandType'] as String),
      aggregateId: map['aggregateId'] as String,
      deviceId: map['deviceId'] as String,
      deviceSequence: map['deviceSequence'] as int,
      baseServerVersion: map['baseServerVersion'] as int,
      payloadSchemaVersion: map['payloadSchemaVersion'] as int,
      changedFields: List<String>.from(map['changedFields'] as List<dynamic>),
      clientOccurredAt: DateTime.parse(map['clientOccurredAt'] as String).toUtc(),
      payload: Map<String, dynamic>.from(map['payload'] as Map<dynamic, dynamic>),
      state: OfflineCommandState.values.byName(map['state'] as String),
      lastErrorCode: map['lastErrorCode'] as String?,
    );
  }
}
