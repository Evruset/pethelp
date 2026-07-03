import 'dart:ui' as ui;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../appointments/owner_appointments_page.dart';
import '../appointments/owner_appointments_repository.dart';
import '../booking/alternative_slot/alternative_slot_repository.dart';
import '../pets/owner_pet.dart';
import '../pets/owner_pet_repository.dart';
import '../pets/owner_pets_page.dart';
import '../../presentation/platform/owner_platform.dart';
import '../../presentation/widgets/owner_cupertino_feedback.dart';

class OwnerJourneyPage extends StatefulWidget {
  const OwnerJourneyPage({
    super.key,
    required this.onBrowseClinics,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
    required this.onOpenCare,
    required this.petsRepository,
    required this.appointmentsRepository,
    required this.alternativeSlotRepository,
    required this.selectedPet,
    required this.onPetSelected,
  });

  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;
  final VoidCallback onOpenCare;
  final OwnerPetRepository petsRepository;
  final OwnerAppointmentsRepository appointmentsRepository;
  final AlternativeSlotRepository alternativeSlotRepository;
  final OwnerPet? selectedPet;
  final ValueChanged<OwnerPet> onPetSelected;

  @override
  State<OwnerJourneyPage> createState() => _OwnerJourneyPageState();
}

class _OwnerJourneyPageState extends State<OwnerJourneyPage> {
  int _index = 0;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home),
        label: 'Главная'),
    NavigationDestination(
        icon: Icon(Icons.calendar_month_outlined),
        selectedIcon: Icon(Icons.calendar_month),
        label: 'Записи'),
    NavigationDestination(
        icon: Icon(Icons.pets_outlined),
        selectedIcon: Icon(Icons.pets),
        label: 'Питомец'),
    NavigationDestination(
        icon: Icon(Icons.video_call_outlined),
        selectedIcon: Icon(Icons.video_call),
        label: 'Онлайн'),
  ];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final wide = _usesWideMaterialLayout(width);
    return Scaffold(
      appBar: AppBar(
        title: const Text('VetHelp'),
        actions: [
          IconButton(
            tooltip: 'Уведомления',
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text(
                      'Уведомления появятся здесь после входа по номеру телефона.')),
            ),
            icon: const Icon(Icons.notifications_none),
          ),
        ],
      ),
      body: SafeArea(
        child: wide
            ? Stack(
                children: [
                  Positioned.fill(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 132),
                      child: _body(),
                    ),
                  ),
                  Positioned(
                    left: 32,
                    right: 32,
                    bottom: 24,
                    child: _MaterialFloatingDock(
                      selectedIndex: _index,
                      destinations: _destinations,
                      onDestinationSelected: (index) =>
                          setState(() => _index = index),
                    ),
                  ),
                ],
              )
            : _body(),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (index) => setState(() => _index = index),
              destinations: _destinations,
            ),
    );
  }

  Widget _body() => switch (_index) {
        0 => OwnerHomePage(
            selectedPet: widget.selectedPet,
            appointmentsRepository: widget.appointmentsRepository,
            petsRepository: widget.petsRepository,
            onBrowseClinics: widget.onBrowseClinics,
            onManagePets: () => setState(() => _index = 2),
            onPetSelected: widget.onPetSelected,
            onOpenAppointments: () => setState(() => _index = 1),
            onOpenCare: widget.onOpenCare,
            onRequestTelemed: widget.onRequestTelemed,
            onRequestInsurance: widget.onRequestInsurance,
            onRequestEmergency: widget.onRequestEmergency,
          ),
        1 => OwnerAppointmentsPage(
            repository: widget.appointmentsRepository,
            alternativeSlotRepository: widget.alternativeSlotRepository,
          ),
        2 => OwnerPetsPage(
            repository: widget.petsRepository,
            onPetSelected: (pet) {
              widget.onPetSelected(pet);
              setState(() {
                _index = 0;
              });
            },
          ),
        3 => _TelemedLanding(onRequestTelemed: widget.onRequestTelemed),
        _ => const SizedBox.shrink(),
      };
}

class _MaterialFloatingDock extends StatelessWidget {
  const _MaterialFloatingDock({
    required this.selectedIndex,
    required this.destinations,
    required this.onDestinationSelected,
  });

