import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/presentation/pages/owner_adaptive_shell.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  testWidgets('V50 shell selects mobile, tablet and desktop navigation',
      (tester) async {
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    tester.view.devicePixelRatio = 1;

    await _pumpAt(tester, const Size(375, 812));
    expect(
        find.byKey(const ValueKey('owner-v50-mobile-shell')), findsOneWidget);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);

    await _pumpAt(tester, const Size(768, 1024));
    expect(
        find.byKey(const ValueKey('owner-v50-tablet-shell')), findsOneWidget);
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);

    await _pumpAt(tester, const Size(1440, 900));
    expect(
        find.byKey(const ValueKey('owner-v50-desktop-shell')), findsOneWidget);
    expect(find.text('VetHelp'), findsOneWidget);
    expect(find.text('Срочная помощь'), findsOneWidget);
  });

  testWidgets('selected destination, pet and application actions are exposed',
      (tester) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    var selected = -1;
    var emergency = false;

    await tester.pumpWidget(
      _harness(
        selectedIndex: 1,
        selectedPetName: 'Барни с очень длинным именем для проверки масштаба',
        notificationCount: 3,
        onDestinationSelected: (index) => selected = index,
        onEmergency: () => emergency = true,
      ),
    );

    expect(find.text('Clinics content'), findsOneWidget);
    expect(find.byTooltip('Уведомления, 3 новых'), findsOneWidget);
    expect(find.byTooltip('Срочная помощь'), findsOneWidget);

    await tester.tap(find.text('Записи').last);
    expect(selected, 2);
    await tester.tap(find.byTooltip('Срочная помощь'));
    expect(emergency, isTrue);
  });

  testWidgets('domain destinations mount lazily and remain cached',
      (tester) async {
    final mounts = List<int>.filled(4, 0);
    final destinations = List<Widget>.generate(
      4,
      (index) => _MountProbe(onMount: () => mounts[index] += 1),
    );

    await tester.pumpWidget(
      _harness(
        selectedIndex: 0,
        home: destinations[0],
        clinics: destinations[1],
        appointments: destinations[2],
        pets: destinations[3],
      ),
    );
    expect(mounts, [1, 0, 0, 0]);

    await tester.pumpWidget(
      _harness(
        selectedIndex: 1,
        home: destinations[0],
        clinics: destinations[1],
        appointments: destinations[2],
        pets: destinations[3],
      ),
    );
    expect(mounts, [1, 1, 0, 0]);

    await tester.pumpWidget(
      _harness(
        selectedIndex: 0,
        home: destinations[0],
        clinics: destinations[1],
        appointments: destinations[2],
        pets: destinations[3],
      ),
    );
    expect(mounts, [1, 1, 0, 0]);
  });

  testWidgets('shell states remain usable with large text and reduced motion',
      (tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          textScaler: TextScaler.linear(1.8),
          disableAnimations: true,
        ),
        child: _harness(viewState: OwnerShellViewState.error),
      ),
    );

    expect(find.text('Не удалось загрузить данные'), findsOneWidget);
    expect(find.text('Повторить'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(
      _harness(viewState: OwnerShellViewState.sessionExpired),
    );
    expect(find.text('Сессия завершена'), findsOneWidget);
    expect(find.text('Войти снова'), findsOneWidget);
  });

  test('shell routes support deep-link selection with a safe fallback', () {
    expect(OwnerV50AdaptiveShell.indexForLocation('/appointments/active'), 2);
    expect(OwnerV50AdaptiveShell.indexForLocation('/pets'), 3);
    expect(OwnerV50AdaptiveShell.indexForLocation('/unknown'), 0);
    expect(OwnerV50AdaptiveShell.locationForIndex(1), '/clinics');
    expect(OwnerV50AdaptiveShell.locationForIndex(99), '/home');
  });
}

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  await tester.pumpWidget(_harness());
  await tester.pump();
}

Widget _harness({
  int selectedIndex = 0,
  String? selectedPetName,
  int notificationCount = 0,
  OwnerShellViewState viewState = OwnerShellViewState.content,
  ValueChanged<int>? onDestinationSelected,
  VoidCallback? onEmergency,
  Widget home = const Text('Home content'),
  Widget clinics = const Text('Clinics content'),
  Widget appointments = const Text('Appointments content'),
  Widget pets = const Text('Pets content'),
}) {
  return MaterialApp(
    theme: VetHelpTheme.light(),
    home: OwnerV50AdaptiveShell(
      selectedIndex: selectedIndex,
      onDestinationSelected: onDestinationSelected ?? (_) {},
      selectedPetName: selectedPetName,
      notificationCount: notificationCount,
      onEmergency: onEmergency ?? () {},
      onNotifications: () {},
      onPetContextPressed: () {},
      viewState: viewState,
      onRetry: () {},
      onSignIn: () {},
      home: home,
      clinics: clinics,
      appointments: appointments,
      pets: pets,
    ),
  );
}

class _MountProbe extends StatefulWidget {
  const _MountProbe({required this.onMount});

  final VoidCallback onMount;

  @override
  State<_MountProbe> createState() => _MountProbeState();
}

class _MountProbeState extends State<_MountProbe> {
  @override
  void initState() {
    super.initState();
    widget.onMount();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
