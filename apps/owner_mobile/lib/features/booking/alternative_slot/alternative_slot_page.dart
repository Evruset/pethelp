import 'dart:io';
import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/clock/server_clock.dart';
import '../../../core/design_system/vh_shimmer.dart';
import 'alternative_slot_bloc.dart';
import 'alternative_slot_models.dart';

class AlternativeSlotPage extends ConsumerWidget {
  const AlternativeSlotPage({
    required this.holdId,
    super.key,
  });

  final String holdId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return BlocProvider<AlternativeSlotBloc>(
      create: (_) => AlternativeSlotBloc(
        holdId: holdId,
        repository: ref.read(alternativeSlotRepositoryProvider),
        networkGate: ref.read(networkGateProvider),
        serverClock: ref.read(serverClockProvider),
        operationIds: ref.read(operationIdStoreProvider),
      )..add(const AlternativeSlotOpened()),
      child: const _AlternativeSlotScreen(),
    );
  }
}

class _AlternativeSlotScreen extends StatelessWidget {
  const _AlternativeSlotScreen();

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AlternativeSlotBloc, AlternativeSlotState>(
      listener: (context, state) {
        if (state is AlternativeSlotSuccess) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute<void>(
              builder: (_) => _ResultPage(
                title: state.result.state == 'CONFIRMED' ? 'Новое время подтверждено' : 'Время перенесено',
                detail: state.result.state == 'CONFIRMED'
                    ? 'Клиника подтвердила новое время. Запись появилась в разделе «Мои визиты».'
                    : 'Запись продолжает подтверждаться в системе клиники.',
                icon: Icons.check_circle_outline,
              ),
            ),
          );
        }
      },
      builder: (context, state) {
        final content = switch (state) {
          AlternativeSlotLoading() => const _AlternativeSlotLoading(),
          AlternativeSlotActive(:final model) => _AlternativeSlotContent(model: model),
          AlternativeSlotSubmitting(:final model, :final action) => _AlternativeSlotContent(model: model, busyAction: action),
          AlternativeSlotSoftRetry(:final model) => _AlternativeSlotContent(
              model: model,
              banner: const _BannerData('Обновляем состояние записи. Не закрывайте экран.', BannerTone.info),
            ),
          AlternativeSlotFenced(:final reason, :final model) => model == null
              ? _FencedPage(reason: reason)
              : _AlternativeSlotContent(
                  model: model,
                  disabled: true,
                  banner: _BannerData(_fenceMessage(reason), BannerTone.warning),
                ),
          AlternativeSlotError(:final message, :final model) => model == null
              ? _ErrorPage(message: message)
              : _AlternativeSlotContent(
                  model: model,
                  banner: _BannerData(message, BannerTone.warning),
                ),
          _ => const _ErrorPage(message: 'Не удалось открыть запись.'),
        };

        return Scaffold(
          appBar: AppBar(title: const Text('Запись в клинику')),
          body: content,
        );
      },
    );
  }

  String _fenceMessage(BookingFenceReason reason) => switch (reason) {
        BookingFenceReason.expired => 'Время на решение истекло. Состояние записи обновлено.',
        BookingFenceReason.staleVersion => 'Запись изменилась в другой сессии. Получите актуальные данные.',
        BookingFenceReason.unavailable => 'Предложенное время больше недоступно.',
        BookingFenceReason.invalidTransition => 'Это действие больше недоступно для текущего статуса записи.',
      };
}

enum BannerTone { info, warning }

class _BannerData {
  const _BannerData(this.message, this.tone);
  final String message;
  final BannerTone tone;
}

class _AlternativeSlotContent extends StatelessWidget {
  const _AlternativeSlotContent({
    required this.model,
    this.busyAction,
    this.disabled = false,
    this.banner,
  });

  final AlternativeSlotViewModel model;
  final String? busyAction;
  final bool disabled;
  final _BannerData? banner;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<AlternativeSlotBloc>();
    final canAct = !disabled && busyAction == null;
    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              children: <Widget>[
                _HoldHeader(expiresAt: model.expiresAt),
                if (banner != null) ...<Widget>[
                  const SizedBox(height: 12),
                  _StatusBanner(data: banner!),
                ],
                const SizedBox(height: 20),
                const Text('Ваше исходное время', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                _SlotCard(
                  title: 'Удерживается за вами',
                  icon: Icons.lock_outline,
                  slot: model.originalSlot,
                  emphasis: SlotEmphasis.held,
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Icon(Icons.south, color: Color(0xFF667085)),
                ),
                const Text('Клиника предлагает перенос', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                _SlotCard(
                  title: 'Новое время удерживается до решения',
                  icon: Icons.swap_horiz,
                  slot: model.proposedSlot,
                  emphasis: SlotEmphasis.proposed,
                ),
                const SizedBox(height: 20),
                const Text(
                  'При принятии переноса система атомарно зафиксирует новое время. При отказе оба временных удержания будут освобождены.',
                  style: TextStyle(color: Color(0xFF667085), height: 1.4),
                ),
              ],
            ),
          ),
          _DecisionBar(
            enabled: canAct,
            busyAction: busyAction,
            onAccept: () => bloc.add(const AlternativeSlotAcceptPressed()),
            onDecline: () => _confirmDecline(context, bloc),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDecline(BuildContext context, AlternativeSlotBloc bloc) async {
    final accepted = Platform.isIOS
        ? await showCupertinoDialog<bool>(
            context: context,
            builder: (context) => CupertinoAlertDialog(
              title: const Text('Отклонить перенос?'),
              content: const Text('Клиника не сможет подтвердить исходное время. Оба временных удержания будут освобождены.'),
              actions: <Widget>[
                CupertinoDialogAction(onPressed: () => Navigator.pop(context, false), child: const Text('Назад')),
                CupertinoDialogAction(
                  isDestructiveAction: true,
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Отклонить'),
                ),
              ],
            ),
          )
        : await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Отклонить перенос?'),
              content: const Text('Клиника не сможет подтвердить исходное время. Оба временных удержания будут освобождены.'),
              actions: <Widget>[
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Назад')),
                FilledButton.tonal(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Отклонить'),
                ),
              ],
            ),
          );
    if (accepted == true && context.mounted) {
      bloc.add(const AlternativeSlotDeclinePressed());
    }
  }
}

