import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  test('light and dark themes expose the same semantic token contract', () {
    final light = VetHelpTheme.light();
    final dark = VetHelpTheme.dark();
    final lightTokens = light.extension<VetHelpSurfaceTokens>()!;
    final darkTokens = dark.extension<VetHelpSurfaceTokens>()!;

    expect(lightTokens.spaceMd, 12);
    expect(lightTokens.spaceLg, 16);
    expect(lightTokens.spaceXl, 24);
    expect(lightTokens.cardRadius, 18);
    expect(lightTokens.fieldRadius, 12);
    expect(lightTokens.focusRingWidth, 3);
    expect(lightTokens.contentMaxWidth, 1180);
    expect(light.colorScheme.primary, const Color(0xFF1767F7));
    expect(light.colorScheme.surface, const Color(0xFFF6F8FB));
    expect(lightTokens.success, isNot(lightTokens.groupedSurface));
    expect(darkTokens.focusRing, dark.colorScheme.primary);
    expect(darkTokens.info, isNotNull);
  });

  testWidgets('desktop frame constrains content and keeps text scaling',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(1024, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: VetHelpTheme.light(),
        builder: VetHelpTheme.frameBuilder,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.5)),
          child: const Text('stage2'),
        ),
      ),
    );
    await tester.pump();

    final constrained = tester.widget<ConstrainedBox>(find.byWidgetPredicate(
      (widget) =>
          widget is ConstrainedBox && widget.constraints.maxWidth == 1180,
    ));
    expect(constrained.constraints.maxWidth, 1180);
    expect(MediaQuery.textScalerOf(tester.element(find.text('stage2'))),
        const TextScaler.linear(1.5));
  });

  testWidgets('focused fields use the semantic focus ring', (tester) async {
    final theme = VetHelpTheme.light();
    final tokens = theme.extension<VetHelpSurfaceTokens>()!;
    await tester.pumpWidget(
      MaterialApp(
        theme: theme,
        home: const Scaffold(body: TextField(autofocus: true)),
      ),
    );
    await tester.pump();

    final decoration =
        theme.inputDecorationTheme.focusedBorder! as OutlineInputBorder;
    expect(decoration.borderSide.color, tokens.focusRing);
    expect(decoration.borderSide.width, tokens.focusRingWidth);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('interactive primitives retain accessible semantics and targets',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: VetHelpTheme.dark(),
        home: Scaffold(
          body: FilledButton(
            onPressed: () {},
            child: const Text('Continue'),
          ),
        ),
      ),
    );

    final button = find.byType(FilledButton);
    expect(tester.getSize(button).height, greaterThanOrEqualTo(48));
    expect(
      tester.getSemantics(button),
      matchesSemantics(
        label: 'Continue',
        isButton: true,
        hasEnabledState: true,
        hasTapAction: true,
        hasFocusAction: true,
        isFocusable: true,
        isEnabled: true,
      ),
    );

    final tokens = VetHelpTheme.dark().extension<VetHelpSurfaceTokens>()!;
    expect(tokens.focusRing.computeLuminance(), greaterThan(0.05));
    expect(tokens.focusRing, isNot(tokens.groupedSurface));
    expect(tokens.success, isNot(tokens.groupedSurface));
    expect(tokens.warning, isNot(tokens.groupedSurface));
    expect(tokens.info, isNot(tokens.groupedSurface));
  });
}
