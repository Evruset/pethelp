import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

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

enum OwnerShellViewState { content, loading, error, sessionExpired }

/// Canonical V50 Owner shell.
///
/// Business pages remain injected children so the shell owns only responsive
/// navigation, application context and fail-safe presentation states.
class OwnerV50AdaptiveShell extends StatelessWidget {
  const OwnerV50AdaptiveShell({
    super.key,
    required this.home,
    required this.clinics,
    required this.appointments,
    required this.pets,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.onEmergency,
    this.onNotifications,
    this.onPetContextPressed,
    this.selectedPetName,
    this.notificationCount = 0,
    this.viewState = OwnerShellViewState.content,
    this.onRetry,
    this.onSignIn,
    this.restorationId = 'owner-v50-shell',
  }) : assert(selectedIndex >= 0 && selectedIndex < 4);

  static const mobileMaxWidth = 767.0;
  static const desktopMinWidth = 1121.0;
  static const locations = <String>[
    '/home',
    '/clinics',
    '/appointments',
    '/pets',
  ];

  final Widget home;
  final Widget clinics;
  final Widget appointments;
  final Widget pets;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onEmergency;
  final VoidCallback? onNotifications;
  final VoidCallback? onPetContextPressed;
  final String? selectedPetName;
  final int notificationCount;
  final OwnerShellViewState viewState;
  final VoidCallback? onRetry;
  final VoidCallback? onSignIn;
  final String restorationId;

  static int indexForLocation(String location) {
    final path = Uri.tryParse(location)?.path ?? location;
    final index = locations.indexWhere(
      (candidate) => path == candidate || path.startsWith('$candidate/'),
    );
    return index < 0 ? 0 : index;
  }

  static String locationForIndex(int index) =>
      index >= 0 && index < locations.length ? locations[index] : locations[0];

