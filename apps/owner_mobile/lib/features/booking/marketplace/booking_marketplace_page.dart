import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../presentation/platform/owner_platform.dart';
import '../../../presentation/widgets/owner_cupertino_feedback.dart';
import 'booking_hold_status_page.dart';
import 'booking_marketplace_bloc.dart';
import 'booking_marketplace_repository.dart';
import 'booking_slot_grid.dart';

class BookingMarketplacePage extends StatelessWidget {
  const BookingMarketplacePage({
    super.key,
    required this.clinicName,
    required this.serviceName,
    required this.serviceId,
    required this.petName,
    required this.clinicLocationId,
    required this.petId,
    required this.repository,
    this.retryDelay,
    this.platformOverride,
  });

  final String clinicName;
  final String serviceName;
  final String serviceId;
  final String petName;
  final String clinicLocationId;
  final String petId;
  final BookingMarketplaceRepository repository;
  final BookingRetryDelay? retryDelay;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<BookingMarketplaceBloc>(
      create: (_) => BookingMarketplaceBloc(
        repository: repository,
        clinicLocationId: clinicLocationId,
        serviceId: serviceId,
        petId: petId,
        retryDelay: retryDelay,
      )..add(const BookingMarketplaceOpened()),
      child: _BookingMarketplaceView(
        clinicName: clinicName,
        serviceName: serviceName,
        petName: petName,
        repository: repository,
        platformOverride: platformOverride,
      ),
    );
  }
}

class _BookingMarketplaceView extends StatelessWidget {
  const _BookingMarketplaceView({
    required this.clinicName,
    required this.serviceName,
    required this.petName,
    required this.repository,
    this.platformOverride,
  });

  final String clinicName;
  final String serviceName;
  final String petName;
  final BookingMarketplaceRepository repository;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    final usesCupertino = _usesCupertinoBooking(context, platformOverride);
    final body = SafeArea(
      child: BlocConsumer<BookingMarketplaceBloc, BookingMarketplaceState>(
        listener: (context, state) {
          if (state is BookingMarketplaceHoldCreated) {
            Navigator.of(context).pushReplacement(
              ownerPageRoute<void>(
                context: context,
                platform: usesCupertino ? TargetPlatform.iOS : null,
                builder: (_) => BookingHoldStatusPage(
                  holdId: state.hold.holdId,
                  initialState: state.hold.state,
                  repository: repository,
                  platformOverride:
                      usesCupertino ? TargetPlatform.iOS : platformOverride,
                ),
              ),
            );
          }
          if (state is BookingMarketplaceError) {
            _handleMarketplaceError(context, state, usesCupertino);
          }
        },
        builder: (context, state) => switch (state) {
          BookingMarketplaceLoading() => usesCupertino
              ? const _CupertinoMarketplaceSkeleton()
              : const _MarketplaceSkeleton(),
          BookingMarketplaceReady() => usesCupertino
              ? _CupertinoMarketplaceReady(
                  clinicName: clinicName,
                  serviceName: serviceName,
                  petName: petName,
                  state: state,
                )
              : _MarketplaceReady(
                  clinicName: clinicName,
                  serviceName: serviceName,
                  petName: petName,
                  state: state,
                ),
          BookingMarketplaceCreatingHold() => usesCupertino
              ? _CupertinoMarketplaceReady(
                  clinicName: clinicName,
                  serviceName: serviceName,
                  petName: petName,
                  state: BookingMarketplaceReady(
                    selectedDay: state.selectedDay,
                    slots: state.slots,
                    selectedSlot: state.selectedSlot,
                    notice: 'Проверяем доступность…',
                  ),
                  creatingHold: true,
                )
              : _MarketplaceReady(
                  clinicName: clinicName,
                  serviceName: serviceName,
                  petName: petName,
                  state: BookingMarketplaceReady(
                    selectedDay: state.selectedDay,
                    slots: state.slots,
                    selectedSlot: state.selectedSlot,
                    notice: 'Отправляем заявку в VetHelp. Не закрывайте экран.',
                  ),
                  creatingHold: true,
                ),
          BookingSlotLockingInProgress() => usesCupertino
              ? _CupertinoMarketplaceReady(
                  clinicName: clinicName,
                  serviceName: serviceName,
                  petName: petName,
                  state: BookingMarketplaceReady(
                    selectedDay: state.selectedDay,
                    slots: state.slots,
                    selectedSlot: state.selectedSlot,
                    notice: 'Проверяем доступность…',
                  ),
                  lockingSlot: state.selectedSlot,
                )
              : _MarketplaceReady(
                  clinicName: clinicName,
                  serviceName: serviceName,
                  petName: petName,
                  state: BookingMarketplaceReady(
                    selectedDay: state.selectedDay,
                    slots: state.slots,
                    selectedSlot: state.selectedSlot,
                    notice:
                        'Проверяем время. Попытка ${state.retryAttempt} из 3.',
                  ),
                  lockingSlot: state.selectedSlot,
                ),
          BookingMarketplaceError() => usesCupertino
              ? _CupertinoMarketplaceError(state: state)
              : _MarketplaceError(state: state),
          BookingMarketplaceHoldCreated() => const SizedBox.shrink(),
        },
      ),
    );
    if (usesCupertino) {
      return CupertinoPageScaffold(
        navigationBar: const CupertinoNavigationBar(
          middle: Text('Запись в клинику'),
        ),
        child: body,
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Запись в клинику')),
      body: body,
    );
  }

