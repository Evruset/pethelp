import 'package:flutter/foundation.dart';

const String ownerV50HomeFlagName = 'OWNER_V50_HOME';

bool resolveOwnerV50HomeFlag({
  String? value,
  required bool shellEnabled,
}) {
  final requested =
      (value ?? const String.fromEnvironment(ownerV50HomeFlagName)) == 'true';
  return requested && shellEnabled;
}

bool _didReportMissingShell = false;

bool isOwnerV50HomeEnabled({required bool shellEnabled}) {
  const requested = String.fromEnvironment(ownerV50HomeFlagName);
  final enabled = resolveOwnerV50HomeFlag(
    value: requested,
    shellEnabled: shellEnabled,
  );
  if (requested == 'true' && !shellEnabled && !_didReportMissingShell) {
    _didReportMissingShell = true;
    debugPrint(
        'OWNER_V50_HOME requires the V50 owner shell; using legacy Home.');
  }
  return enabled;
}
