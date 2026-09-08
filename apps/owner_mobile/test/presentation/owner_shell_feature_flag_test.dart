import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/presentation/shell/owner_shell_feature_flag.dart';

void main() {
  test('Owner V50 shell is disabled when both flags are undefined', () {
    expect(resolveOwnerV50ShellFlag(), isFalse);
  });

  test('legacy V51 flag enables the shell only for exact true', () {
    expect(resolveOwnerV50ShellFlag(legacyValue: 'true'), isTrue);
    expect(resolveOwnerV50ShellFlag(legacyValue: 'TRUE'), isFalse);
    expect(resolveOwnerV50ShellFlag(legacyValue: '1'), isFalse);
  });

  test('defined canonical flag wins every conflict', () {
    expect(
      resolveOwnerV50ShellFlag(
        canonicalValue: 'false',
        legacyValue: 'true',
      ),
      isFalse,
    );
    expect(
      resolveOwnerV50ShellFlag(
        canonicalValue: 'true',
        legacyValue: 'false',
      ),
      isTrue,
    );
    expect(
      resolveOwnerV50ShellFlag(
        canonicalValue: 'TRUE',
        legacyValue: 'true',
      ),
      isFalse,
    );
  });
}