  static const _destinations = <_V50Destination>[
    _V50Destination('Главная', Icons.home_outlined, Icons.home),
    _V50Destination('Клиники', Icons.search, Icons.search),
    _V50Destination(
      'Записи',
      Icons.calendar_month_outlined,
      Icons.calendar_month,
    ),
    _V50Destination('Питомцы', Icons.pets_outlined, Icons.pets),
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        if (width >= desktopMinWidth) return _desktop(context);
        if (width > mobileMaxWidth) return _tablet(context);
        return _mobile(context);
      },
    );
  }

  Widget _mobile(BuildContext context) {
    return Scaffold(
      key: const ValueKey('owner-v50-mobile-shell'),
      restorationId: restorationId,
      appBar: AppBar(
        titleSpacing: 16,
        title: _PetContextButton(
          selectedPetName: selectedPetName,
          onPressed: onPetContextPressed,
        ),
        actions: _headerActions(context, compact: true),
      ),
      body: SafeArea(child: _content()),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: onDestinationSelected,
        destinations: [
          for (final destination in _destinations)
            NavigationDestination(
              icon: Icon(destination.icon),
              selectedIcon: Icon(destination.selectedIcon),
              label: destination.label,
              tooltip: 'Открыть раздел ${destination.label}',
            ),
        ],
      ),
    );
  }

  Widget _tablet(BuildContext context) {
    return Scaffold(
      key: const ValueKey('owner-v50-tablet-shell'),
      restorationId: restorationId,
      body: SafeArea(
        child: Row(
          children: [
            NavigationRail(
              selectedIndex: selectedIndex,
              onDestinationSelected: onDestinationSelected,
              labelType: NavigationRailLabelType.all,
              leading: const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: _OwnerBrand(compact: true),
              ),
              trailing: Expanded(
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: IconButton.filledTonal(
                      onPressed: onEmergency,
                      tooltip: 'Срочная помощь',
                      icon: const Icon(Icons.emergency_outlined),
                    ),
                  ),
                ),
              ),
              destinations: [
                for (final destination in _destinations)
                  NavigationRailDestination(
                    icon: Icon(destination.icon),
                    selectedIcon: Icon(destination.selectedIcon),
                    label: Text(destination.label),
                  ),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(
              child: Column(
                children: [
                  _ShellHeader(
                    selectedPetName: selectedPetName,
                    onPetContextPressed: onPetContextPressed,
                    actions: _headerActions(context),
                  ),
                  Expanded(child: _content()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _desktop(BuildContext context) {
    final tokens = Theme.of(context).extension<VetHelpSurfaceTokens>()!;
    return Scaffold(
      key: const ValueKey('owner-v50-desktop-shell'),
      restorationId: restorationId,
      backgroundColor: tokens.desktopBackdrop,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1600),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surface,
                    border: Border.all(color: tokens.hairline),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 240,
                        child: _DesktopNavigation(
                          selectedIndex: selectedIndex,
                          onDestinationSelected: onDestinationSelected,
                          onEmergency: onEmergency,
                        ),
                      ),
                      const VerticalDivider(width: 1),
                      Expanded(
                        child: Column(
                          children: [
                            _ShellHeader(
                              selectedPetName: selectedPetName,
                              onPetContextPressed: onPetContextPressed,
                              actions: _headerActions(context),
                            ),
                            Expanded(child: _content()),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _headerActions(BuildContext context, {bool compact = false}) {
    final countLabel =
        notificationCount > 0 ? ', $notificationCount новых' : '';
    return [
      IconButton(
        onPressed: onNotifications,
        tooltip: 'Уведомления$countLabel',
        icon: Badge(
          isLabelVisible: notificationCount > 0,
          label: Text(notificationCount > 99 ? '99+' : '$notificationCount'),
          child: const Icon(Icons.notifications_outlined),
        ),
      ),
      if (compact)
        IconButton(
          onPressed: onEmergency,
          tooltip: 'Срочная помощь',
          color: Theme.of(context).colorScheme.error,
          icon: const Icon(Icons.emergency_outlined),
        ),
      const SizedBox(width: 8),
    ];
  }

  Widget _content() {
    switch (viewState) {
      case OwnerShellViewState.loading:
        return const _ShellState(
          icon: Icons.hourglass_top,
          title: 'Загружаем данные',
          message: 'Проверяем актуальный контекст питомца и записи.',
          busy: true,
        );
      case OwnerShellViewState.error:
        return _ShellState(
          icon: Icons.cloud_off_outlined,
          title: 'Не удалось загрузить данные',
          message: 'Проверьте подключение и повторите попытку.',
          actionLabel: 'Повторить',
          onAction: onRetry,
        );
      case OwnerShellViewState.sessionExpired:
        return _ShellState(
          icon: Icons.lock_clock_outlined,
          title: 'Сессия завершена',
          message: 'Войдите снова, чтобы продолжить безопасную работу.',
          actionLabel: 'Войти снова',
          onAction: onSignIn,
        );
      case OwnerShellViewState.content:
        return _LazyOwnerDestinationStack(
          selectedIndex: selectedIndex,
          destinations: [home, clinics, appointments, pets],
        );
    }
  }
}

/// Mounts a domain destination only after its first selection, then keeps it
/// alive so switching tabs does not repeat page-level reads or lose page state.
class _LazyOwnerDestinationStack extends StatefulWidget {
  const _LazyOwnerDestinationStack({
    required this.selectedIndex,
    required this.destinations,
  });

  final int selectedIndex;
  final List<Widget> destinations;

  @override
  State<_LazyOwnerDestinationStack> createState() =>
      _LazyOwnerDestinationStackState();
}

class _LazyOwnerDestinationStackState
    extends State<_LazyOwnerDestinationStack> {
  late final Set<int> _visited = {widget.selectedIndex};

  @override
  void didUpdateWidget(covariant _LazyOwnerDestinationStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    _visited.add(widget.selectedIndex);
  }

  @override
  Widget build(BuildContext context) {
    return IndexedStack(
      index: widget.selectedIndex,
      children: List.generate(widget.destinations.length, (index) {
        if (!_visited.contains(index)) return const SizedBox.shrink();
        return KeyedSubtree(
          key: ValueKey('owner-v50-destination-$index'),
          child: widget.destinations[index],
        );
      }),
    );
  }
}

class _V50Destination {
  const _V50Destination(this.label, this.icon, this.selectedIcon);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class _OwnerBrand extends StatelessWidget {
  const _OwnerBrand({this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      label: 'VetHelp, приложение владельца питомца',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.pets),
          if (!compact) ...[
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                'VetHelp',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PetContextButton extends StatelessWidget {
  const _PetContextButton({this.selectedPetName, this.onPressed});

  final String? selectedPetName;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final label = selectedPetName?.trim().isNotEmpty == true
        ? selectedPetName!.trim()
        : 'Выберите питомца';
    return TextButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.pets_outlined),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}

class _ShellHeader extends StatelessWidget {
  const _ShellHeader({
    required this.selectedPetName,
    required this.onPetContextPressed,
    required this.actions,
  });

  final String? selectedPetName;
  final VoidCallback? onPetContextPressed;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      child: SizedBox(
        height: 72,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            children: [
              Expanded(
                child: _PetContextButton(
                  selectedPetName: selectedPetName,
                  onPressed: onPetContextPressed,
                ),
              ),
              ...actions,
            ],
          ),
        ),
      ),
    );
  }
}

class _DesktopNavigation extends StatelessWidget {
  const _DesktopNavigation({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.onEmergency,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onEmergency;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: _OwnerBrand(),
          ),
          const SizedBox(height: 24),
          for (var index = 0;
              index < OwnerV50AdaptiveShell._destinations.length;
              index++)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Semantics(
                selected: selectedIndex == index,
                child: ListTile(
                  selected: selectedIndex == index,
                  leading: Icon(
                    selectedIndex == index
                        ? OwnerV50AdaptiveShell
                            ._destinations[index].selectedIcon
                        : OwnerV50AdaptiveShell._destinations[index].icon,
                  ),
                  title: Text(
                    OwnerV50AdaptiveShell._destinations[index].label,
                  ),
                  onTap: () => onDestinationSelected(index),
                ),
              ),
            ),
          const Spacer(),
          FilledButton.tonalIcon(
            onPressed: onEmergency,
            icon: const Icon(Icons.emergency_outlined),
            label: const Text('Срочная помощь'),
            style: FilledButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShellState extends StatelessWidget {
  const _ShellState({
    required this.icon,
    required this.title,
    required this.message,
    this.busy = false,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final bool busy;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Semantics(
        container: true,
        liveRegion: true,
        label: '$title. $message',
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (busy)
                  const CircularProgressIndicator()
                else
                  Icon(icon, size: 40),
                const SizedBox(height: 20),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(message, textAlign: TextAlign.center),
                if (actionLabel != null) ...[
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: onAction,
                    child: Text(actionLabel!),
                  ),
                ],
              ],
            ),
          ),
        ),
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
