import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter/services.dart';

import 'alternative_slot_bloc.dart';
import 'alternative_slot_repository.dart';

class AlternativeSlotPage extends StatelessWidget {
  const AlternativeSlotPage(
      {super.key, required this.holdId, required this.repository});

  final String holdId;
  final AlternativeSlotRepository repository;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => AlternativeSlotBloc(repository: repository)
        ..add(AlternativeSlotOpened(holdId)),
      child: const AlternativeSlotView(),
    );
  }
}

class AlternativeSlotView extends StatelessWidget {
  const AlternativeSlotView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Другое время')),
      body: BlocConsumer<AlternativeSlotBloc, AlternativeSlotState>(
        listener: (context, state) {
          if (state is AlternativeSlotAcceptedState ||
              state is AlternativeSlotDeclinedState) {
            HapticFeedback.mediumImpact();
          }
        },
        builder: (context, state) {
          return switch (state) {
            AlternativeSlotLoading() =>
              const Center(child: CircularProgressIndicator()),
            AlternativeSlotActive(snapshot: final snapshot) =>
              _Active(snapshot: snapshot),
            AlternativeSlotAccepting(snapshot: final snapshot) =>
              _Active(snapshot: snapshot, busyAction: _BusyAction.accept),
            AlternativeSlotDeclining(snapshot: final snapshot) =>
              _Active(snapshot: snapshot, busyAction: _BusyAction.decline),
            AlternativeSlotAcceptedState(result: final result) =>
              _Success(result: result),
            AlternativeSlotDeclinedState() => const _Declined(),
            AlternativeSlotSoftRetry(message: final message) =>
              _Message(message: message, retry: true),
            AlternativeSlotFencedState(reason: final reason) =>
              _Message(message: _safeReason(reason)),
            AlternativeSlotErrorState(message: final message) =>
              _Message(message: message, retry: true),
          };
        },
      ),
    );
  }

  static String _safeReason(String reason) {
    return switch (reason) {
      'HOLD_EXPIRED' => 'Предложение истекло. Обновите запись.',
      'SLOT_ALREADY_TAKEN' => 'Предложенное время уже недоступно.',
      'HOLD_NOT_FOUND' => 'Активное предложение не найдено или уже завершено.',
      'INVALID_STATE_TRANSITION' =>
        'Предложение уже изменилось. Обновите запись.',
      _ => 'Состояние записи изменилось. Обновите экран.',
    };
  }
}

enum _BusyAction { accept, decline }

class _Active extends StatelessWidget {
  const _Active({required this.snapshot, this.busyAction});

  final AlternativeSlotSnapshot snapshot;
  final _BusyAction? busyAction;

  bool get _busy => busyAction != null;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  leading: const Icon(Icons.lock_clock),
                  title: const Text('Исходное время удерживается за вами'),
                  subtitle: Text(_formatRange(snapshot.originalSlot)),
                ),
              ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.swap_horiz),
                  title: const Text('Новое время от клиники'),
                  subtitle: Text(_formatRange(snapshot.alternativeSlot)),
                ),
              ),
              Card(
                  child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: _ServerCountdown(snapshot: snapshot))),
              const SizedBox(height: 12),
              const Text(
                  'Итоговый статус обновится после ответа VetHelp и клиники.'),
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton.icon(
                onPressed: _busy
                    ? null
                    : () => context
                        .read<AlternativeSlotBloc>()
                        .add(const AlternativeSlotAcceptPressed()),
                icon: busyAction == _BusyAction.accept
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: Text(busyAction == _BusyAction.accept
                    ? 'Принимаем...'
                    : 'Принять новое время'),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _busy ? null : () => _confirmDecline(context),
                icon: busyAction == _BusyAction.decline
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.event_busy_outlined),
                label: Text(busyAction == _BusyAction.decline
                    ? 'Отказываемся...'
                    : 'Не подходит'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmDecline(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Отказаться от времени?'),
        content: const Text(
          'VetHelp освободит исходное и предложенное время. Для новой записи нужно будет выбрать слот заново.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Назад'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Отказаться'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    context
        .read<AlternativeSlotBloc>()
        .add(const AlternativeSlotDeclinePressed());
  }

  String _formatRange(SlotSnapshot slot) {
    final start = slot.startsAt.toLocal();
    final end = slot.endsAt.toLocal();
    return '${start.day.toString().padLeft(2, '0')}.${start.month.toString().padLeft(2, '0')} ${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}–${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
  }
}

class _ServerCountdown extends StatefulWidget {
  const _ServerCountdown({required this.snapshot});

  final AlternativeSlotSnapshot snapshot;

  @override
  State<_ServerCountdown> createState() => _ServerCountdownState();
}

class _ServerCountdownState extends State<_ServerCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.snapshot.expiresAt
        .difference(widget.snapshot.authoritativeNow(DateTime.now().toUtc()));
    final seconds = remaining.inSeconds.clamp(0, 24 * 60 * 60);
    final minutesText = (seconds ~/ 60).toString().padLeft(2, '0');
    final secondsText = (seconds % 60).toString().padLeft(2, '0');
    final critical = seconds <= 60;
    return Row(
      children: [
        Icon(critical ? Icons.warning_amber_rounded : Icons.timer_outlined,
            color: critical ? Theme.of(context).colorScheme.error : null),
        const SizedBox(width: 12),
        Text('Осталось $minutesText:$secondsText',
            style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}

class _Success extends StatelessWidget {
  const _Success({required this.result});

  final AlternativeSlotAccepted result;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: 0.8, end: 1),
              duration: const Duration(milliseconds: 180),
              builder: (context, scale, child) =>
                  Transform.scale(scale: scale, child: child),
              child: Icon(Icons.check_circle_outline,
                  size: 64, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(height: 16),
            Text('Новое время принято',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text(
              'VetHelp обновит запись и покажет актуальный статус в разделе записей.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.calendar_month_outlined),
              label: const Text('К записи'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Declined extends StatelessWidget {
  const _Declined();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.event_busy_outlined,
              size: 64,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              'Предложение отклонено',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'Запись освобождена. Вы можете выбрать другое время в каталоге клиник.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.calendar_month_outlined),
              label: const Text('К записям'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.message, this.retry = false});

  final String message;
  final bool retry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            if (retry) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => context
                    .read<AlternativeSlotBloc>()
                    .add(const AlternativeSlotRefreshRequested()),
                child: const Text('Обновить'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
