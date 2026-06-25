import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'booking_marketplace_bloc.dart';
import 'booking_marketplace_repository.dart';

class BookingMarketplacePage extends StatelessWidget {
  const BookingMarketplacePage({
    super.key,
    required this.clinicName,
    required this.petName,
    required this.clinicLocationId,
    required this.petId,
    required this.repository,
  });

  final String clinicName;
  final String petName;
  final String clinicLocationId;
  final String petId;
  final BookingMarketplaceRepository repository;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<BookingMarketplaceBloc>(
      create: (_) => BookingMarketplaceBloc(
        repository: repository,
        clinicLocationId: clinicLocationId,
        petId: petId,
      )..add(const BookingMarketplaceOpened()),
      child: _BookingMarketplaceView(
        clinicName: clinicName,
        petName: petName,
      ),
    );
  }
}

class _BookingMarketplaceView extends StatelessWidget {
  const _BookingMarketplaceView({
    required this.clinicName,
    required this.petName,
  });

  final String clinicName;
  final String petName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Запись в клинику')),
      body: SafeArea(
        child: BlocConsumer<BookingMarketplaceBloc, BookingMarketplaceState>(
          listener: (context, state) {
            if (state is BookingMarketplaceHoldCreated) {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute<void>(
                  builder: (_) => _BookingHoldStatusPage(
                    hold: state.hold,
                    repository: context.read<BookingMarketplaceBloc>()
                        .state is BookingMarketplaceHoldCreated
                        ? null
                        : null,
                  ),
                ),
              );
            }
          },
          builder: (context, state) {
            return switch (state) {
              BookingMarketplaceLoading() => const _MarketplaceSkeleton(),
              BookingMarketplaceReady() => _MarketplaceReady(
                  clinicName: clinicName,
                  petName: petName,
                  state: state,
                ),
              BookingMarketplaceCreatingHold() => _MarketplaceReady(
                  clinicName: clinicName,
                  petName: petName,
                  state: BookingMarketplaceReady(
                    selectedDay: state.selectedDay,
                    slots: state.slots,
                    selectedSlot: state.selectedSlot,
                    notice: 'Отправляем заявку в VetHelp. Не закрывайте экран.',
                  ),
                  creatingHold: true,
                ),
              BookingMarketplaceError() => _MarketplaceError(state: state),
              BookingMarketplaceHoldCreated() => const SizedBox.shrink(),
            };
          },
        ),
      ),
    );
  }
}

class _MarketplaceReady extends StatelessWidget {
  const _MarketplaceReady({
    required this.clinicName,
    required this.petName,
    required this.state,
    this.creatingHold = false,
  });

  final String clinicName;
  final String petName;
  final BookingMarketplaceReady state;
  final bool creatingHold;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<BookingMarketplaceBloc>();
    final days = List<DateTime>.generate(
      3,
      (index) => state.selectedDay.add(Duration(days: index)),
    );
    final selectedSlot = state.selectedSlot;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 116),
            children: [
              _ClinicHeader(clinicName: clinicName, petName: petName),
              const SizedBox(height: 20),
              Text('Выберите день', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              SizedBox(
                height: 44,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: days.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, index) {
                    final day = days[index];
                    final selected = _sameDay(day, state.selectedDay);
                    return ChoiceChip(
                      label: Text(_dayLabel(day)),
                      selected: selected,
                      onSelected: creatingHold
                          ? null
                          : (_) => bloc.add(BookingMarketplaceDaySelected(day)),
                    );
                  },
                ),
              ),
              if (state.notice != null) ...[
                const SizedBox(height: 16),
                _Notice(text: state.notice!),
              ],
              const SizedBox(height: 24),
              Text('Доступное время', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (state.slots.isEmpty)
                const _EmptySlots()
              else
                ...state.slots.map((slot) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _SlotCard(
                        slot: slot,
                        selected: selectedSlot?.id == slot.id,
                        enabled: !creatingHold,
                        onTap: () => bloc.add(BookingMarketplaceSlotSelected(slot)),
                      ),
                    )),
              const SizedBox(height: 8),
              Text(
                'Мы подтвердим запись только после ответа клиники. Время в списке основано на данных VetHelp.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
          ),
          child: FilledButton(
            onPressed: selectedSlot == null || creatingHold
                ? null
                : () => bloc.add(const BookingMarketplaceHoldRequested()),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: creatingHold
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
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
  const _ClinicHeader({required this.clinicName, required this.petName});
  final String clinicName;
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
                  Text(clinicName, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text('Запись для: $petName'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  const _SlotCard({
    required this.slot,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final BookingSlot slot;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final time = TimeOfDay.fromDateTime(slot.startsAt.toLocal()).format(context);
    final end = TimeOfDay.fromDateTime(slot.endsAt.toLocal()).format(context);
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      color: selected ? colorScheme.secondaryContainer : colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: selected ? colorScheme.primary : Theme.of(context).dividerColor,
          width: selected ? 2 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off),
              const SizedBox(width: 12),
              Expanded(
                child: Text('$time–$end', style: Theme.of(context).textTheme.titleMedium),
              ),
              Text('Доступно', style: Theme.of(context).textTheme.labelMedium),
            ],
          ),
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
        child: Row(
          children: [
            const Icon(Icons.info_outline),
            const SizedBox(width: 10),
            Expanded(child: Text(text)),
          ],
        ),
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
        child: Column(
          children: [
            Icon(Icons.event_busy_outlined),
            SizedBox(height: 8),
            Text('На этот день свободных окон нет.'),
          ],
        ),
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
            child: _SkeletonBlock(height: 66, color: color),
          ),
        ),
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
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)),
      );
}

class _BookingHoldStatusPage extends StatelessWidget {
  const _BookingHoldStatusPage({required this.hold, required this.repository});
  final CreatedBookingHold hold;
  final BookingMarketplaceRepository? repository;

  @override
  Widget build(BuildContext context) {
    final manual = hold.state == 'MANUAL_CONFIRM_PENDING';
    return Scaffold(
      appBar: AppBar(title: const Text('Статус записи')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(
                manual ? Icons.hourglass_top_outlined : Icons.sync_outlined,
                size: 56,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 20),
              Text(
                manual ? 'Заявка отправлена в клинику' : 'Проверяем доступность времени',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text(
                manual
                    ? 'Клиника подтвердит запись в течение 15 минут. Мы покажем только итоговый статус VetHelp.'
                    : 'Клиника подтверждает доступность времени. Не закрывайте приложение, если хотите увидеть обновление сразу.',
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              OutlinedButton(
                onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                child: const Text('Вернуться к помощи питомцу'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _sameDay(DateTime first, DateTime second) {
  return first.year == second.year && first.month == second.month && first.day == second.day;
}

String _dayLabel(DateTime day) {
  final now = DateTime.now().toUtc();
  final today = DateTime.utc(now.year, now.month, now.day);
  if (_sameDay(day, today)) return 'Сегодня';
  if (_sameDay(day, today.add(const Duration(days: 1)))) return 'Завтра';
  return '${day.day.toString().padLeft(2, '0')}.${day.month.toString().padLeft(2, '0')}';
}
