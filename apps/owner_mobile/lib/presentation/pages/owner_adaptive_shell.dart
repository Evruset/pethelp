import 'dart:ui' as ui;

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../ui/vethelp_ios_theme.dart';
import '../platform/owner_platform.dart';

class OwnerAdaptiveShell extends StatefulWidget {
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
  State<OwnerAdaptiveShell> createState() => _OwnerAdaptiveShellState();
}

class _OwnerAdaptiveShellState extends State<OwnerAdaptiveShell> {
  late final CupertinoTabController _fallbackController;

  CupertinoTabController get _controller =>
      widget.controller ?? _fallbackController;

  @override
  void initState() {
    super.initState();
    _fallbackController = CupertinoTabController();
  }

  @override
  void dispose() {
    _fallbackController.dispose();
    super.dispose();
  }

  List<_OwnerShellTab> get _tabs => <_OwnerShellTab>[
        _OwnerShellTab(
          title: 'Главная',
          subtitle: 'Помощь питомцу',
          icon: CupertinoIcons.house,
          activeIcon: CupertinoIcons.house_fill,
          child: widget.home,
        ),
        _OwnerShellTab(
          title: 'Клиники',
          subtitle: 'Поиск и запись',
          icon: CupertinoIcons.search,
          activeIcon: CupertinoIcons.search_circle_fill,
          child: widget.clinics,
        ),
        _OwnerShellTab(
          title: 'Записи',
          subtitle: 'Визиты и статусы',
          icon: CupertinoIcons.calendar,
          activeIcon: CupertinoIcons.calendar_circle_fill,
          child: widget.appointments,
        ),
        _OwnerShellTab(
          title: 'Питомцы',
          subtitle: 'Профили и медкарта',
          icon: CupertinoIcons.heart,
          activeIcon: CupertinoIcons.heart_fill,
          child: widget.pets,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    if (!ownerUsesCupertino(platform: widget.platformOverride)) {
      return widget.home;
    }

    final tabs = _tabs;
    if (kIsWeb) {
      return _OwnerV50WebShell(
        tabs: tabs,
        controller: _controller,
      );
    }

    return _OwnerMobileTabShell(
      tabs: tabs,
      controller: _controller,
    );
  }
}

class _OwnerMobileTabShell extends StatelessWidget {
  const _OwnerMobileTabShell({
    required this.tabs,
    required this.controller,
  });

  final List<_OwnerShellTab> tabs;
  final CupertinoTabController controller;