  final int selectedIndex;
  final List<NavigationDestination> destinations;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final background = Color.alphaBlend(
      colorScheme.primaryContainer.withValues(alpha: 0.10),
      colorScheme.surface.withValues(alpha: 0.86),
    );
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 940),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(44),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: DecoratedBox(
              key: const ValueKey('owner-web-bottom-dock'),
              decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadius.circular(44),
                border: Border.all(
                  color: colorScheme.outlineVariant.withValues(alpha: 0.55),
                ),
                boxShadow: [
                  BoxShadow(
                    color: colorScheme.shadow.withValues(alpha: 0.10),
                    blurRadius: 28,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  children: [
                    for (var index = 0; index < destinations.length; index++)
                      Expanded(
                        child: _MaterialFloatingDockItem(
                          destination: destinations[index],
                          selected: index == selectedIndex,
                          onPressed: () => onDestinationSelected(index),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MaterialFloatingDockItem extends StatelessWidget {
  const _MaterialFloatingDockItem({
    required this.destination,
    required this.selected,
    required this.onPressed,
  });

  final NavigationDestination destination;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final foreground =
        selected ? colorScheme.primary : colorScheme.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: selected,
      label: destination.label,
      child: Tooltip(
        message: destination.label,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(34),
            onTap: onPressed,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 76),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOutCubic,
                      width: 64,
                      height: 42,
                      decoration: BoxDecoration(
                        color: selected
                            ? colorScheme.primaryContainer.withValues(
                                alpha: 0.72,
                              )
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: IconTheme(
                        data: IconThemeData(color: foreground, size: 28),
                        child: Center(
                          child: selected
                              ? destination.selectedIcon
                              : destination.icon,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      destination.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: foreground,
                            fontWeight:
                                selected ? FontWeight.w700 : FontWeight.w600,
                            letterSpacing: 0,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class OwnerHomePage extends StatefulWidget {
  const OwnerHomePage({
    super.key,
    required this.selectedPet,
    required this.appointmentsRepository,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onOpenAppointments,
    required this.onOpenCare,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
    this.petsRepository,
    this.onPetSelected,
    this.platformOverride,
  });

  final OwnerPet? selectedPet;
  final OwnerAppointmentsRepository appointmentsRepository;
  final OwnerPetRepository? petsRepository;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onOpenAppointments;
  final VoidCallback onOpenCare;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;
  final ValueChanged<OwnerPet>? onPetSelected;
  final TargetPlatform? platformOverride;

  @override
  State<OwnerHomePage> createState() => _OwnerHomePageState();
}

class _OwnerHomePageState extends State<OwnerHomePage> {
  Future<List<OwnerAppointment>>? _appointmentsRequest;
  Future<List<OwnerPet>>? _petsRequest;

  @override
  void initState() {
    super.initState();
    _reloadAppointments();
    _reloadPets();
  }

  void _reloadAppointments() {
    setState(() {
      _appointmentsRequest = widget.appointmentsRepository.list();
    });
  }

  void _reloadPets() {
    final repository = widget.petsRepository;
    if (repository == null) return;
    setState(() {
      _petsRequest = repository.list();
    });
  }

  Future<void> _editSelectedPet() async {
    final repository = widget.petsRepository;
    final pet = widget.selectedPet;
    final onPetSelected = widget.onPetSelected;
    if (repository == null || pet == null || onPetSelected == null) {
      widget.onManagePets();
      return;
    }
    final result = await showOwnerPetEditorBottomSheet(
      context: context,
      repository: repository,
      pet: pet,
      onFallbackSnapshot: () {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Открыта последняя загруженная версия. Изменения будут поставлены в очередь.',
            ),
          ),
        );
      },
    );
    if (!mounted || result == null) return;
    switch (result) {
      case OwnerPetSaved(:final pet):
        onPetSelected(pet);
        _reloadPets();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Профиль ${pet.name} обновлён.')),
        );
      case OwnerPetUpdateQueued():
        _reloadPets();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Изменения сохранены в очередь и синхронизируются при соединении.',
            ),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (ownerUsesCupertino(platform: widget.platformOverride)) {
      return _buildCupertino(context);
    }

    final pet = widget.selectedPet;
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = _usesWideMaterialLayout(constraints.maxWidth);
        final content = _MaterialHomeContent(
          selectedPet: pet,
          petsRequest: _petsRequest,
          appointmentsRequest: _appointmentsRequest,
          wide: wide,
          onRetryAppointments: _reloadAppointments,
          onBrowseClinics: widget.onBrowseClinics,
          onManagePets: widget.onManagePets,
          onEditPet: _editSelectedPet,
          onPetSelected: widget.onPetSelected,
          onOpenAppointments: widget.onOpenAppointments,
          onRequestTelemed: widget.onRequestTelemed,
          onRequestInsurance: widget.onRequestInsurance,
          onRequestEmergency: widget.onRequestEmergency,
        );
        return ListView(
          padding: EdgeInsets.symmetric(
            horizontal: wide ? 40 : 20,
            vertical: wide ? 28 : 20,
          ),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: wide ? 1240 : 760),
                child: content,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCupertino(BuildContext context) {
    final pet = widget.selectedPet;
    final groupedBackground = CupertinoDynamicColor.resolve(
      CupertinoColors.systemGroupedBackground,
      context,
    );
    final textTheme = CupertinoTheme.of(context).textTheme;

    return ColoredBox(
      color: groupedBackground,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Semantics(
            header: true,
            child: Text(
              'Помощь питомцу — в одном месте',
              style: textTheme.navLargeTitleTextStyle,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Запись, онлайн-консультация, страховая проверка и история питомца.',
            style: textTheme.textStyle.copyWith(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.secondaryLabel,
                context,
              ),
            ),
          ),
          const SizedBox(height: 18),
          _CupertinoHomeAction(
            icon: CupertinoIcons.exclamationmark_triangle_fill,
            title: 'Срочная помощь',
            subtitle:
                'Покажем клиники, которые принимают срочные случаи сейчас.',
            semanticLabel:
                'Срочная помощь. Открыть список срочных клиник сейчас.',
            tone: _CupertinoHomeActionTone.warning,
            onPressed: widget.onRequestEmergency,
          ),
          const SizedBox(height: 12),
          _CupertinoActiveAppointmentsPreview(
            request: _appointmentsRequest,
            selectedPet: pet,
            onRetry: _reloadAppointments,
            onBrowseClinics: widget.onBrowseClinics,
            onManagePets: widget.onManagePets,
            onOpenAppointments: widget.onOpenAppointments,
          ),
          const SizedBox(height: 12),
          _CupertinoHomeAction(
            icon: CupertinoIcons.heart,
            title: pet?.name ?? 'Питомец ещё не добавлен',
            subtitle: pet == null
                ? 'Добавьте питомца перед записью.'
                : 'Выбран для новой записи.',
            semanticLabel: pet == null
                ? 'Питомец ещё не добавлен. Добавить питомца.'
                : 'Выбран питомец ${pet.name}. Открыть профиль питомца.',
            onPressed: widget.onManagePets,
          ),
          const SizedBox(height: 12),
          _CupertinoHomeAction(
            icon: CupertinoIcons.doc_text,
            title: 'Медицинская карта',
            subtitle: pet == null
                ? 'Добавьте питомца, чтобы видеть профиль здоровья, документы и историю помощи.'
                : 'Профиль здоровья, документы и история помощи для ${pet.name}.',
            semanticLabel: pet == null
                ? 'Медицинская карта. Сначала добавьте питомца.'
                : 'Медицинская карта для ${pet.name}. Открыть.',
            onPressed: pet == null ? widget.onManagePets : widget.onOpenCare,
          ),
          const SizedBox(height: 12),
          _CupertinoHomeAction(
            icon: CupertinoIcons.shield,
            title: 'Страховое покрытие',
            subtitle: 'Проверьте покрытие у партнёра после согласия владельца.',
            semanticLabel: 'Страховое покрытие. Открыть проверку покрытия.',
            onPressed: widget.onRequestInsurance,
          ),
          const SizedBox(height: 12),
          _CupertinoHomeAction(
            icon: CupertinoIcons.video_camera,
            title: 'Ветеринар онлайн',
            subtitle:
                'Опишите вопрос, приложите файлы и получите следующий безопасный шаг.',
            semanticLabel: 'Ветеринар онлайн. Описать вопрос для консультации.',
            onPressed: widget.onRequestTelemed,
          ),
        ],
      ),
    );
  }
}

enum _CupertinoHomeActionTone { normal, warning }

class _CupertinoHomeAction extends StatelessWidget {
  const _CupertinoHomeAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onPressed,
    this.semanticLabel,
    this.tone = _CupertinoHomeActionTone.normal,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onPressed;
  final String? semanticLabel;
  final _CupertinoHomeActionTone tone;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final isWarning = tone == _CupertinoHomeActionTone.warning;
    final background = CupertinoDynamicColor.resolve(
      isWarning
          ? CupertinoColors.systemRed.withValues(alpha: 0.12)
          : CupertinoColors.secondarySystemGroupedBackground,
      context,
    );
    final border = CupertinoDynamicColor.resolve(
      isWarning ? CupertinoColors.systemRed : CupertinoColors.separator,
      context,
    );
    final iconColor = CupertinoDynamicColor.resolve(
      isWarning ? CupertinoColors.systemRed : CupertinoColors.activeBlue,
      context,
    );
    final labelColor = CupertinoDynamicColor.resolve(
      CupertinoColors.label,
      context,
    );
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );

    return Semantics(
      button: true,
      label: semanticLabel ?? '$title. $subtitle',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 72),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(icon, color: iconColor, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: textTheme.textStyle.copyWith(
                            color: labelColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          style: textTheme.textStyle.copyWith(
                            color: secondaryLabel,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    CupertinoIcons.chevron_forward,
                    color: secondaryLabel,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoHomePanel extends StatelessWidget {
  const _CupertinoHomePanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final background = CupertinoDynamicColor.resolve(
      CupertinoColors.secondarySystemGroupedBackground,
      context,
    );
    final border = CupertinoDynamicColor.resolve(
      CupertinoColors.separator,
      context,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: child,
      ),
    );
  }
}

class _CupertinoActiveAppointmentsPreview extends StatelessWidget {
  const _CupertinoActiveAppointmentsPreview({
    required this.request,
    required this.selectedPet,
    required this.onRetry,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onOpenAppointments,
  });

  final Future<List<OwnerAppointment>>? request;
  final OwnerPet? selectedPet;
  final VoidCallback onRetry;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onOpenAppointments;

  @override
  Widget build(BuildContext context) {
    final loadingHeight =
        MediaQuery.textScalerOf(context).scale(1) >= 1.3 ? 112.0 : 96.0;
    return _CupertinoHomePanel(
      child: FutureBuilder<List<OwnerAppointment>>(
        future: request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return SizedBox(
              height: loadingHeight,
              child: const OwnerCupertinoLoading(
                label: 'Обновляем ближайшие действия',
                compact: true,
              ),
            );
          }
          if (snapshot.hasError) {
            return _CupertinoAppointmentsError(onRetry: onRetry);
          }
          final active = (snapshot.data ?? const <OwnerAppointment>[])
              .where((appointment) => appointment.bucket == 'ACTIVE')
              .take(2)
              .toList(growable: false);
          if (active.isEmpty) {
            return _CupertinoAppointmentsEmpty(
              selectedPet: selectedPet,
              onBrowseClinics: onBrowseClinics,
              onManagePets: onManagePets,
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _CupertinoPanelTitle(
                      icon: CupertinoIcons.calendar,
                      title: 'Активные записи',
                    ),
                  ),
                  CupertinoButton(
                    minSize: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    onPressed: onOpenAppointments,
                    child: const Text('Все'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              for (var index = 0; index < active.length; index++) ...[
                if (index > 0) const SizedBox(height: 8),
                _CupertinoActiveAppointmentRow(appointment: active[index]),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _CupertinoPanelTitle extends StatelessWidget {
  const _CupertinoPanelTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    return Row(
      children: [
        Icon(
          icon,
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.activeBlue,
            context,
          ),
          size: 26,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: textTheme.textStyle.copyWith(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.label,
                context,
              ),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _CupertinoAppointmentsEmpty extends StatelessWidget {
  const _CupertinoAppointmentsEmpty({
    required this.selectedPet,
    required this.onBrowseClinics,
    required this.onManagePets,
  });

  final OwnerPet? selectedPet;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;

  @override
  Widget build(BuildContext context) {
    final pet = selectedPet;
    final textTheme = CupertinoTheme.of(context).textTheme;
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CupertinoPanelTitle(
          icon: CupertinoIcons.calendar,
          title: 'Активных записей нет',
        ),
        const SizedBox(height: 6),
        Text(
          pet == null
              ? 'Сначала добавьте питомца: запись всегда создаётся для конкретного владельца и питомца.'
              : 'Питомец для новой записи: ${pet.name}. Выберите клинику и время.',
          style: textTheme.textStyle.copyWith(color: secondaryLabel),
        ),
        const SizedBox(height: 12),
        _CupertinoPrimaryActionButton(
          label: pet == null ? 'Добавить питомца' : 'Найти клинику',
          onPressed: pet == null ? onManagePets : onBrowseClinics,
        ),
      ],
    );
  }
}

class _CupertinoAppointmentsError extends StatelessWidget {
  const _CupertinoAppointmentsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoInlineError(
      title: 'Не удалось обновить записи',
      message: 'Повторная попытка обновит ближайшие действия на главной.',
      retryLabel: 'Обновить главную',
      onRetry: onRetry,
    );
  }
}

class _CupertinoPrimaryActionButton extends StatelessWidget {
  const _CupertinoPrimaryActionButton({
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoButton.primary(
      label: label,
      onPressed: onPressed,
    );
  }
}

class _CupertinoActiveAppointmentRow extends StatelessWidget {
  const _CupertinoActiveAppointmentRow({required this.appointment});

  final OwnerAppointment appointment;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final label = CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    final fill = CupertinoDynamicColor.resolve(
      CupertinoColors.tertiarySystemFill,
      context,
    );
    return Semantics(
      label:
          'Запись в ${appointment.clinicName}. ${appointment.petName}. ${_appointmentRange(context, appointment)}.',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(CupertinoIcons.clock, color: secondaryLabel),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      appointment.clinicName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.textStyle.copyWith(
                        color: label,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${appointment.petName} · ${_appointmentRange(context, appointment)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.textStyle.copyWith(
                        color: secondaryLabel,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MaterialHomeContent extends StatelessWidget {
  const _MaterialHomeContent({
    required this.selectedPet,
    required this.petsRequest,
    required this.appointmentsRequest,
    required this.wide,
    required this.onRetryAppointments,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onEditPet,
    required this.onPetSelected,
    required this.onOpenAppointments,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
  });

  final OwnerPet? selectedPet;
  final Future<List<OwnerPet>>? petsRequest;
  final Future<List<OwnerAppointment>>? appointmentsRequest;
  final bool wide;
  final VoidCallback onRetryAppointments;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onEditPet;
  final ValueChanged<OwnerPet>? onPetSelected;
  final VoidCallback onOpenAppointments;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Главное для питомца',
          style: textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Text(
          'Запись в клинику, ближайшие действия и сервисы VetHelp без лишних шагов.',
          style: textTheme.bodyLarge,
        ),
      ],
    );

    final primaryColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ActiveAppointmentsPreview(
          request: appointmentsRequest,
          selectedPet: selectedPet,
          onRetry: onRetryAppointments,
          onBrowseClinics: onBrowseClinics,
          onManagePets: onManagePets,
          onOpenAppointments: onOpenAppointments,
        ),
      ],
    );

    final petAndEmergencyColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _MaterialPetSummary(
          pet: selectedPet,
          petsRequest: petsRequest,
          onManagePets: onManagePets,
          onEditPet: onEditPet,
          onPetSelected: onPetSelected,
        ),
        const SizedBox(height: 16),
        _MaterialEmergencyAction(onPressed: onRequestEmergency),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        header,
        const SizedBox(height: 24),
        if (wide) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 7, child: primaryColumn),
              const SizedBox(width: 24),
              Expanded(flex: 4, child: petAndEmergencyColumn),
            ],
          ),
          const SizedBox(height: 18),
          _MaterialSecondaryServices(
            onRequestInsurance: onRequestInsurance,
            onRequestTelemed: onRequestTelemed,
          ),
        ] else ...[
          primaryColumn,
          const SizedBox(height: 16),
          petAndEmergencyColumn,
          const SizedBox(height: 16),
          _MaterialSecondaryServices(
            onRequestInsurance: onRequestInsurance,
            onRequestTelemed: onRequestTelemed,
          ),
        ],
      ],
    );
  }
}

class _MaterialPetSummary extends StatelessWidget {
  const _MaterialPetSummary({
    required this.pet,
    required this.petsRequest,
    required this.onManagePets,
    required this.onEditPet,
    required this.onPetSelected,
  });

  final OwnerPet? pet;
  final Future<List<OwnerPet>>? petsRequest;
  final VoidCallback onManagePets;
  final VoidCallback onEditPet;
  final ValueChanged<OwnerPet>? onPetSelected;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 24,
              child: Icon(pet == null ? Icons.pets_outlined : Icons.pets),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Выбранный питомец',
                    style: textTheme.labelLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    pet?.name ?? 'Питомец ещё не выбран',
                    style: textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    pet == null
                        ? 'Выберите питомца перед записью: VetHelp создаёт запись для конкретного питомца.'
                        : 'Новая запись будет создана для ${pet!.name}. Питомца можно изменить перед выбором клиники.',
                  ),
                  if (pet != null && petsRequest != null) ...[
                    const SizedBox(height: 10),
                    FutureBuilder<List<OwnerPet>>(
                      future: petsRequest,
                      builder: (context, snapshot) {
                        final pets = snapshot.data ?? const <OwnerPet>[];
                        if (pets.length < 2 || onPetSelected == null) {
                          return const SizedBox.shrink();
                        }
                        return _MaterialPetPicker(
                          selectedPet: pet!,
                          pets: pets,
                          onSelected: onPetSelected!,
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Изменить питомца',
              onPressed: pet == null ? onManagePets : onEditPet,
            ),
          ],
        ),
      ),
    );
  }
}

class _MaterialPetPicker extends StatelessWidget {
  const _MaterialPetPicker({
    required this.selectedPet,
    required this.pets,
    required this.onSelected,
  });

  final OwnerPet selectedPet;
  final List<OwnerPet> pets;
  final ValueChanged<OwnerPet> onSelected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label:
          'Сменить питомца. Сейчас выбран ${selectedPet.name}. Смена применяется для следующей записи и не меняет уже выбранный слот.',
      child: MenuAnchor(
        builder: (context, controller, child) {
          return OutlinedButton.icon(
            onPressed: () {
              if (controller.isOpen) {
                controller.close();
              } else {
                controller.open();
              }
            },
            icon: const Icon(Icons.swap_horiz),
            label: const Text('Сменить питомца'),
          );
        },
        menuChildren: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: Text(
              'Применится для следующей записи. Уже выбранный слот не изменится.',
            ),
          ),
          for (final candidate in pets)
            MenuItemButton(
              leadingIcon: candidate.id == selectedPet.id
                  ? const Icon(Icons.check)
                  : const Icon(Icons.pets_outlined),
              onPressed: () {
                if (candidate.id != selectedPet.id) onSelected(candidate);
              },
              child: Text(candidate.name),
            ),
        ],
      ),
    );
  }
}

class _MaterialEmergencyAction extends StatelessWidget {
  const _MaterialEmergencyAction({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.errorContainer,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onPressed,
        child: const Padding(
          padding: EdgeInsets.all(18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.warning_amber_rounded, size: 28),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Срочная помощь'),
                    SizedBox(height: 4),
                    Text(
                      'Если состояние тяжёлое, откройте срочные клиники без анкеты и оплаты.',
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _MaterialSecondaryServices extends StatelessWidget {
  const _MaterialSecondaryServices({
    required this.onRequestInsurance,
    required this.onRequestTelemed,
  });

  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) {
    final services = [
      _MaterialServiceAction(
        icon: Icons.shield_outlined,
        title: 'Страхование',
        subtitle: 'Проверка покрытия после явного согласия владельца.',
        onPressed: onRequestInsurance,
      ),
      _MaterialServiceAction(
        icon: Icons.video_call_outlined,
        title: 'Ветеринар онлайн',
        subtitle:
            'Контекстная консультация, когда она доступна по текущим правилам.',
        onPressed: onRequestTelemed,
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final roomy = constraints.maxWidth >= 760;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Дополнительные сервисы',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            if (roomy)
              Row(
                children: [
                  for (var index = 0; index < services.length; index++) ...[
                    if (index > 0) const SizedBox(width: 12),
                    Expanded(child: services[index]),
                  ],
                ],
              )
            else
              Column(
                children: [
                  for (var index = 0; index < services.length; index++) ...[
                    if (index > 0) const SizedBox(height: 10),
                    services[index],
                  ],
                ],
              ),
          ],
        );
      },
    );
  }
}

class _MaterialServiceAction extends StatelessWidget {
  const _MaterialServiceAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onPressed,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onPressed,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 88),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(icon, size: 26),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title,
                          style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 4),
                      Text(subtitle),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ActiveAppointmentsPreview extends StatelessWidget {
  const _ActiveAppointmentsPreview({
    required this.request,
    required this.selectedPet,
    required this.onRetry,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onOpenAppointments,
  });

  final Future<List<OwnerAppointment>>? request;
  final OwnerPet? selectedPet;
  final VoidCallback onRetry;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onOpenAppointments;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<List<OwnerAppointment>>(
          future: request,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                height: 96,
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              return _ActiveAppointmentsError(onRetry: onRetry);
            }
            final active = (snapshot.data ?? const <OwnerAppointment>[])
                .where((appointment) => appointment.bucket == 'ACTIVE')
                .take(2)
                .toList(growable: false);
            if (active.isEmpty) {
              return _ActiveAppointmentsEmpty(
                selectedPet: selectedPet,
                onBrowseClinics: onBrowseClinics,
                onManagePets: onManagePets,
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 28),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('Активные записи',
                          style: Theme.of(context).textTheme.titleMedium),
                    ),
                    TextButton(
                        onPressed: onOpenAppointments,
                        child: const Text('Все')),
                  ],
                ),
                const SizedBox(height: 10),
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: active.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) =>
                      _ActiveAppointmentRow(appointment: active[index]),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ActiveAppointmentsEmpty extends StatelessWidget {
  const _ActiveAppointmentsEmpty({
    required this.selectedPet,
    required this.onBrowseClinics,
    required this.onManagePets,
  });

  final OwnerPet? selectedPet;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;

  @override
  Widget build(BuildContext context) {
    final pet = selectedPet;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.calendar_today_outlined, size: 32),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Активных записей нет',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(pet == null
                  ? 'Сначала добавьте питомца: запись всегда создаётся для конкретного владельца и питомца.'
                  : 'Питомец для новой записи: ${pet.name}. Выберите клинику и время.'),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: pet == null ? onManagePets : onBrowseClinics,
                icon: Icon(pet == null ? Icons.pets : Icons.search),
                label: Text(pet == null ? 'Добавить питомца' : 'Найти клинику'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ActiveAppointmentsError extends StatelessWidget {
  const _ActiveAppointmentsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Не удалось обновить записи',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              const Text('Проверьте подключение и повторите попытку.'),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Повторить'),
              ),
            ]),
          ),
        ],
      );
}

