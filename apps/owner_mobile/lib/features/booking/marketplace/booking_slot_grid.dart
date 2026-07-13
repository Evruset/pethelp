import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../presentation/widgets/adaptive_hit_target.dart';
import '../../../presentation/platform/owner_platform.dart';
import 'booking_marketplace_repository.dart';

class BookingSlotGrid extends StatelessWidget {
  const BookingSlotGrid({
    super.key,
    required this.slots,
    required this.selectedSlot,
    required this.lockingSlot,
    required this.lockedSlot,
    required this.onSlotSelected,
    this.showServiceName = false,
  });

  final List<BookingSlot> slots;
  final BookingSlot? selectedSlot;
  final BookingSlot? lockingSlot;
  final BookingSlot? lockedSlot;
  final ValueChanged<BookingSlot> onSlotSelected;
  final bool showServiceName;

  @override
  Widget build(BuildContext context) {
    final interactionsBlocked = lockingSlot != null;
    return SliverGrid.builder(
      itemCount: slots.length,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 190,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.75,
      ),
      itemBuilder: (context, index) {
        final slot = slots[index];
        final selected = selectedSlot?.id == slot.id;
        final locking = lockingSlot?.id == slot.id;
        final locked = lockedSlot?.id == slot.id;
        return AbsorbPointer(
          absorbing: interactionsBlocked && !locking,
          child: BookingSlotTile(
            slot: slot,
            selected: selected,
            locking: locking,
            locked: locked,
            enabled: !interactionsBlocked && slot.remainingCapacity > 0,
            showServiceName: showServiceName,
            onTap: () {
              HapticFeedback.lightImpact();
              onSlotSelected(slot);
            },
          ),
        );
      },
    );
  }
}

class BookingSlotTile extends StatelessWidget {
  const BookingSlotTile({
    super.key,
    required this.slot,
    required this.selected,
    required this.locking,
    required this.locked,
    required this.enabled,
    required this.onTap,
    this.showServiceName = true,
  });

  final BookingSlot slot;
  final bool selected;
  final bool locking;
  final bool locked;
  final bool enabled;
  final VoidCallback onTap;
  final bool showServiceName;

  @override
  Widget build(BuildContext context) {
    final time =
        TimeOfDay.fromDateTime(slot.startsAt.toLocal()).format(context);
    final end = TimeOfDay.fromDateTime(slot.endsAt.toLocal()).format(context);
    final service = slot.serviceName;
    final colors = Theme.of(context).colorScheme;
    final isCupertino = Theme.of(context).platform == TargetPlatform.iOS;
    final active = selected || locking || locked;
    final foreground = locked || (isCupertino && active)
        ? CupertinoColors.white
        : enabled
            ? colors.onSurface
            : colors.onSurfaceVariant;
    final background = locked
        ? CupertinoColors.activeBlue
        : active
            ? colors.secondaryContainer
            : colors.surface;

    return AnimatedScale(
      duration: ownerMotionDuration(
        context,
        const Duration(milliseconds: 140),
      ),
      scale: active ? 0.98 : 1,
      child: AdaptiveHitTarget(
        enabled: enabled,
        onTap: enabled ? onTap : null,
        semanticLabel: 'Выбрать время $time',
        child: AnimatedContainer(
          key: ValueKey<String>('booking-slot-${slot.id}'),
          duration: ownerMotionDuration(
            context,
            const Duration(milliseconds: 160),
          ),
          constraints: const BoxConstraints(minHeight: kVetHelpMinTapTarget),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: active ? colors.primary : Theme.of(context).dividerColor,
              width: active ? 2 : 1,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: _SlotTileContent(
              time: time,
              end: end,
              service: service,
              foreground: foreground,
              isCupertino: isCupertino,
              selected: selected,
              locking: locking,
              locked: locked,
              showServiceName: showServiceName,
            ),
          ),
        ),
      ),
    );
  }
}

class _SlotTileContent extends StatelessWidget {
  const _SlotTileContent({
    required this.time,
    required this.end,
    required this.service,
    required this.foreground,
    required this.isCupertino,
    required this.selected,
    required this.locking,
    required this.locked,
    required this.showServiceName,
  });

  final String time;
  final String end;
  final String? service;
  final Color foreground;
  final bool isCupertino;
  final bool selected;
  final bool locking;
  final bool locked;
  final bool showServiceName;

  @override
  Widget build(BuildContext context) {
    final textScaler = MediaQuery.textScalerOf(context);
    final compact = textScaler.scale(1) > 1.25;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: Center(
                child: switch ((locking, locked, selected)) {
                  (true, _, _) => isCupertino
                      ? const CupertinoActivityIndicator()
                      : const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                  (_, true, _) => const Icon(
                      CupertinoIcons.check_mark,
                      size: 18,
                      color: CupertinoColors.white,
                    ),
                  (_, _, true) => Icon(
                      Icons.radio_button_checked,
                      size: 18,
                      color: foreground,
                    ),
                  _ => Icon(
                      Icons.radio_button_off,
                      size: 18,
                      color: foreground,
                    ),
                },
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                time,
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(color: foreground),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        if (!compact) const SizedBox(height: 4),
        Text(
          'до $end',
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: foreground),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (showServiceName && service != null && !compact)
          Text(
            service!,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: foreground),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }
}
