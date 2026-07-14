import 'dart:async';

import 'package:flutter/material.dart';

import 'owner_home_models.dart';
import 'owner_home_repository.dart';
import 'owner_selected_pet_preference.dart';

class OwnerHomeV50Page extends StatefulWidget {
  const OwnerHomeV50Page({
    super.key,
    required this.repository,
    required this.preference,
    required this.ownerId,
    required this.sessionGeneration,
    required this.onPetSelected,
    required this.onManagePets,
    required this.onBrowseClinics,
    required this.onOpenAppointments,
    required this.onOpenCare,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
    required this.onSessionExpired,
  });

  final OwnerHomeRepository repository;
  final OwnerSelectedPetPreference preference;
  final String ownerId;
  final int sessionGeneration;
  final ValueChanged<OwnerHomePet> onPetSelected;
  final VoidCallback onManagePets;
  final VoidCallback onBrowseClinics;
  final VoidCallback onOpenAppointments;
  final VoidCallback onOpenCare;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;
  final VoidCallback onSessionExpired;

  @override
  State<OwnerHomeV50Page> createState() => _OwnerHomeV50PageState();
}

class _OwnerHomeV50PageState extends State<OwnerHomeV50Page>
    with AutomaticKeepAliveClientMixin {
  OwnerHomeSnapshot? _snapshot;
  OwnerHomeException? _error;
  bool _loading = true;
  int _requestGeneration = 0;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    unawaited(_load(usePreference: true));
  }

  @override
  void didUpdateWidget(covariant OwnerHomeV50Page oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ownerId != widget.ownerId ||
        oldWidget.sessionGeneration != widget.sessionGeneration) {
      _requestGeneration++;
      _snapshot = null;
      _error = null;
      _loading = true;
      unawaited(_load(usePreference: true));
    }
  }

  Future<void> _load(
      {bool usePreference = false, String? selectedPetId}) async {
    final generation = ++_requestGeneration;
    final ownerId = widget.ownerId;
    final repository = widget.repository;
    final preference = widget.preference;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    String? requestedId = selectedPetId;
    if (usePreference) {
      requestedId = await preference.read(ownerId);
      if (!mounted || generation != _requestGeneration) return;
    }
    try {
      final snapshot = await repository.read(selectedPetId: requestedId);
      if (!mounted || generation != _requestGeneration) return;
      final requestedIsValid = requestedId == null ||
          snapshot.pets.any((pet) => pet.id == requestedId);
      if (!requestedIsValid) {
        await preference.clear(ownerId);
      }
      final selected = snapshot.selectedPet;
      if (selected == null) {
        await preference.clear(ownerId);
      } else {
        await preference.write(ownerId, selected.id);
        if (!mounted || generation != _requestGeneration) return;
        widget.onPetSelected(selected);
      }
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _snapshot = snapshot;
        _loading = false;
      });
    } on OwnerHomeException catch (error) {
      if (!mounted || generation != _requestGeneration) return;
      if (error.kind == OwnerHomeErrorKind.sessionExpired) {
        setState(() {
          _snapshot = null;
          _error = error;
          _loading = false;
        });
        widget.onSessionExpired();
        await preference.clear(ownerId);
        return;
      }
      setState(() {
        _error = error;
        _loading = false;
      });
    } on Object {
      if (!mounted || generation != _requestGeneration) return;
      setState(() {
        _error = const OwnerHomeException(
          kind: OwnerHomeErrorKind.unavailable,
        );
        _loading = false;
      });
    }
  }

  void _runAction(String code) {
    switch (code) {
      case 'OPEN_EMERGENCY':
        widget.onRequestEmergency();
      case 'OPEN_ALTERNATIVE_SLOT':
      case 'OPEN_APPOINTMENT':
        widget.onOpenAppointments();
      case 'OPEN_TELEMED':
        widget.onRequestTelemed();
      case 'OPEN_CATALOG':
        widget.onBrowseClinics();
      case 'ADD_PET':
        widget.onManagePets();
      case 'NONE':
        break;
      default:
        widget.onOpenAppointments();
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final snapshot = _snapshot;
    return LayoutBuilder(
      builder: (context, constraints) {
        final horizontal = constraints.maxWidth >= 960 ? 40.0 : 20.0;
        return CustomScrollView(
          key: const PageStorageKey('owner-v50-home-scroll'),
          slivers: [
            SliverPadding(
              padding: EdgeInsets.fromLTRB(horizontal, 28, horizontal, 40),
              sliver: SliverToBoxAdapter(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1040),
                    child: snapshot == null && _loading
                        ? const _OwnerHomeSkeleton()
                        : snapshot == null
                            ? _FinalError(
                                sessionExpired: _error?.kind ==
                                    OwnerHomeErrorKind.sessionExpired,
                                onRetry: _load,
                                onEmergency: widget.onRequestEmergency,
                              )
                            : _ReadyHome(
                                snapshot: snapshot,
                                refreshing: _loading,
                                retainedAfterError: _error != null,
                                offline:
                                    _error?.kind == OwnerHomeErrorKind.offline,
                                onRetry: _load,
                                onSelectPet: (pet) =>
                                    _load(selectedPetId: pet.id),
                                onManagePets: widget.onManagePets,
                                onAction: _runAction,
                                onBrowseClinics: widget.onBrowseClinics,
                                onOpenCare: widget.onOpenCare,
                                onRequestTelemed: widget.onRequestTelemed,
                                onRequestInsurance: widget.onRequestInsurance,
                                onEmergency: widget.onRequestEmergency,
                              ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ReadyHome extends StatelessWidget {
  const _ReadyHome({
    required this.snapshot,
    required this.refreshing,
    required this.retainedAfterError,
    required this.offline,
    required this.onRetry,
    required this.onSelectPet,
    required this.onManagePets,
    required this.onAction,
    required this.onBrowseClinics,
    required this.onOpenCare,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onEmergency,
  });

  final OwnerHomeSnapshot snapshot;
  final bool refreshing;
  final bool retainedAfterError;
  final bool offline;
  final VoidCallback onRetry;
  final ValueChanged<OwnerHomePet> onSelectPet;
  final VoidCallback onManagePets;
  final ValueChanged<String> onAction;
  final VoidCallback onBrowseClinics;
  final VoidCallback onOpenCare;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onEmergency;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final selectedPet = snapshot.selectedPet;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text('Главная', style: theme.textTheme.displaySmall),
        ),
        const SizedBox(height: 6),
        Text(
          'Помощь рядом на каждом этапе',
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        if (refreshing) ...[
          const SizedBox(height: 12),
          const LinearProgressIndicator(key: ValueKey('owner-home-refreshing')),
        ],
        if (retainedAfterError) ...[
          const SizedBox(height: 16),
          _StaleNotice(
            offline: offline,
            serverNow: snapshot.serverNow,
            onRetry: onRetry,
          ),
        ],
        const SizedBox(height: 24),
        if (selectedPet == null && !retainedAfterError)
          _NoPetHero(onAddPet: onManagePets)
        else if (selectedPet != null)
          _SelectedPetHero(
            selected: selectedPet,
            pets: snapshot.pets,
            onSelect: onSelectPet,
            onManagePets: onManagePets,
          ),
        const SizedBox(height: 16),
        if (selectedPet != null && !retainedAfterError)
          _NextActionCard(
            action: snapshot.nextAction,
            onPressed: () => onAction(snapshot.nextAction.actionCode),
          ),
        const SizedBox(height: 16),
        if (retainedAfterError)
          const _StaleCareSummary()
        else
          _ActiveCareCard(
            care: selectedPet == null ? null : snapshot.activeCare,
            hasPet: selectedPet != null,
            onPressed: snapshot.activeCare == null
                ? null
                : () => onAction(snapshot.activeCare!.actionCode),
          ),
        const SizedBox(height: 16),
        _EmergencyEntry(onPressed: onEmergency),
        if (selectedPet != null) ...[
          const SizedBox(height: 28),
          Text('Сервисы', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 12),
          _ServiceGrid(
            stale: retainedAfterError,
            onBrowseClinics: onBrowseClinics,
            onTelemed: onRequestTelemed,
            onCare: onOpenCare,
            onInsurance: onRequestInsurance,
          ),
        ],
      ],
    );
  }
}

class _SelectedPetHero extends StatelessWidget {
  const _SelectedPetHero({
    required this.selected,
    required this.pets,
    required this.onSelect,
    required this.onManagePets,
  });

  final OwnerHomePet selected;
  final List<OwnerHomePet> pets;
  final ValueChanged<OwnerHomePet> onSelect;
  final VoidCallback onManagePets;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _Surface(
      key: const ValueKey('owner-home-selected-pet'),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: theme.colorScheme.primaryContainer,
            child:
                Icon(Icons.pets, color: theme.colorScheme.onPrimaryContainer),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Выбранный питомец', style: theme.textTheme.labelLarge),
                const SizedBox(height: 3),
                Text(selected.name, style: theme.textTheme.headlineSmall),
                Text(
                  [selected.breed, selected.species]
                      .whereType<String>()
                      .where((value) => value.isNotEmpty)
                      .join(' · '),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            key: const ValueKey('owner-home-pet-switcher'),
            tooltip: 'Сменить питомца',
            onSelected: (id) {
              if (id == '_manage') return onManagePets();
              onSelect(pets.firstWhere((pet) => pet.id == id));
            },
            itemBuilder: (_) => [
              for (final pet in pets)
                PopupMenuItem(value: pet.id, child: Text(pet.name)),
              const PopupMenuDivider(),
              const PopupMenuItem(value: '_manage', child: Text('Все питомцы')),
            ],
            icon: const Icon(Icons.swap_horiz),
          ),
        ],
      ),
    );
  }
}

class _NoPetHero extends StatelessWidget {
  const _NoPetHero({required this.onAddPet});
  final VoidCallback onAddPet;

  @override
  Widget build(BuildContext context) => _Surface(
        key: const ValueKey('owner-home-no-pets'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Добавьте питомца',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
              'Так мы сможем подобрать подходящую клинику,\nсохранить записи и собрать историю помощи.',
            ),
            const SizedBox(height: 16),
            FilledButton(
                onPressed: onAddPet, child: const Text('Добавить питомца')),
          ],
        ),
      );
}