class _ActiveAppointmentRow extends StatelessWidget {
  const _ActiveAppointmentRow({required this.appointment});

  final OwnerAppointment appointment;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.event_available_outlined),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(appointment.clinicName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    '${appointment.petName} · ${_appointmentRange(context, appointment)}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
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

String _appointmentRange(BuildContext context, OwnerAppointment appointment) {
  final date =
      MaterialLocalizations.of(context).formatMediumDate(appointment.startsAt);
  final start = TimeOfDay.fromDateTime(appointment.startsAt).format(context);
  final end = TimeOfDay.fromDateTime(appointment.endsAt).format(context);
  return '$date, $start–$end';
}

bool _usesWideMaterialLayout(double width) => width >= 840;

class _TelemedLanding extends StatelessWidget {
  const _TelemedLanding({required this.onRequestTelemed});
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Ветеринар онлайн',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text(
              'Для стабильного состояния: вопросы по симптомам, анализам, назначениям и контроль после визита.'),
          const SizedBox(height: 20),
          const Card(
            child: ListTile(
              leading: Icon(Icons.health_and_safety_outlined),
              title: Text('Важно'),
              subtitle: Text(
                  'При судорогах, потере сознания, тяжёлом дыхании, сильном кровотечении или выраженной боли выбирайте очную срочную помощь.'),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
              onPressed: onRequestTelemed,
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Описать вопрос')),
        ],
      );
}
