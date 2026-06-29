import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

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
  });

  final String clinicName;
  final String serviceName;
  final String serviceId;
  final String petName;
  final String clinicLocationId;
  final String petId;
  final BookingMarketplaceRepository repository;
  final BookingRetryDelay? retryDelay;

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
  });

  final String clinicName;
  final String serviceName;
  final String petName;
  final BookingMarketplaceRepository repository;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Запись в клинику')),
      body: SafeArea(
        child: BlocConsumer<BookingMarketplaceBloc, BookingMarketplaceState>(
          listener: (context, state) {
            if (state is BookingMarketplaceHoldCreated) {
              Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
                builder: (_) => BookingHoldStatusPage(
                  holdId: state.hold.holdId,
                  initialState: state.hold.state,
                  repository: repository,
                ),
              ));
            }
            if (state is BookingMarketplaceError) {
              _handleMarketplaceError(context, state);
            }
          },
          builder: (context, state) => switch (state) {
            BookingMarketplaceLoading() => const _MarketplaceSkeleton(),
            BookingMarketplaceReady() => _MarketplaceReady(
                clinicName: clinicName,
                serviceName: serviceName,
                petName: petName,
                state: state,
              ),
            BookingMarketplaceCreatingHold() => _MarketplaceReady(
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
            BookingSlotLockingInProgress() => _MarketplaceReady(
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
            BookingMarketplaceError() => _MarketplaceError(state: state),
            BookingMarketplaceHoldCreated() => const SizedBox.shrink(),
          },
        ),
      ),
    );
  }

  void _handleMarketplaceError(
    BuildContext context,
    BookingMarketplaceError state,
  ) {
    final isCupertino = Theme.of(context).platform == TargetPlatform.iOS;
    final alternativeSlots = state.slots;
    if (!isCupertino ||
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
              final bloc = context.read<BookingMarketplaceBloc>();
              bloc
                ..add(BookingMarketplaceSlotSelected(slot))
                ..add(const BookingMarketplaceHoldRequested());
            },
            child: Text(_slotActionLabel(context, slot)),
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
  final start = TimeOfDay.fromDateTime(slot.startsAt.toLocal()).format(context);
  final end = TimeOfDay.fromDateTime(slot.endsAt.toLocal()).format(context);
  return '$start - $end';
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
          duration: const Duration(milliseconds: 160),
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
                duration: const Duration(milliseconds: 160),
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
