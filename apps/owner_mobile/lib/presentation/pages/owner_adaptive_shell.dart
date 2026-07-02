import 'package:flutter/cupertino.dart';

import '../../ui/vethelp_ios_theme.dart';
import '../platform/owner_platform.dart';

class OwnerAdaptiveShell extends StatelessWidget {
  const OwnerAdaptiveShell({
    super.key,
    required this.home,
    required this.clinics,
    required this.appointments,
    required this.pets,
    this.controller,
    this.platformOverride,
  });

  final Widget home;
  final Widget clinics;
  final Widget appointments;
  final Widget pets;
  final CupertinoTabController? controller;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    if (!ownerUsesCupertino(platform: platformOverride)) return home;

    final tabs = <_OwnerShellTab>[
      _OwnerShellTab(
        title: 'Главная',
        icon: CupertinoIcons.house,
        activeIcon: CupertinoIcons.house_fill,
        child: home,
      ),
      _OwnerShellTab(
        title: 'Клиники',
        icon: CupertinoIcons.search,
        activeIcon: CupertinoIcons.search,
        child: clinics,
      ),
      _OwnerShellTab(
        title: 'Записи',
        icon: CupertinoIcons.calendar,
        activeIcon: CupertinoIcons.calendar,
        child: appointments,
      ),
      _OwnerShellTab(
        title: 'Питомцы',
        icon: CupertinoIcons.heart,
        activeIcon: CupertinoIcons.heart_fill,
        child: pets,
      ),
    ];

    return CupertinoTheme(
      data: VetHelpCupertinoTheme.data(context),
      child: CupertinoTabScaffold(
        controller: controller,
        tabBar: CupertinoTabBar(
          items: [
            for (final tab in tabs)
              BottomNavigationBarItem(
                icon: Icon(tab.icon, semanticLabel: 'Вкладка ${tab.title}'),
                activeIcon: Icon(
                  tab.activeIcon,
                  semanticLabel: 'Вкладка ${tab.title}',
                ),
                label: tab.title,
              ),
          ],
        ),
        tabBuilder: (context, index) {
          final tab = tabs[index];
          return CupertinoTabView(
            builder: (context) => Semantics(
              label: 'Раздел ${tab.title}',
              explicitChildNodes: true,
              child: tab.child,
            ),
          );
        },
      ),
    );
  }
}

class _OwnerShellTab {
  const _OwnerShellTab({
    required this.title,
    required this.icon,
    required this.activeIcon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final IconData activeIcon;
  final Widget child;
}
