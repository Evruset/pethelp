import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';
import 'package:vethelp_owner_mobile/presentation/widgets/adaptive_hit_target.dart';

void main() {
  testWidgets('uses Cupertino tabs on iOS and switches sections',
      (tester) async {
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      CupertinoApp(
        home: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.5)),
            child: const OwnerAdaptiveShell(
              platformOverride: TargetPlatform.iOS,
              home: Text('Home content'),
              clinics: Text('Clinics content'),
              appointments: Text('Appointments content'),
              pets: Text('Pets content'),
              profile: Text('Profile content'),
            ),
          ),
        ),
      ),
    );

    expect(find.byType(CupertinoTabBar), findsOneWidget);
    expect(find.byType(CupertinoTabScaffold), findsOneWidget);
    expect(find.byType(Material), findsNothing);
    expect(find.text('Home content'), findsOneWidget);
    expect(find.bySemanticsLabel('Раздел Главная'), findsOneWidget);

    await tester.tap(find.text('Клиники').last);
    await tester.pumpAndSettle();

    expect(find.text('Clinics content'), findsOneWidget);
    expect(find.bySemanticsLabel('Раздел Клиники'), findsOneWidget);

    semantics.dispose();
  });

  testWidgets('uses semantic Cupertino colors in dark mode', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MediaQuery(
          data: MediaQueryData(
            platformBrightness: Brightness.dark,
            textScaler: TextScaler.linear(1.5),
          ),
          child: OwnerAdaptiveShell(
            platformOverride: TargetPlatform.iOS,
            home: Text('Home content'),
            clinics: Text('Clinics content'),
            appointments: Text('Appointments content'),
            pets: Text('Pets content'),
            profile: Text('Profile content'),
          ),
        ),
      ),
    );

    final theme = CupertinoTheme.of(
      tester.element(find.byType(CupertinoTabScaffold)),
    );
    expect(theme.brightness, Brightness.dark);
    expect(theme.scaffoldBackgroundColor, isA<CupertinoDynamicColor>());
  });

  testWidgets('keeps Material fallback unchanged on Android', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: OwnerAdaptiveShell(
          platformOverride: TargetPlatform.android,
          home: Text('Material home'),
          clinics: Text('iOS clinics'),
        ),
      ),
    );

    expect(find.text('Material home'), findsOneWidget);
    expect(find.text('iOS clinics'), findsNothing);
    expect(find.byType(CupertinoTabBar), findsNothing);
    expect(find.byType(CupertinoTabScaffold), findsNothing);
  });

  testWidgets('adaptive hit target enforces Apple minimum tap area',
      (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: AdaptiveHitTarget(
          semanticLabel: 'Small action',
          child: SizedBox.square(dimension: 8),
        ),
      ),
    );

    final size = tester.getSize(find.byType(AdaptiveHitTarget));
    expect(size.width, greaterThanOrEqualTo(kVetHelpMinTapTarget));
    expect(size.height, greaterThanOrEqualTo(kVetHelpMinTapTarget));
  });
}
