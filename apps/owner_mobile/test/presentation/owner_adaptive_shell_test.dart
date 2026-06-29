import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';

void main() {
  testWidgets('renders Cupertino tabs on iOS', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: OwnerAdaptiveShell(
          platformOverride: TargetPlatform.iOS,
          home: Text('Home content'),
          clinics: Text('Clinics content'),
          appointments: Text('Appointments content'),
          pets: Text('Pets content'),
          profile: Text('Profile content'),
        ),
      ),
    );

    expect(find.byType(CupertinoTabScaffold), findsOneWidget);
    expect(find.byType(CupertinoTabBar), findsOneWidget);
    expect(find.text('Главная'), findsWidgets);
    expect(find.text('Клиники'), findsWidgets);
    expect(find.text('Записи'), findsWidgets);
    expect(find.text('Питомцы'), findsWidgets);
    expect(find.text('Профиль'), findsWidgets);

    await tester.tap(find.text('Клиники'));
    await tester.pumpAndSettle();

    expect(find.text('Clinics content'), findsOneWidget);
    expect(find.bySemanticsLabel('Раздел Клиники'), findsOneWidget);
  });

  testWidgets('does not render Material components in iOS shell',
      (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: OwnerAdaptiveShell(
          platformOverride: TargetPlatform.iOS,
          home: Text('Home content'),
        ),
      ),
    );

    expect(find.byType(CupertinoTabScaffold), findsOneWidget);
    expect(find.byType(Material), findsNothing);
    expect(find.byType(Scaffold), findsNothing);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('keeps Android fallback as Material subtree without Cupertino',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: OwnerAdaptiveShell(
          platformOverride: TargetPlatform.android,
          home: Scaffold(body: Text('Material home')),
          clinics: Text('iOS clinics'),
        ),
      ),
    );

    expect(find.text('Material home'), findsOneWidget);
    expect(find.byType(Scaffold), findsOneWidget);
    expect(find.text('iOS clinics'), findsNothing);
    expect(find.byType(CupertinoTabScaffold), findsNothing);
    expect(find.byType(CupertinoTabBar), findsNothing);
  });

  testWidgets('adapts Cupertino theme to dark mode', (tester) async {
    await tester.pumpWidget(
      const CupertinoApp(
        home: MediaQuery(
          data: MediaQueryData(
            platformBrightness: Brightness.dark,
            textScaler: TextScaler.linear(1.4),
          ),
          child: OwnerAdaptiveShell(
            platformOverride: TargetPlatform.iOS,
            home: Text('Home content'),
          ),
        ),
      ),
    );

    final theme = CupertinoTheme.of(
      tester.element(find.byType(CupertinoTabScaffold)),
    );

    expect(theme.brightness, Brightness.dark);
    expect(theme.scaffoldBackgroundColor, isA<CupertinoDynamicColor>());
    expect(theme.primaryColor, isA<CupertinoDynamicColor>());
  });
}
