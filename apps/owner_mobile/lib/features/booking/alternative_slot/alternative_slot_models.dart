class SlotViewModel {
  const SlotViewModel({required this.slotId, required this.startsAt, required this.endsAt});

  final String slotId;
  final DateTime startsAt;
  final DateTime endsAt;

  factory SlotViewModel.fromJson(Map<String, dynamic> json) {
    return SlotViewModel(
      slotId: json['slotId'] as String,
      startsAt: DateTime.parse(json['startsAt'] as String).toUtc(),
      endsAt: DateTime.parse(json['endsAt'] as String).toUtc(),
    );
  }
}

class AlternativeSlotViewModel {
  const AlternativeSlotViewModel({
    required this.holdId,
    required this.version,
    required this.state,
    required this.expiresAt,
    required this.serverNow,
    required this.originalSlot,
    required this.proposedSlot,
  });

  final String holdId;
  final int version;
  final String state;
  final DateTime expiresAt;
  final DateTime serverNow;
  final SlotViewModel originalSlot;
  final SlotViewModel? proposedSlot;

  bool get canDecide => state == 'ALTERNATIVE_PENDING' && proposedSlot != null;

  factory AlternativeSlotViewModel.fromJson(Map<String, dynamic> json) {
    final alternative = json['alternativeSlot'] as Map<String, dynamic>?;
    final serverNow = DateTime.parse(json['serverNow'] as String).toUtc();
    final rawExpiresAt = DateTime.parse(json['expiresAt'] as String).toUtc();
    final offset = serverNow.difference(DateTime.now().toUtc());
    return AlternativeSlotViewModel(
      holdId: json['holdId'] as String,
      version: json['version'] as int,
      state: json['state'] as String,
      expiresAt: rawExpiresAt.subtract(offset),
      serverNow: serverNow,
      originalSlot: SlotViewModel.fromJson(json['originalSlot'] as Map<String, dynamic>),
      proposedSlot: alternative == null ? null : SlotViewModel.fromJson(alternative),
    );
  }
}

enum BookingFenceReason { expired, staleVersion, unavailable, invalidTransition }

class AlternativeActionResult {
  const AlternativeActionResult({required this.state, this.appointmentId});

  final String state;
  final String? appointmentId;

  factory AlternativeActionResult.fromJson(Map<String, dynamic> json) {
    return AlternativeActionResult(
      state: json['state'] as String,
      appointmentId: json['appointmentId'] as String?,
    );
  }
}
