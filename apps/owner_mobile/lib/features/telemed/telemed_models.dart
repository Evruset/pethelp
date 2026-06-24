enum TelemedSessionStatus { waitingForDoctor, connected, completed, doctorTimeout }

enum TelemedRefundStatus { notApplicable, voidRequested, voided, refundRequested, refunded }

class TelemedSnapshot {
  const TelemedSnapshot({
    required this.sessionId,
    required this.status,
    required this.version,
    required this.doctorJoinDeadlineAt,
    required this.serverNow,
    required this.endRequested,
    required this.refundStatus,
  });

  final String sessionId;
  final TelemedSessionStatus status;
  final int version;
  final DateTime doctorJoinDeadlineAt;
  final DateTime serverNow;
  final bool endRequested;
  final TelemedRefundStatus refundStatus;

  factory TelemedSnapshot.fromJson(Map<String, dynamic> json) {
    return TelemedSnapshot(
      sessionId: json['sessionId'] as String,
      status: _status(json['state'] as String),
      version: json['version'] as int,
      doctorJoinDeadlineAt: DateTime.parse(json['doctorJoinDeadlineAt'] as String).toUtc(),
      serverNow: DateTime.parse(json['serverNow'] as String).toUtc(),
      endRequested: json['endRequested'] as bool? ?? false,
      refundStatus: _refund(json['refundState'] as String? ?? 'NOT_APPLICABLE'),
    );
  }

  static TelemedSessionStatus _status(String value) => switch (value) {
        'WAITING_FOR_DOCTOR' => TelemedSessionStatus.waitingForDoctor,
        'CONNECTED' => TelemedSessionStatus.connected,
        'COMPLETED' => TelemedSessionStatus.completed,
        'DOCTOR_TIMEOUT' => TelemedSessionStatus.doctorTimeout,
        _ => throw ArgumentError.value(value, 'state', 'Unsupported telemedicine state'),
      };

  static TelemedRefundStatus _refund(String value) => switch (value) {
        'VOID_REQUESTED' => TelemedRefundStatus.voidRequested,
        'VOIDED' => TelemedRefundStatus.voided,
        'REFUND_REQUESTED' => TelemedRefundStatus.refundRequested,
        'REFUNDED' => TelemedRefundStatus.refunded,
        _ => TelemedRefundStatus.notApplicable,
      };
}

class TelemedRoomToken {
  const TelemedRoomToken({
    required this.sessionId,
    required this.roomName,
    required this.accessToken,
    required this.livekitUrl,
    required this.version,
  });

  final String sessionId;
  final String roomName;
  final String accessToken;
  final String livekitUrl;
  final int version;

  factory TelemedRoomToken.fromJson(Map<String, dynamic> json) => TelemedRoomToken(
        sessionId: json['sessionId'] as String,
        roomName: json['roomName'] as String,
        accessToken: json['accessToken'] as String,
        livekitUrl: json['livekitUrl'] as String,
        version: json['version'] as int,
      );
}
