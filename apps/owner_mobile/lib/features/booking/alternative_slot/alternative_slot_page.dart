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
      appBar: AppBar(title: const Text('Клиника предлагает другое время')),
      body: BlocConsumer<AlternativeSlotBloc, AlternativeSlotState>(
        listener: (context, state) {
          if (state is AlternativeSlotAcceptedState) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Новое время принято')));
          }
        },
        builder: (context, state) {
          return switch (state) {
            AlternativeSlotLoading() => const _LoadingState(),
            AlternativeSlotActive(snapshot: final snapshot) => _ActiveState(snapshot: snapshot),
            AlternativeSlotAccepting(snapshot: final snapshot) => _ActiveState(snapshot: snapshot, accepting: true),
            AlternativeSlotAcceptedState(result: final result) => _SuccessState(result: result),
            AlternativeSlotSoftRetry(message: final message) => _MessageState(message: message, retry: true),
            AlternativeSlotFencedState(reason: final reason) => _MessageState(message: _safeReason(reason)),
            AlternativeSlotErrorState(message: final message) => _MessageState(message: message, retry: true),
          };
        },
      ),
    );
  }

  static String _safeReason(String reason) {
    return switch (reason) {
      'HOLD_EXPIRED' => 'Предложение истекло. Обновите запись.',
      'SLOT_ALREADY_TAKEN' => 'Предложенное время уже недоступно.',
      'FORBIDDEN' => 'Нет доступа к этой записи.',
      _ => 'Состояние записи изменилось. Обновите экран.',
    };
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _SkeletonCard(height: 96),
        SizedBox(height: 12),
        _SkeletonCard(height: 140),
        SizedBox(height: 12),
        _SkeletonCard(height: 80),
      ],
    );
  }
}

class _ActiveState extends StatelessWidget {
  const _ActiveState({required this.snapshot, this.accepting = false});

  final AlternativeSlotSnapshot snapshot;
  final bool accepting;

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
                  title: const Text('Исходное время удерживается за вами'),
                  subtitle: Text('Слот: ${snapshot.sourceSlotId}'),
                  leading: const Icon(Icons.lock_clock),
                ),
              ),
              Card(
                child: ListTile(
                  title: const Text('Новое время от клиники'),
                  subtitle: Text('Слот: ${snapshot.alternativeSlotId}'),
                  leading: const Icon(Icons.swap_horiz),
                ),
              ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _Countdown(expiresAt: snapshot.expiresAt),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text('После принятия VetHelp освободит лишний слот только на backend.'),
              ),
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: accepting ? null : () => context.read<AlternativeSlotBloc>().add(const AlternativeSlotAcceptPressed()),
            child: Text(accepting ? 'Принимаем...' : 'Принять новое время'),
          ),
        ),
      ],
    );
  }
}

class _Countdown extends StatefulWidget {
  const _Countdown({required this.expiresAt});

  final DateTime expiresAt;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  late Timer _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = widget.expiresAt.difference(DateTime.now().toUtc());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _remaining = widget.expiresAt.difference(DateTime.now().toUtc()));
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final seconds = _remaining.inSeconds.clamp(0, 24 * 60 * 60);
    final text = '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
    return Row(
      children: [
        const Icon(Icons.timer_outlined),
        const SizedBox(width: 12),
        Text('Осталось $text', style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}

class _SuccessState extends StatelessWidget {
  const _SuccessState({required this.result});

  final AlternativeSlotAccepted result;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, size: 56, color: Colors.green),
            const SizedBox(height: 16),
            const Text('Новое время принято', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text('Активный слот: ${result.slotId}', textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _MessageState extends StatelessWidget {
  const _MessageState({required this.message, this.retry = false});

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
            const Icon(Icons.info_outline, size: 48),
            const SizedBox(height: 16),
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

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}