class _NextActionCard extends StatelessWidget {
  const _NextActionCard({required this.action, required this.onPressed});
  final OwnerHomeAction action;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _Surface(
      key: const ValueKey('owner-home-next-action'),
      emphasized: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Следующий безопасный шаг', style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          Text(action.title, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(action.description),
          if (action.deadlineAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'Срок указан клиникой',
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          if (action.actionCode != 'NONE') ...[
            const SizedBox(height: 16),
            FilledButton(
              key: const ValueKey('owner-home-primary-action'),
              onPressed: onPressed,
              child:
                  Text(action.isSafeFallback ? 'Открыть записи' : action.title),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActiveCareCard extends StatelessWidget {
  const _ActiveCareCard({
    required this.care,
    required this.hasPet,
    required this.onPressed,
  });
  final OwnerHomeActiveCare? care;
  final bool hasPet;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    if (!hasPet) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return _Surface(
      key: const ValueKey('owner-home-active-care'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Актуальная помощь', style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          if (care == null)
            const Text('Сейчас нет действий, требующих вашего внимания.')
          else ...[
            Text(care!.title, style: theme.textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(care!.description),
            if (care!.clinicName != null) ...[
              const SizedBox(height: 6),
              Text(care!.clinicName!, style: theme.textTheme.labelLarge),
            ],
            if (care!.actionCode != 'NONE') ...[
              const SizedBox(height: 12),
              OutlinedButton(
                  onPressed: onPressed, child: const Text('Подробнее')),
            ],
          ],
        ],
      ),
    );
  }
}

class _EmergencyEntry extends StatelessWidget {
  const _EmergencyEntry({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      label: 'Срочная помощь',
      child: Material(
        color: colors.errorContainer,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          key: const ValueKey('owner-home-emergency'),
          borderRadius: BorderRadius.circular(24),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Icon(Icons.emergency_outlined, color: colors.onErrorContainer),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Срочная помощь',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: colors.onErrorContainer,
                            ),
                      ),
                      Text(
                        'Если состояние питомца вызывает опасения',
                        style: TextStyle(color: colors.onErrorContainer),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward, color: colors.onErrorContainer),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ServiceGrid extends StatelessWidget {
  const _ServiceGrid({
    required this.stale,
    required this.onBrowseClinics,
    required this.onTelemed,
    required this.onCare,
    required this.onInsurance,
  });
  final bool stale;
  final VoidCallback onBrowseClinics;
  final VoidCallback onTelemed;
  final VoidCallback onCare;
  final VoidCallback onInsurance;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final textScale = MediaQuery.textScalerOf(context).scale(1);
          final columns =
              constraints.maxWidth >= 760 && textScale < 1.8 ? 4 : 2;
          final items = <(IconData, String, VoidCallback?)>[
            (
              Icons.calendar_month_outlined,
              stale ? 'Посмотреть клиники' : 'Записаться в клинику',
              onBrowseClinics,
            ),
            (
              Icons.video_call_outlined,
              stale ? 'Онлайн-помощь недоступна' : 'Онлайн-помощь',
              stale ? null : onTelemed,
            ),
            (
              Icons.menu_book_outlined,
              stale ? 'Открыть дневник' : 'Дневник питомца',
              onCare,
            ),
            (
              Icons.shield_outlined,
              stale ? 'Страхование недоступно' : 'Страхование',
              stale ? null : onInsurance,
            ),
          ];
          final itemWidth =
              (constraints.maxWidth - (columns - 1) * 12) / columns;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final item in items)
                SizedBox(
                  width: itemWidth,
                  child: _ServiceEntry(
                    icon: item.$1,
                    label: item.$2,
                    onPressed: item.$3,
                  ),
                ),
            ],
          );
        },
      );
}

class _ServiceEntry extends StatelessWidget {
  const _ServiceEntry(
      {required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Material(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onPressed,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 124),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon),
                  const SizedBox(height: 24),
                  Text(label, style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
            ),
          ),
        ),
      );
}