  void _handleMarketplaceError(
    BuildContext context,
    BookingMarketplaceError state,
    bool usesCupertino,
  ) {
    final alternativeSlots = state.slots;
    if (!usesCupertino ||
        !state.showSlotUnavailableDialog ||
        alternativeSlots.isEmpty) {
      return;
    }

    showCupertinoDialog<void>(
      context: context,
      builder: (dialogContext) => CupertinoAlertDialog(
        title: const Text('Слот недоступен'),
        content: const Text(
          'К сожалению, это время уже занято другим владельцем. Пожалуйста, выберите другое время',
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              _showAlternativeSlots(context, alternativeSlots);
            },
            child: const Text('Подобрать другое время'),
          ),
        ],
      ),
    );
  }
}

bool _usesCupertinoBooking(
  BuildContext context,
  TargetPlatform? platformOverride,
) {
  final themedPlatform =
      context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
  return ownerUsesCupertino(platform: platformOverride ?? themedPlatform);
}

void _showAlternativeSlots(BuildContext context, List<BookingSlot> slots) {
  final alternatives = slots
      .where((slot) => slot.remainingCapacity > 0)
      .take(4)
      .toList(growable: false);
  if (alternatives.isEmpty) return;

  showCupertinoModalPopup<void>(
    context: context,
    builder: (sheetContext) => CupertinoActionSheet(
      title: const Text('Доступные альтернативные слоты'),
      actions: [
        for (final slot in alternatives)
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(sheetContext).pop();
              context
                  .read<BookingMarketplaceBloc>()
                  .add(BookingMarketplaceDaySelected(_dayStart(slot.startsAt)));
            },
            child: Text('Показать ${_slotActionLabel(context, slot)}'),
          ),
      ],
      cancelButton: CupertinoActionSheetAction(
        onPressed: () => Navigator.of(sheetContext).pop(),
        child: const Text('Отмена'),
      ),
    ),
  );
}

String _slotActionLabel(BuildContext context, BookingSlot slot) {
  return _timeRangeLabel(slot);
}

class _CupertinoMarketplaceReady extends StatelessWidget {
  const _CupertinoMarketplaceReady({
    required this.clinicName,
    required this.serviceName,
    required this.petName,
    required this.state,
    this.creatingHold = false,
    this.lockingSlot,
  });

  final String clinicName;
  final String serviceName;
  final String petName;
  final BookingMarketplaceReady state;
  final bool creatingHold;
  final BookingSlot? lockingSlot;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<BookingMarketplaceBloc>();
    final today = _dayStart(DateTime.now().toUtc());
    final days =
        List<DateTime>.generate(3, (index) => today.add(Duration(days: index)));
    final selectedSlot = state.selectedSlot;
    final interactionsBlocked = creatingHold || lockingSlot != null;
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    final dayStripHeight = textScale >= 1.6
        ? 120.0
        : textScale >= 1.3
            ? 96.0
            : 74.0;

