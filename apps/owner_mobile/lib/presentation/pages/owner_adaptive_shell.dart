import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';

import '../../ui/vethelp_ios_theme.dart';

class OwnerAdaptiveShell extends StatelessWidget {
  const OwnerAdaptiveShell({
    super.key,
    required this.home,
    this.clinics,
    this.appointments,
    this.pets,
    this.profile,
    this.platformOverride,
  });

  final Widget home;
  final Widget? clinics;
  final Widget? appointments;
  final Widget? pets;
  final Widget? profile;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    final platform = platformOverride ?? defaultTargetPlatform;
    if (platform != TargetPlatform.iOS) return home;

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
        child: clinics ?? const _OwnerShellPlaceholder(title: 'Клиники'),
      ),
      _OwnerShellTab(
        title: 'Записи',
        icon: CupertinoIcons.calendar,
        activeIcon: CupertinoIcons.calendar,
        child: appointments ?? const _OwnerShellPlaceholder(title: 'Записи'),
      ),
      _OwnerShellTab(
        title: 'Питомцы',
        icon: CupertinoIcons.heart,
        activeIcon: CupertinoIcons.heart_fill,
        child: pets ?? const _OwnerShellPlaceholder(title: 'Питомцы'),
      ),
      _OwnerShellTab(
        title: 'Профиль',
        icon: CupertinoIcons.person,
        activeIcon: CupertinoIcons.person_fill,
        child: profile ?? const _OwnerShellPlaceholder(title: 'Профиль'),
      ),
    ];

    return CupertinoTheme(
      data: VetHelpCupertinoTheme.data(context),
      child: CupertinoTabScaffold(
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
            builder: (context) => CupertinoPageScaffold(
              navigationBar: CupertinoNavigationBar(
                middle: Text(tab.title),
                transitionBetweenRoutes: false,
              ),
              child: SafeArea(
                bottom: false,
                child: Semantics(
                  label: 'Раздел ${tab.title}',
                  explicitChildNodes: true,
                  child: tab.child,
                ),
              ),
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

class _OwnerShellPlaceholder extends StatelessWidget {
  const _OwnerShellPlaceholder({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          title,
          textAlign: TextAlign.center,
          style: CupertinoTheme.of(context).textTheme.navTitleTextStyle,
        ),
      ),
    );
  }
}