class _HoldHeader extends StatefulWidget {
  const _HoldHeader({required this.expiresAt});
  final DateTime expiresAt;

  @override
  State<_HoldHeader> createState() => _HoldHeaderState();
}

class _HoldHeaderState extends State<_HoldHeader> {
  late final ValueNotifier<Duration> _remaining;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remaining = ValueNotifier<Duration>(_calculate());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _remaining.value = _calculate();
    });
  }

  Duration _calculate() => widget.expiresAt.difference(DateTime.now().toUtc());

  @override
  void dispose() {
    _timer?.cancel();
    _remaining.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFFEFF4FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFB2CCFF)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: <Widget>[
            const Icon(Icons.timer_outlined, color: Color(0xFF175CD3)),
            const SizedBox(width: 12),
            Expanded(
              child: ValueListenableBuilder<Duration>(
                valueListenable: _remaining,
                builder: (context, remaining, _) {
                  final seconds = remaining.isNegative ? 0 : remaining.inSeconds;
                  final text = '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Text('Решение можно принять до', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(text, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF175CD3))),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum SlotEmphasis { held, proposed }

class _SlotCard extends StatelessWidget {
  const _SlotCard({
    required this.title,
    required this.icon,
    required this.slot,
    required this.emphasis,
  });

  final String title;
  final IconData icon;
  final SlotViewModel? slot;
  final SlotEmphasis emphasis;

  @override
  Widget build(BuildContext context) {
    final color = emphasis == SlotEmphasis.held ? const Color(0xFF175CD3) : const Color(0xFF9E4A03);
    final background = emphasis == SlotEmphasis.held ? const Color(0xFFEFF4FF) : const Color(0xFFFFFAEB);
    if (slot == null) {
      return const _SlotSkeleton();
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: color)),
                  const SizedBox(height: 8),
                  Text(_dateTime(slot!.startsAt), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('${_time(slot!.startsAt)}–${_time(slot!.endsAt)}', style: const TextStyle(color: Color(0xFF475467))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _dateTime(DateTime value) => '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
  String _time(DateTime value) => '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}

class _DecisionBar extends StatelessWidget {
  const _DecisionBar({
    required this.enabled,
    required this.busyAction,
    required this.onAccept,
    required this.onDecline,
  });

  final bool enabled;
  final String? busyAction;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: <BoxShadow>[BoxShadow(color: Color(0x22000000), blurRadius: 12, offset: Offset(0, -3))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: enabled ? onDecline : null,
                  child: Text(busyAction == 'decline' ? 'Отклоняем…' : 'Отклонить'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: enabled ? onAccept : null,
                  child: Text(busyAction == 'accept' ? 'Принимаем…' : 'Принять'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.data});
  final _BannerData data;

  @override
  Widget build(BuildContext context) {
    final warning = data.tone == BannerTone.warning;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: warning ? const Color(0xFFFFFAEB) : const Color(0xFFEFF4FF),
        border: Border.all(color: warning ? const Color(0xFFFEC84B) : const Color(0xFFB2CCFF)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(data.message, style: const TextStyle(height: 1.35)),
      ),
    );
  }
}

class _AlternativeSlotLoading extends StatelessWidget {
  const _AlternativeSlotLoading();

  @override
  Widget build(BuildContext context) {
    return VhShimmer(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: const <Widget>[
          _Block(height: 96),
          SizedBox(height: 20),
          _Block(height: 150),
          SizedBox(height: 20),
          _Block(height: 150),
        ],
      ),
    );
  }
}

class _SlotSkeleton extends StatelessWidget {
  const _SlotSkeleton();

  @override
  Widget build(BuildContext context) => const VhShimmer(child: _Block(height: 150));
}

class _Block extends StatelessWidget {
  const _Block({required this.height});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(color: const Color(0xFFE8ECF2), borderRadius: BorderRadius.circular(16)),
    );
  }
}

class _FencedPage extends StatelessWidget {
  const _FencedPage({required this.reason});
  final BookingFenceReason reason;

  @override
  Widget build(BuildContext context) {
    final message = switch (reason) {
      BookingFenceReason.expired => 'Время на решение истекло. Запись больше нельзя изменить.',
      BookingFenceReason.staleVersion => 'Состояние записи изменилось. Откройте актуальную карточку.',
      BookingFenceReason.unavailable => 'Предложенное время больше недоступно.',
      BookingFenceReason.invalidTransition => 'Это действие недоступно для текущего статуса записи.',
    };
    return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(message, textAlign: TextAlign.center)));
  }
}

class _ErrorPage extends StatelessWidget {
  const _ErrorPage({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(message, textAlign: TextAlign.center)));
  }
}

class _ResultPage extends StatelessWidget {
  const _ResultPage({required this.title, required this.detail, required this.icon});
  final String title;
  final String detail;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Запись в клинику')),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(icon, size: 56, color: const Color(0xFF027A48)),
                const SizedBox(height: 16),
                Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(detail, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF667085), height: 1.4)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
