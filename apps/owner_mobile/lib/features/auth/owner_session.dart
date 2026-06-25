class OwnerSession {
  const OwnerSession({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresInSeconds,
    required this.ownerId,
    required this.phone,
  });

  final String accessToken;
  final String refreshToken;
  final int accessTokenExpiresInSeconds;
  final String ownerId;
  final String phone;
}

class OtpChallenge {
  const OtpChallenge({
    required this.id,
    required this.expiresAt,
    required this.resendAvailableAt,
    this.developmentCode,
  });

  final String id;
  final DateTime expiresAt;
  final DateTime resendAvailableAt;
  final String? developmentCode;
}
