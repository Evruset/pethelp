import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'alternative_slot_bloc.dart';
import 'alternative_slot_repository.dart';

class AlternativeSlotPage extends StatelessWidget {
  const AlternativeSlotPage(
      {super.key,
      required this.holdId,
      required this.repository,
      this.offline = false,
      this.evidenceInitialAccept = false});
  final String holdId;
  final AlternativeSlotRepository repository;
  final bool offline;
  final bool evidenceInitialAccept;
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => AlternativeSlotBloc(
            repository: repository,
            offline: offline,
            evidenceInitialAccept: evidenceInitialAccept)
          ..add(AlternativeSlotOpened(holdId)),
        child: const AlternativeSlotView(),
      );
}

class AlternativeSlotView extends StatelessWidget {
  const AlternativeSlotView({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Другое время')),
        body: BlocConsumer<AlternativeSlotBloc, AlternativeSlotState>(
          listener: (context, state) {
            if (state is AlternativeSlotDeclinedState) {
              Navigator.of(context).pop(state.intent);
              HapticFeedback.mediumImpact();
            }
          },
          builder: (context, state) => switch (state) {
            AlternativeSlotLoading() =>
              const Center(child: CircularProgressIndicator()),
            AlternativeSlotActive(snapshot: final s) => _Active(
                snapshot: s,
                offline: context.read<AlternativeSlotBloc>().offline),
            AlternativeSlotSubmitting(snapshot: final s, accept: final a) =>
              _Active(
                  snapshot: s,
                  busy: a ? 'accept' : 'decline',
                  offline: context.read<AlternativeSlotBloc>().offline),
            AlternativeSlotDeclinedState() => const _Message(
                message: 'Предложение отклонено. Возвращаем к выбору времени.'),
            AlternativeSlotFencedState(reason: final r) =>
              _Message(message: _reason(r)),
            AlternativeSlotErrorState(message: final m, retry: final retry) =>
              _Message(message: m, retry: retry),
          },
        ),
      );
  static String _reason(String code) => switch (code) {
        'PROPOSAL_EXPIRED' || 'HOLD_EXPIRED' => 'Срок предложения истёк.',
        'PROPOSAL_SUPERSEDED' => 'Клиника уже прислала новое предложение.',
        'SLOT_UNAVAILABLE' ||
        'SLOT_ALREADY_TAKEN' =>
          'Предложенное время уже недоступно.',
        'VERSION_CONFLICT' ||
        'PRECONDITION_FAILED' =>
          'Запись изменилась. Обновите экран.',
        'PROPOSAL_DECLINED' => 'Предложение отклонено.',
        _ => 'Состояние предложения изменилось. Обновите экран.',
      };
}

class _Active extends StatelessWidget {
  const _Active({required this.snapshot, this.busy, this.offline = false});
  final AlternativeSlotSnapshot snapshot;
  final String? busy;
  final bool offline;
  @override
  Widget build(BuildContext context) {
    final expired =
        snapshot.deadline.isBefore(snapshot.authoritativeNow(DateTime.now()));
    final accept = snapshot.isPending &&
        snapshot.canAccept &&
        !expired &&
        busy == null &&
        !offline;
    final decline = snapshot.isPending &&
        snapshot.canDecline &&
        !expired &&
        busy == null &&
        !offline;
    return Column(children: [
      Expanded(
          child: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Сравните варианты',
            style: Theme.of(context).textTheme.headlineSmall),
        if (offline)
          const Card(
              color: Color(0xFFFFF4D6),
              child: ListTile(
                  leading: Icon(Icons.cloud_off_outlined),
                  title: Text('Нет сети — показано сохранённое предложение'),
                  subtitle: Text(
                      'Подключитесь к интернету, чтобы проверить статус и отправить решение.'))),
        const SizedBox(height: 12),
        _SlotCard(
            title: 'Текущее время',
            slot: snapshot.originalSlot,
            icon: Icons.event_outlined),
        const Center(child: Icon(Icons.arrow_downward_rounded)),
        _SlotCard(
            title: 'Предложение клиники',
            slot: snapshot.alternativeSlot,
            icon: Icons.swap_horiz),
        if (snapshot.priceCopy case final price?)
          Card(
              child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(children: [
                    const Icon(Icons.payments_outlined),
                    const SizedBox(width: 12),
                    Expanded(child: Text(price))
                  ]))),
        if (snapshot.isPending)
          Card(
              child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _Countdown(snapshot: snapshot))),
        if (!snapshot.isPending)
          Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_stateCopy(snapshot.state),
                  textAlign: TextAlign.center)),
      ])),
      SafeArea(
          minimum: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            FilledButton.icon(
                onPressed: accept
                    ? () => context
                        .read<AlternativeSlotBloc>()
                        .add(const AlternativeSlotAcceptPressed())
                    : null,
                icon: busy == 'accept'
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.check),
                label: Text(busy == 'accept'
                    ? 'Проверяем решение…'
                    : 'Принять новое время')),
            const SizedBox(height: 8),
            TextButton(
                onPressed: decline ? () => _confirm(context) : null,
                child: Text(
                    busy == 'decline' ? 'Проверяем отказ…' : 'Не подходит')),
          ])),
    ]);
  }

  Future<void> _confirm(BuildContext context) async {
    final ok = await showAlternativeDeclineDialog(context);
    if (ok == true && context.mounted) {
      context
          .read<AlternativeSlotBloc>()
          .add(const AlternativeSlotDeclinePressed());
    }
  }

  static String _stateCopy(String state) => switch (state) {
        'ACCEPTED' => 'Новое время принято сервером.',
        'DECLINED' => 'Предложение отклонено.',
        'EXPIRED' => 'Срок предложения истёк.',
        'SUPERSEDED' => 'Есть более новое предложение.',
        'UNAVAILABLE' => 'Время уже недоступно.',
        _ => 'Решение обрабатывается.'
      };
}