class _StaleCareSummary extends StatelessWidget {
  const _StaleCareSummary();

  @override
  Widget build(BuildContext context) => _Surface(
        key: const ValueKey('owner-home-stale-care'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Статус помощи нужно обновить',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'Подтверждения и действия временно недоступны до связи с сервером.',
            ),
          ],
        ),
      );
}

class _StaleNotice extends StatelessWidget {
  const _StaleNotice(
      {required this.offline, required this.serverNow, required this.onRetry});
  final bool offline;
  final DateTime serverNow;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final utc = serverNow.toUtc();
    final updatedAt =
        '${utc.day.toString().padLeft(2, '0')}.${utc.month.toString().padLeft(2, '0')}, '
        '${utc.hour.toString().padLeft(2, '0')}:${utc.minute.toString().padLeft(2, '0')} UTC';
    return _Surface(
      key: const ValueKey('owner-home-stale'),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '${offline ? 'Нет подключения. ' : ''}Данные могли измениться. '
              'Последнее обновление: $updatedAt',
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Повторить')),
        ],
      ),
    );
  }
}

class _FinalError extends StatelessWidget {
  const _FinalError(
      {required this.sessionExpired,
      required this.onRetry,
      required this.onEmergency});
  final bool sessionExpired;
  final VoidCallback onRetry;
  final VoidCallback onEmergency;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Главная', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          _Surface(
            key: const ValueKey('owner-home-final-error'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sessionExpired
                      ? 'Сессия завершена'
                      : 'Не удалось обновить данные',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(sessionExpired
                    ? 'Войдите снова, чтобы безопасно продолжить.'
                    : 'Проверьте подключение и попробуйте ещё раз.'),
                const SizedBox(height: 16),
                OutlinedButton(
                    onPressed: onRetry, child: const Text('Повторить')),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _EmergencyEntry(onPressed: onEmergency),
        ],
      );
}

class _OwnerHomeSkeleton extends StatelessWidget {
  const _OwnerHomeSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    Widget block(double height) => Container(
          height: height,
          decoration: BoxDecoration(
              color: color, borderRadius: BorderRadius.circular(24)),
        );
    return Column(
      key: const ValueKey('owner-home-skeleton'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: SizedBox(width: 220, child: block(42)),
        ),
        const SizedBox(height: 24),
        block(116),
        const SizedBox(height: 16),
        block(180),
        const SizedBox(height: 16),
        block(126),
        const SizedBox(height: 16),
        block(92),
        const SizedBox(height: 24),
        Row(children: [
          Expanded(child: block(124)),
          const SizedBox(width: 12),
          Expanded(child: block(124))
        ]),
      ],
    );
  }
}

class _Surface extends StatelessWidget {
  const _Surface({super.key, required this.child, this.emphasized = false});
  final Widget child;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color:
            emphasized ? colors.primaryContainer : colors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Padding(padding: const EdgeInsets.all(20), child: child),
    );
  }
}
