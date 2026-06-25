import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'alternative_slot_bloc.dart';
import 'alternative_slot_repository.dart';

class AlternativeSlotPage extends StatelessWidget {
  const AlternativeSlotPage({super.key, required this.holdId, required this.repository});

  final String holdId;
  final AlternativeSlotRepository repository;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => AlternativeSlotBloc(repository: repository)..add(AlternativeSlotOpened(holdId)),
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
      body: BlocBuilder<AlternativeSlotBloc, AlternativeSlotState>(
        builder: (context, state) {
          return switch (state) {
            AlternativeSlotLoading() => const Center(child: CircularProgressIndicator()),
            AlternativeSlotActive(snapshot: final snapshot) => _Active(snapshot: snapshot),
            AlternativeSlotAccepting(snapshot: final snapshot) => _Active(snapshot: snapshot, busy: true),
            AlternativeSlotAcceptedState(result: final result) => _Success(result: result),
            AlternativeSlotSoftRetry(message: final message) => _Message(message: message, retry: true),
            AlternativeSlotFencedState(reason: final reason) => _Message(message: _safeReason(reason)),
            AlternativeSlotErrorState(message: final message) => _Message(message: message, retry: true),
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
      _ => 'Состояние записи изменилось. Обновите экран.',
    };
  }
}

class _Active extends StatelessWidget {
  const _Active({required this.snapshot, this.busy = false});

  final AlternativeSlotSnapshot snapshot;
  final bool busy;

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
              Card(child: Padding(padding: const EdgeInsets.all(16), child: _ServerCountdown(snapshot: snapshot))),
              const SizedBox(height: 12),
              const Text('Клиент не подтверждает успех локально: итоговый статус приходит от backend.'),
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: busy ? null : () => context.read<AlternativeSlotBloc>().add(const AlternativeSlotAcceptPressed()),
            child: Text(busy ? 'Принимаем...' : 'Принять новое время'),
          ),
        ),
      ],
    );
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
    final remaining = widget.snapshot.expiresAt.difference(widget.snapshot.authoritativeNow(DateTime.now().toUtc()));
    final seconds = remaining.inSeconds.clamp(0, 24 * 60 * 60);
    final minutesText = (seconds ~/ 60).toString().padLeft(2, '0');
    final secondsText = (seconds % 60).toString().padLeft(2, '0');
    final critical = seconds <= 60;
    return Row(
      children: [
        Icon(critical ? Icons.warning_amber_rounded : Icons.timer_outlined, color: critical ? Theme.of(context).colorScheme.error : null),
        const SizedBox(width: 12),
        Text('Осталось $minutesText:$secondsText', style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}

class _Success extends StatelessWidget {
  const _Success({required this.result});

  final AlternativeSlotAccepted result;

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Новое время принято', textAlign: TextAlign.center));
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
                onPressed: () => context.read<AlternativeSlotBloc>().add(const AlternativeSlotRefreshRequested()),
                child: const Text('Обновить'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