    return Column(
      children: [
        Expanded(
          child: CustomScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                sliver: SliverList.list(
                  children: [
                    _CupertinoBookingSummary(
                      clinicName: clinicName,
                      serviceName: serviceName,
                      petName: petName,
                    ),
                    const SizedBox(height: 24),
                    _CupertinoSectionHeader(
                      title: 'День',
                      actionLabel: 'Выбрать',
                      onAction: interactionsBlocked
                          ? null
                          : () => _showCupertinoDaySheet(
                                context,
                                days: days,
                                selectedDay: state.selectedDay,
                              ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: dayStripHeight,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemBuilder: (context, index) {
                          final day = days[index];
                          final selected = _sameDay(day, state.selectedDay);
                          return _CupertinoDayChip(
                            day: day,
                            selected: selected,
                            enabled: !interactionsBlocked,
                            hasAvailability: selected && state.slots.isNotEmpty,
                            onTap: () {
                              HapticFeedback.selectionClick();
                              bloc.add(BookingMarketplaceDaySelected(day));
                            },
                          );
                        },
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemCount: days.length,
                      ),
                    ),
                    if (state.notice case final notice?) ...[
                      const SizedBox(height: 16),
                      _CupertinoNotice(text: notice),
                    ],
                    const SizedBox(height: 24),
                    const _CupertinoSectionHeader(title: 'Доступное время'),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
              if (state.slots.isEmpty)
                const SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(child: _CupertinoEmptySlots()),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(
                    child: _CupertinoSlotSections(
                      slots: state.slots,
                      selectedSlot: selectedSlot,
                      lockingSlot: lockingSlot,
                      interactionsBlocked: interactionsBlocked,
                      onSlotSelected: (slot) {
                        HapticFeedback.selectionClick();
                        bloc.add(BookingMarketplaceSlotSelected(slot));
                      },
                    ),
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 116),
                sliver: SliverList.list(
                  children: [
                    if (selectedSlot != null) ...[
                      _CupertinoSelectedSlotSummary(slot: selectedSlot),
                      const SizedBox(height: 12),
                    ],
                    Text(
                      'Клиника подтвердит запись после проверки доступности времени.',
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(
                            color: CupertinoDynamicColor.resolve(
                              CupertinoColors.secondaryLabel,
                              context,
                            ),
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        _CupertinoBookingFooter(
          selectedSlot: selectedSlot,
          busy: interactionsBlocked,
          onSubmit: selectedSlot == null || interactionsBlocked
              ? null
              : () => bloc.add(const BookingMarketplaceHoldRequested()),
        ),
      ],
    );
  }
}

class _CupertinoBookingSummary extends StatelessWidget {
  const _CupertinoBookingSummary({
    required this.clinicName,
    required this.serviceName,
    required this.petName,
  });

  final String clinicName;
  final String serviceName;
  final String petName;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.secondarySystemGroupedBackground,
          context,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.separator,
            context,
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.systemBlue.withValues(alpha: 0.12),
                  context,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const SizedBox(
                width: 44,
                height: 44,
                child: Icon(CupertinoIcons.building_2_fill),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    clinicName,
                    style:
                        CupertinoTheme.of(context).textTheme.navTitleTextStyle,
                  ),
                  const SizedBox(height: 4),
                  Text(serviceName),
                  const SizedBox(height: 4),
                  Text(
                    'Питомец: $petName',
                    style:
                        CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                              color: CupertinoDynamicColor.resolve(
                                CupertinoColors.secondaryLabel,
                                context,
                              ),
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

class _CupertinoSectionHeader extends StatelessWidget {
  const _CupertinoSectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoSectionHeader(
      title: title,
      trailing: actionLabel == null
          ? null
          : CupertinoButton(
              minSize: 44,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
    );
  }
}

class _CupertinoDayChip extends StatelessWidget {
  const _CupertinoDayChip({
    required this.day,
    required this.selected,
    required this.enabled,
    required this.hasAvailability,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final bool enabled;
  final bool hasAvailability;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    final chipWidth = textScale >= 1.6
        ? 124.0
        : textScale >= 1.3
            ? 108.0
            : 92.0;
    final chipMinHeight = textScale >= 1.6
        ? 96.0
        : textScale >= 1.3
            ? 76.0
            : 56.0;
    final foreground = selected
        ? CupertinoColors.white
        : CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryForeground = selected
        ? CupertinoColors.white.withValues(alpha: 0.78)
        : CupertinoDynamicColor.resolve(
            CupertinoColors.secondaryLabel, context);
    final borderColor = selected
        ? CupertinoColors.activeBlue
        : CupertinoDynamicColor.resolve(CupertinoColors.separator, context);

    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: '${_dayLabel(day)}, ${day.day}',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: ownerMotionDuration(
            context,
            const Duration(milliseconds: 160),
          ),
          width: chipWidth,
          constraints: BoxConstraints(minHeight: chipMinHeight),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected
                ? CupertinoColors.activeBlue
                : CupertinoDynamicColor.resolve(
                    CupertinoColors.secondarySystemGroupedBackground,
                    context,
                  ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor, width: selected ? 2 : 1),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _dayLabel(day),
                style: TextStyle(
                  color: secondaryForeground,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                '${day.day}',
                style: TextStyle(
                  color: foreground,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                hasAvailability ? 'Есть окна' : 'Проверим',
                style: TextStyle(color: secondaryForeground, fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoSlotSections extends StatelessWidget {
  const _CupertinoSlotSections({
    required this.slots,
    required this.selectedSlot,
    required this.lockingSlot,
    required this.interactionsBlocked,
    required this.onSlotSelected,
  });

  final List<BookingSlot> slots;
  final BookingSlot? selectedSlot;
  final BookingSlot? lockingSlot;
  final bool interactionsBlocked;
  final ValueChanged<BookingSlot> onSlotSelected;

  @override
  Widget build(BuildContext context) {
    final groups = _slotGroups(slots);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in groups) ...[
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 8),
            child: Text(
              group.label,
              style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                    color: CupertinoDynamicColor.resolve(
                      CupertinoColors.secondaryLabel,
                      context,
                    ),
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 720
                  ? 4
                  : constraints.maxWidth >= 500
                      ? 3
                      : 2;
              const spacing = 10.0;
              final tileWidth =
                  (constraints.maxWidth - spacing * (columns - 1)) / columns;
              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  for (final slot in group.slots)
                    SizedBox(
                      width: tileWidth,
                      child: _CupertinoSlotTile(
                        slot: slot,
                        selected: selectedSlot?.id == slot.id,
                        locking: lockingSlot?.id == slot.id,
                        enabled:
                            !interactionsBlocked && slot.remainingCapacity > 0,
                        blockedByAnotherSlot:
                            interactionsBlocked && lockingSlot?.id != slot.id,
                        onTap: () => onSlotSelected(slot),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 18),
        ],
      ],
    );
  }
}

class _CupertinoSlotTile extends StatelessWidget {
  const _CupertinoSlotTile({
    required this.slot,
    required this.selected,
    required this.locking,
    required this.enabled,
    required this.blockedByAnotherSlot,
    required this.onTap,
  });

  final BookingSlot slot;
  final bool selected;
  final bool locking;
  final bool enabled;
  final bool blockedByAnotherSlot;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unavailable = slot.remainingCapacity <= 0;
    final active = selected || locking;
    final foreground = active
        ? CupertinoColors.white
        : CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryForeground = active
        ? CupertinoColors.white.withValues(alpha: 0.78)
        : CupertinoDynamicColor.resolve(
            CupertinoColors.secondaryLabel, context);
    final background = active
        ? CupertinoColors.activeBlue
        : CupertinoDynamicColor.resolve(
            CupertinoColors.secondarySystemGroupedBackground,
            context,
          );
    final borderColor = active
        ? CupertinoColors.activeBlue
        : CupertinoDynamicColor.resolve(CupertinoColors.separator, context);
    final label = _timeLabel(slot.startsAt);
    final duration = _durationLabel(slot);

    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: unavailable
          ? '$label, недоступно'
          : selected
              ? '$label, выбрано, $duration'
              : '$label, $duration',
      child: Opacity(
        opacity: blockedByAnotherSlot ? 0.56 : 1,
        child: CupertinoButton(
          minSize: 44,
          padding: EdgeInsets.zero,
          onPressed: enabled ? onTap : null,
          child: AnimatedContainer(
            key: ValueKey<String>('cupertino-booking-slot-${slot.id}'),
            duration: ownerMotionDuration(
              context,
              const Duration(milliseconds: 160),
            ),
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderColor, width: active ? 2 : 1),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 22,
                  height: 22,
                  child: Center(
                    child: locking
                        ? const CupertinoActivityIndicator(
                            color: CupertinoColors.white)
                        : selected
                            ? const Icon(
                                CupertinoIcons.check_mark,
                                color: CupertinoColors.white,
                                size: 19,
                              )
                            : Icon(
                                unavailable
                                    ? CupertinoIcons.minus_circle
                                    : CupertinoIcons.circle,
                                color: secondaryForeground,
                                size: 18,
                              ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          color: foreground,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        unavailable ? 'Недоступно' : duration,
                        style: TextStyle(
                          color: secondaryForeground,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoSelectedSlotSummary extends StatelessWidget {
  const _CupertinoSelectedSlotSummary({required this.slot});

  final BookingSlot slot;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Выбранное время ${_timeRangeLabel(slot)}',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.systemBlue.withValues(alpha: 0.12),
            context,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Icon(CupertinoIcons.calendar_badge_plus),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Выбрано: ${_dateLabel(slot.startsAt)}, ${_timeRangeLabel(slot)}',
                  style: CupertinoTheme.of(context).textTheme.textStyle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoNotice extends StatelessWidget {
  const _CupertinoNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoStatusBanner(
      tone: OwnerCupertinoFeedbackTone.warning,
      message: text,
    );
  }
}

class _CupertinoEmptySlots extends StatelessWidget {
  const _CupertinoEmptySlots();

  @override
  Widget build(BuildContext context) {
    return const OwnerCupertinoEmptyState(
      icon: CupertinoIcons.calendar_badge_minus,
      title: 'Нет свободного времени',
      message:
          'На выбранный день свободных окон нет. Выберите другой день или обновите расписание.',
    );
  }
}

class _CupertinoBookingFooter extends StatelessWidget {
  const _CupertinoBookingFooter({
    required this.selectedSlot,
    required this.busy,
    required this.onSubmit,
  });

  final BookingSlot? selectedSlot;
  final bool busy;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    final disabled = onSubmit == null;
    final label = busy
        ? 'Проверяем доступность…'
        : selectedSlot == null
            ? 'Выберите время'
            : 'Отправить заявку в клинику';
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.systemBackground,
          context,
        ),
        border: Border(
          top: BorderSide(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.separator,
              context,
            ),
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: OwnerCupertinoButton.primary(
            label: label,
            enabled: !disabled,
            loading: busy,
            onPressed: onSubmit,
          ),
        ),
      ),
    );
  }
}

class _CupertinoMarketplaceError extends StatelessWidget {
  const _CupertinoMarketplaceError({required this.state});

  final BookingMarketplaceError state;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoEmptyState(
      icon: CupertinoIcons.exclamationmark_circle,
      title: 'Не удалось открыть запись',
      message: state.message,
      actionLabel: 'Обновить расписание',
      onAction: () => context
          .read<BookingMarketplaceBloc>()
          .add(const BookingMarketplaceRefreshRequested()),
    );
  }
}

class _CupertinoMarketplaceSkeleton extends StatelessWidget {
  const _CupertinoMarketplaceSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = CupertinoDynamicColor.resolve(
      CupertinoColors.tertiarySystemFill,
      context,
    );
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _CupertinoSkeletonBlock(height: 104, color: color),
        const SizedBox(height: 24),
        _CupertinoSkeletonBlock(height: 24, color: color),
        const SizedBox(height: 12),
        _CupertinoSkeletonBlock(height: 64, color: color),
        const SizedBox(height: 24),
        ...List<Widget>.generate(
          4,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _CupertinoSkeletonBlock(height: 68, color: color),
          ),
        ),
      ],
    );
  }
}

class _CupertinoSkeletonBlock extends StatelessWidget {
  const _CupertinoSkeletonBlock({required this.height, required this.color});

  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(16),
        ),
        child: SizedBox(height: height),
      );
}

class _SlotGroupData {
  const _SlotGroupData({required this.label, required this.slots});

  final String label;
  final List<BookingSlot> slots;
}

List<_SlotGroupData> _slotGroups(List<BookingSlot> slots) {
  final morning = <BookingSlot>[];
  final day = <BookingSlot>[];
  final evening = <BookingSlot>[];

  for (final slot in slots) {
    final hour = slot.startsAt.toLocal().hour;
    if (hour < 12) {
      morning.add(slot);
    } else if (hour < 17) {
      day.add(slot);
    } else {
      evening.add(slot);
    }
  }

  return [
    if (morning.isNotEmpty) _SlotGroupData(label: 'Утро', slots: morning),
    if (day.isNotEmpty) _SlotGroupData(label: 'День', slots: day),
    if (evening.isNotEmpty) _SlotGroupData(label: 'Вечер', slots: evening),
  ];
}

void _showCupertinoDaySheet(
  BuildContext context, {
  required List<DateTime> days,
  required DateTime selectedDay,
}) {
  showCupertinoModalPopup<void>(
    context: context,
    builder: (sheetContext) => CupertinoActionSheet(
      title: const Text('Выберите день'),
      actions: [
        for (final day in days)
          CupertinoActionSheetAction(
            isDefaultAction: _sameDay(day, selectedDay),
            onPressed: () {
              Navigator.of(sheetContext).pop();
              context
                  .read<BookingMarketplaceBloc>()
                  .add(BookingMarketplaceDaySelected(day));
            },
            child: Text('${_dayLabel(day)}, ${_dateLabel(day)}'),
          ),
      ],
      cancelButton: CupertinoActionSheetAction(
        onPressed: () => Navigator.of(sheetContext).pop(),
        child: const Text('Отмена'),
      ),
    ),
  );
}

String _timeRangeLabel(BookingSlot slot) {
  return '${_timeLabel(slot.startsAt)} - ${_timeLabel(slot.endsAt)}';
}

String _timeLabel(DateTime value) {
  final local = value.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

String _durationLabel(BookingSlot slot) {
  final minutes = slot.endsAt.difference(slot.startsAt).inMinutes;
  if (minutes <= 0) return 'Время уточняется';
  if (minutes % 60 == 0) {
    final hours = minutes ~/ 60;
    return '$hours ч';
  }
  return '$minutes мин';
}

String _dateLabel(DateTime value) {
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')}.${local.month.toString().padLeft(2, '0')}.${local.year}';
}

class _MarketplaceReady extends StatelessWidget {
  const _MarketplaceReady({
    required this.clinicName,
    required this.serviceName,
    required this.petName,
    required this.state,
    this.creatingHold = false,
    this.lockingSlot,
  });

  final String clinicName;
  final String serviceName;
  final String petName;
  final BookingMarketplaceReady state;
  final bool creatingHold;
  final BookingSlot? lockingSlot;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<BookingMarketplaceBloc>();
    final today = _dayStart(DateTime.now().toUtc());
    final days =
        List<DateTime>.generate(3, (index) => today.add(Duration(days: index)));
    final selectedSlot = state.selectedSlot;
    final interactionsBlocked = creatingHold || lockingSlot != null;

    return Column(
      children: [
        Expanded(
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                sliver: SliverList.list(
                  children: [
                    _ClinicHeader(
                      clinicName: clinicName,
                      serviceName: serviceName,
                      petName: petName,
                    ),
                    const SizedBox(height: 20),
                    Text('Выберите день',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 72,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: days.length,
                        itemBuilder: (context, index) {
                          final day = days[index];
                          final selected = _sameDay(day, state.selectedDay);
                          return Padding(
                            padding: EdgeInsets.only(
                                right: index == days.length - 1 ? 0 : 8),
                            child: _DayChip(
                              day: day,
                              label: _dayLabel(day),
                              available: selected && state.slots.isNotEmpty,
                              enabled: !creatingHold,
                              selected: selected,
                              onTap: () =>
                                  bloc.add(BookingMarketplaceDaySelected(day)),
                            ),
                          );
                        },
                      ),
                    ),
                    if (state.notice case final notice?) ...[
                      const SizedBox(height: 16),
                      _Notice(text: notice),
                    ],
                    const SizedBox(height: 24),
                    Text('Доступное время',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
              if (state.slots.isEmpty)
                const SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverToBoxAdapter(child: _EmptySlots()),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: BookingSlotGrid(
                    slots: state.slots,
                    selectedSlot: selectedSlot,
                    lockingSlot: lockingSlot,
                    lockedSlot: null,
                    onSlotSelected: (slot) =>
                        bloc.add(BookingMarketplaceSlotSelected(slot)),
                  ),
                ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 116),
                sliver: SliverList.list(
                  children: [
                    if (selectedSlot != null) ...[
                      _SelectedSlotSummary(slot: selectedSlot),
                      const SizedBox(height: 12),
                    ],
                    Text(
                      'Мы подтвердим запись только после ответа клиники. Время в списке основано на данных VetHelp.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            border:
                Border(top: BorderSide(color: Theme.of(context).dividerColor)),
          ),
          child: FilledButton(
            onPressed: selectedSlot == null || interactionsBlocked
                ? null
                : () => bloc.add(const BookingMarketplaceHoldRequested()),
            style:
                FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: creatingHold
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text(selectedSlot == null
                    ? 'Выберите время'
                    : 'Отправить заявку'),
          ),
        ),
      ],
    );
  }
}

class _MarketplaceError extends StatelessWidget {
  const _MarketplaceError({required this.state});
  final BookingMarketplaceError state;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined,
                size: 48, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text('Не удалось открыть запись',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(state.message, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => context
                  .read<BookingMarketplaceBloc>()
                  .add(const BookingMarketplaceRefreshRequested()),
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClinicHeader extends StatelessWidget {
  const _ClinicHeader({
    required this.clinicName,
    required this.serviceName,
    required this.petName,
  });

  final String clinicName;
  final String serviceName;
  final String petName;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const CircleAvatar(child: Icon(Icons.local_hospital_outlined)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(clinicName,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(serviceName),
                  const SizedBox(height: 2),
                  Text('Питомец: $petName'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({
    required this.day,
    required this.label,
    required this.available,
    required this.enabled,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final String label;
  final bool available;
  final bool enabled;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final foreground = enabled ? colors.onSurface : colors.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: ownerMotionDuration(
            context,
            const Duration(milliseconds: 160),
          ),
          width: 92,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? colors.primaryContainer : colors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? colors.primary : Theme.of(context).dividerColor,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label,
                  style: Theme.of(context)
                      .textTheme
                      .labelMedium
                      ?.copyWith(color: foreground),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Text('${day.day}',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(color: foreground)),
              const SizedBox(height: 4),
              AnimatedContainer(
                duration: ownerMotionDuration(
                  context,
                  const Duration(milliseconds: 160),
                ),
                width: available ? 18 : 6,
                height: 4,
                decoration: BoxDecoration(
                  color: available ? colors.primary : colors.outline,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectedSlotSummary extends StatelessWidget {
  const _SelectedSlotSummary({required this.slot});
  final BookingSlot slot;

  @override
  Widget build(BuildContext context) {
    final date = MaterialLocalizations.of(context)
        .formatMediumDate(slot.startsAt.toLocal());
    final start =
        TimeOfDay.fromDateTime(slot.startsAt.toLocal()).format(context);
    final end = TimeOfDay.fromDateTime(slot.endsAt.toLocal()).format(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const Icon(Icons.event_available_outlined),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Выбрано: $date, $start–$end',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          const Icon(Icons.info_outline),
          const SizedBox(width: 10),
          Expanded(child: Text(text))
        ]),
      ),
    );
  }
}

class _EmptySlots extends StatelessWidget {
  const _EmptySlots();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Padding(
        padding: EdgeInsets.all(20),
        child: Column(children: [
          Icon(Icons.event_busy_outlined),
          SizedBox(height: 8),
          Text('На этот день свободных окон нет.')
        ]),
      ),
    );
  }
}

class _MarketplaceSkeleton extends StatelessWidget {
  const _MarketplaceSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SkeletonBlock(height: 94, color: color),
        const SizedBox(height: 24),
        _SkeletonBlock(height: 20, color: color),
        const SizedBox(height: 12),
        _SkeletonBlock(height: 44, color: color),
        const SizedBox(height: 24),
        ...List<Widget>.generate(
            4,
            (_) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _SkeletonBlock(height: 66, color: color))),
      ],
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height, required this.color});
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        height: height,
        decoration: BoxDecoration(
            color: color, borderRadius: BorderRadius.circular(14)),
      );
}

DateTime _dayStart(DateTime value) {
  final utc = value.toUtc();
  return DateTime.utc(utc.year, utc.month, utc.day);
}

bool _sameDay(DateTime first, DateTime second) =>
    first.year == second.year &&
    first.month == second.month &&
    first.day == second.day;

String _dayLabel(DateTime day) {
  final now = DateTime.now().toUtc();
  final today = _dayStart(now);
  if (_sameDay(day, today)) return 'Сегодня';
  if (_sameDay(day, today.add(const Duration(days: 1)))) return 'Завтра';
  return '${day.day.toString().padLeft(2, '0')}.${day.month.toString().padLeft(2, '0')}';
}