  @override
  Widget build(BuildContext context) {
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

class _OwnerV50WebShell extends StatelessWidget {
  const _OwnerV50WebShell({
    required this.tabs,
    required this.controller,
  });

  static const _workspaceMaxWidth = 1760.0;
  static const _desktopBreakpoint = 980.0;

  final List<_OwnerShellTab> tabs;
  final CupertinoTabController controller;

  @override
  Widget build(BuildContext context) {
    return CupertinoTheme(
      data: VetHelpCupertinoTheme.data(context),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < _desktopBreakpoint) {
            return _OwnerMobileTabShell(
              tabs: tabs,
              controller: controller,
            );
          }

          return AnimatedBuilder(
            animation: controller,
            builder: (context, _) {
              final selectedIndex = controller.index;
              return DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFF3F8FF),
                      Color(0xFFEAF2FF),
                      Color(0xFFF8FBFF),
                    ],
                    stops: [0, .52, 1],
                  ),
                ),
                child: Stack(
                  children: [
                    const Positioned(
                      top: -180,
                      right: -120,
                      child: _WebAmbientOrb(
                        diameter: 520,
                        color: Color(0x332D7FF9),
                      ),
                    ),
                    const Positioned(
                      bottom: -240,
                      left: 180,
                      child: _WebAmbientOrb(
                        diameter: 620,
                        color: Color(0x247A5AF8),
                      ),
                    ),
                    SafeArea(
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            maxWidth: _workspaceMaxWidth,
                          ),
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: constraints.maxWidth >= 2560 ? 48 : 24,
                              vertical: 20,
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _OwnerV50Sidebar(
                                  tabs: tabs,
                                  selectedIndex: selectedIndex,
                                  onSelected: (index) {
                                    if (controller.index != index) {
                                      controller.index = index;
                                    }
                                  },
                                ),
                                const SizedBox(width: 20),
                                Expanded(
                                  child: _OwnerV50Workspace(
                                    tabs: tabs,
                                    selectedIndex: selectedIndex,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _OwnerV50Sidebar extends StatelessWidget {
  const _OwnerV50Sidebar({
    required this.tabs,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<_OwnerShellTab> tabs;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    return SizedBox(
      width: 264,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xEFFFFFFF),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: const Color(0xFFD5E3F7)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x16174467),
                  blurRadius: 36,
                  offset: Offset(0, 18),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _OwnerV50Brand(),
                  const SizedBox(height: 28),
                  Text(
                    'ЛИЧНЫЙ КАБИНЕТ',
                    style: textTheme.textStyle.copyWith(
                      color: const Color(0xFF71839D),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.15,
                    ),
                  ),
                  const SizedBox(height: 10),
                  for (var index = 0; index < tabs.length; index++) ...[
                    if (index > 0) const SizedBox(height: 6),
                    _OwnerV50NavItem(
                      tab: tabs[index],
                      selected: selectedIndex == index,
                      onPressed: () => onSelected(index),
                    ),
                  ],
                  const Spacer(),
                  const _OwnerV50TrustCard(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OwnerV50Brand extends StatelessWidget {
  const _OwnerV50Brand();

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    return Row(
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF2E80F7), Color(0xFF1767D9)],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Color(0x3D1767D9),
                blurRadius: 16,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: const SizedBox(
            width: 48,
            height: 48,
            child: Icon(
              CupertinoIcons.heart_fill,
              color: CupertinoColors.white,
              size: 25,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'VetHelp',
                style: textTheme.textStyle.copyWith(
                  color: const Color(0xFF14233D),
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -.6,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Здоровье питомца',
                style: textTheme.textStyle.copyWith(
                  color: const Color(0xFF71839D),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OwnerV50NavItem extends StatelessWidget {
  const _OwnerV50NavItem({
    required this.tab,
    required this.selected,
    required this.onPressed,
  });

  final _OwnerShellTab tab;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final foreground = selected
        ? const Color(0xFF1767D9)
        : const Color(0xFF536781);
    return Semantics(
      button: true,
      selected: selected,
      label: '${tab.title}. ${tab.subtitle}',
      child: CupertinoButton(
        minSize: 56,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        borderRadius: BorderRadius.circular(16),
        color: selected ? const Color(0xFFE5F0FF) : null,
        onPressed: onPressed,
        child: Row(
          children: [
            SizedBox(
              width: 34,
              height: 34,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFFFFFFFF)
                      : const Color(0xFFF1F5FA),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(
                  selected ? tab.activeIcon : tab.icon,
                  color: foreground,
                  size: 19,
                ),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tab.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.textStyle.copyWith(
                      color: foreground,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    tab.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.textStyle.copyWith(
                      color: const Color(0xFF8291A7),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(
                CupertinoIcons.chevron_right,
                color: Color(0xFF1767D9),
                size: 15,
              ),
          ],
        ),
      ),
    );
  }
}

class _OwnerV50TrustCard extends StatelessWidget {
  const _OwnerV50TrustCard();

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFF3F8FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFD9E7F9)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              CupertinoIcons.checkmark_shield_fill,
              color: Color(0xFF2174E8),
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Данные защищены',
                    style: textTheme.textStyle.copyWith(
                      color: const Color(0xFF243754),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Клиника видит только данные текущего маршрута помощи.',
                    style: textTheme.textStyle.copyWith(
                      color: const Color(0xFF71839D),
                      fontSize: 11,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OwnerV50Workspace extends StatelessWidget {
  const _OwnerV50Workspace({
    required this.tabs,
    required this.selectedIndex,
  });

  final List<_OwnerShellTab> tabs;
  final int selectedIndex;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(30),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xF5FFFFFF),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: const Color(0xFFD8E5F5)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1A183B67),
                blurRadius: 42,
                offset: Offset(0, 20),
              ),
            ],
          ),
          child: IndexedStack(
            index: selectedIndex,
            children: [
              for (final tab in tabs)
                Semantics(
                  label: 'Раздел ${tab.title}',
                  explicitChildNodes: true,
                  child: tab.child,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WebAmbientOrb extends StatelessWidget {
  const _WebAmbientOrb({
    required this.diameter,
    required this.color,
  });

  final double diameter;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ImageFiltered(
        imageFilter: ui.ImageFilter.blur(sigmaX: 80, sigmaY: 80),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
          child: SizedBox.square(dimension: diameter),
        ),
      ),
    );
  }
}

class _OwnerShellTab {
  const _OwnerShellTab({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.activeIcon,
    required this.child,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final IconData activeIcon;
  final Widget child;
}
