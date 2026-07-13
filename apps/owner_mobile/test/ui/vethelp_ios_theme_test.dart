import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  test('shared buttons have finite minimum widths', () {
    final theme = VetHelpTheme.light();
    final states = <WidgetState>{};

    expect(
      theme.filledButtonTheme.style?.minimumSize?.resolve(states),
      const Size(0, 52),
    );
    expect(
      theme.outlinedButtonTheme.style?.minimumSize?.resolve(states),
      const Size(0, 52),
    );
  });
}
