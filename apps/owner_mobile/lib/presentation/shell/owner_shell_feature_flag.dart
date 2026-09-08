const ownerV50ShellFlag = 'VETHELP_OWNER_V50_SHELL';
const ownerV51ShellLegacyFlag = 'VETHELP_OWNER_V51_SHELL';

const _undefinedFlagValue = '__VETHELP_FLAG_UNDEFINED__';
const _canonicalEnvironmentValue = String.fromEnvironment(
  ownerV50ShellFlag,
  defaultValue: _undefinedFlagValue,
);
const _legacyEnvironmentValue = String.fromEnvironment(
  ownerV51ShellLegacyFlag,
  defaultValue: _undefinedFlagValue,
);

/// Resolves the Owner shell rollout contract.
///
/// A defined canonical value always wins, including an explicit `false` or an
/// invalid value. Only the exact string `true` enables the shell. The legacy
/// V51 flag is consulted only while the canonical flag is undefined.
bool resolveOwnerV50ShellFlag({
  String? canonicalValue,
  String? legacyValue,
}) {
  if (canonicalValue != null) return canonicalValue == 'true';
  return legacyValue == 'true';
}

bool isOwnerV50ShellEnabled() => resolveOwnerV50ShellFlag(
      canonicalValue: _canonicalEnvironmentValue == _undefinedFlagValue
          ? null
          : _canonicalEnvironmentValue,
      legacyValue: _legacyEnvironmentValue == _undefinedFlagValue
          ? null
          : _legacyEnvironmentValue,
    );
