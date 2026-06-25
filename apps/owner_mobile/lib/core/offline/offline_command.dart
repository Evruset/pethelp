enum OfflineCommandKind {
  updatePetProfile,
  saveTriageDraft,
  saveMessageDraft,
  markReminderRead,
  uploadDeferredAttachment,
  updateNotificationPreferences,
  createHold,
  acceptAlternativeSlot,
  confirmAppointment,
  cancelAppointment,
  createPaymentIntent,
  capturePayment,
  joinTelemedSession,
  coverageCheck,
  emergencyDecision,
}

enum OfflineCommandStatus {
  pending,
  syncing,
  completed,
  conflict,
  denied,
  fencedSchema,
  invalid,
}

class OfflineCommand {
  const OfflineCommand({
    required this.mutationId,
    required this.kind,
    required this.aggregateType,
    required this.aggregateId,
    required this.deviceId,
    required this.deviceSequence,
    required this.baseServerVersion,
    required this.payloadSchemaVersion,
    required this.changedFields,
    required this.payload,
    required this.createdAt,
    this.status = OfflineCommandStatus.pending,
  });

  final String mutationId;
  final OfflineCommandKind kind;
  final String aggregateType;
  final String aggregateId;
  final String deviceId;
  final int deviceSequence;
  final int baseServerVersion;
  final int payloadSchemaVersion;
  final List<String> changedFields;
  final Map<String, Object?> payload;
  final DateTime createdAt;
  final OfflineCommandStatus status;

  OfflineCommand copyWith({OfflineCommandStatus? status}) {
    return OfflineCommand(
      mutationId: mutationId,
      kind: kind,
      aggregateType: aggregateType,
      aggregateId: aggregateId,
      deviceId: deviceId,
      deviceSequence: deviceSequence,
      baseServerVersion: baseServerVersion,
      payloadSchemaVersion: payloadSchemaVersion,
      changedFields: changedFields,
      payload: payload,
      createdAt: createdAt,
      status: status ?? this.status,
    );
  }
}

class OfflineCommandPolicy {
  static bool canQueue(OfflineCommandKind kind) {
    return switch (kind) {
      OfflineCommandKind.updatePetProfile ||
      OfflineCommandKind.saveTriageDraft ||
      OfflineCommandKind.saveMessageDraft ||
      OfflineCommandKind.markReminderRead ||
      OfflineCommandKind.uploadDeferredAttachment ||
      OfflineCommandKind.updateNotificationPreferences => true,
      _ => false,
    };
  }

  static String blockedMessage(OfflineCommandKind kind) {
    return switch (kind) {
      OfflineCommandKind.createHold ||
      OfflineCommandKind.acceptAlternativeSlot ||
      OfflineCommandKind.confirmAppointment ||
      OfflineCommandKind.cancelAppointment => 'Бронирование и изменение записи требуют соединения с VetHelp.',
      OfflineCommandKind.createPaymentIntent ||
      OfflineCommandKind.capturePayment => 'Оплата не может быть выполнена офлайн.',
      OfflineCommandKind.joinTelemedSession => 'Для консультации требуется стабильное соединение.',
      OfflineCommandKind.coverageCheck => 'Проверка страхового покрытия требует соединения с партнёром.',
      OfflineCommandKind.emergencyDecision => 'Экстренный маршрут нельзя строить по устаревшим данным.',
      _ => 'Для этого действия требуется соединение с VetHelp.',
    };
  }
}