Future<bool?> showAlternativeDeclineDialog(BuildContext context) => showDialog<
        bool>(
    context: context,
    builder: (d) => AlertDialog(
            title: const Text('Отклонить предложение?'),
            content: const Text(
                'Предложенное время будет освобождено, а исходная заявка останется в ожидании. Новое время вы выберете самостоятельно — запись автоматически не создаётся.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(d, false),
                  child: const Text('Назад')),
              FilledButton(
                  onPressed: () => Navigator.pop(d, true),
                  child: const Text('Отклонить'))
            ]));

class _SlotCard extends StatelessWidget {
  const _SlotCard(
      {required this.title, required this.slot, required this.icon});
  final String title;
  final SlotSnapshot slot;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
      child: ListTile(
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(_range(slot))));
  static String _range(SlotSnapshot s) {
    final a = s.startsAt.toLocal(), b = s.endsAt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(a.day)}.${two(a.month)}.${a.year}, ${two(a.hour)}:${two(a.minute)}–${two(b.hour)}:${two(b.minute)}';
  }
}

class _Countdown extends StatefulWidget {
  const _Countdown({required this.snapshot});
  final AlternativeSlotSnapshot snapshot;
  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  Timer? timer;
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final seconds = widget.snapshot.deadline
        .difference(widget.snapshot.authoritativeNow(DateTime.now()))
        .inSeconds
        .clamp(0, 86400);
    return Row(children: [
      const Icon(Icons.timer_outlined),
      const SizedBox(width: 12),
      Expanded(
          child: Text(seconds == 0
              ? 'Срок предложения истёк'
              : 'Ответьте в течение ${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}'))
    ]);
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.message, this.retry = false});
  final String message;
  final bool retry;
  @override
  Widget build(BuildContext context) => Center(
      child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(message, textAlign: TextAlign.center),
            if (retry) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                  onPressed: () => context
                      .read<AlternativeSlotBloc>()
                      .add(const AlternativeSlotRefreshRequested()),
                  child: const Text('Обновить'))
            ]
          ])));
}
