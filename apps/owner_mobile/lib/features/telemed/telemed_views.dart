import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/clock/server_clock.dart';
import '../../core/design_system/vh_shimmer.dart';
import 'livekit_media_gateway.dart';
import 'telemed_bloc.dart';
import 'telemed_call_view.dart';
import 'telemed_models.dart';

Future<void> showActionBlockedDialog(BuildContext context) async {
  if (Theme.of(context).platform == TargetPlatform.iOS) {
    await showCupertinoDialog<void>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('No Internet Connection. Action Blocked'),
        content: const Text('Для этого действия требуется соединение с VetHelp.'),
        actions: <Widget>[CupertinoDialogAction(onPressed: () => Navigator.pop(context), child: const Text('Понятно'))],
      ),
    );
  } else {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('No Internet Connection. Action Blocked'),
        content: const Text('Для этого действия требуется соединение с VetHelp.'),
        actions: <Widget>[TextButton(onPressed: () => Navigator.pop(context), child: const Text('Понятно'))],
      ),
    );
  }
}

class WaitingRoomView extends StatelessWidget {
  const WaitingRoomView({required this.snapshot, required this.serverClock, super.key});
  final TelemedSnapshot snapshot;
  final ServerClock serverClock;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: <Widget>[
          const SizedBox(height: 24),
          const Icon(Icons.medical_services_outlined, size: 72, color: Color(0xFF175CD3)),
          const SizedBox(height: 20),
          const Text('Ожидаем врача', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          const Text('Подключение произойдёт автоматически, когда врач войдёт в консультацию.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF667085), height: 1.4)),
          const SizedBox(height: 28),
          WaitingCountdown(deadline: snapshot.doctorJoinDeadlineAt, serverClock: serverClock),
          const SizedBox(height: 18),
          DecoratedBox(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), color: const Color(0xFFFFFAEB), border: Border.all(color: const Color(0xFFFEC84B))),
            child: const Padding(padding: EdgeInsets.all(16), child: Text('Если состояние питомца ухудшается, не ждите консультацию — обратитесь в ближайшую клинику или экстренную службу.')),
          ),
        ],
      ),
    );
  }
}

class WaitingCountdown extends StatefulWidget {
  const WaitingCountdown({required this.deadline, required this.serverClock, super.key});
  final DateTime deadline;
  final ServerClock serverClock;

  @override
  State<WaitingCountdown> createState() => _WaitingCountdownState();
}

class _WaitingCountdownState extends State<WaitingCountdown> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = _read();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _remaining = _read());
    });
  }

  Duration _read() => widget.serverClock.remainingUntil(widget.deadline.toIso8601String());

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final seconds = _remaining.isNegative ? 0 : _remaining.inSeconds;
    final clock = '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), color: const Color(0xFFEFF4FF), border: Border.all(color: const Color(0xFFB2CCFF))),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: <Widget>[
          const Text('Проверяем подключение врача', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(clock, style: const TextStyle(fontSize: 42, fontWeight: FontWeight.w800, color: Color(0xFF175CD3))),
          const SizedBox(height: 4),
          const Text('Таймер синхронизирован с VetHelp', style: TextStyle(color: Color(0xFF667085))),
        ]),
      ),
    );
  }
}

class JoiningRoomView extends StatelessWidget {
  const JoiningRoomView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[CircularProgressIndicator(), SizedBox(height: 16), Text('Подключаемся к консультации…')]));
}

class CallRoomView extends StatelessWidget {
  const CallRoomView({required this.snapshot, required this.media, super.key});
  final TelemedSnapshot snapshot;
  final MediaViewState media;
  @override
  Widget build(BuildContext context) => TelemedCallView(snapshot: snapshot, media: media);
}

class EndingRoomView extends StatelessWidget {
  const EndingRoomView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Padding(padding: EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[CircularProgressIndicator(), SizedBox(height: 16), Text('Завершаем консультацию…', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)), SizedBox(height: 8), Text('Ожидаем подтверждение от видеосервиса.', textAlign: TextAlign.center)])));
}

class CompletedRoomView extends StatelessWidget {
  const CompletedRoomView({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: Padding(padding: EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[Icon(Icons.check_circle_outline, size: 56, color: Color(0xFF027A48)), SizedBox(height: 16), Text('Консультация завершена', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700))])));
}

class DoctorTimeoutView extends StatelessWidget {
  const DoctorTimeoutView({required this.snapshot, super.key});
  final TelemedSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final returned = snapshot.refundStatus == TelemedRefundStatus.voided || snapshot.refundStatus == TelemedRefundStatus.refunded;
    final text = returned ? 'Врач не вышел на связь. Деньги автоматически возвращены на вашу карту.' : 'Врач не вышел на связь. Возврат автоматически оформлен и ожидает подтверждение банка.';
    return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[const Icon(Icons.info_outline, size: 56, color: Color(0xFFB54708)), const SizedBox(height: 16), Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, height: 1.3))])));
  }
}

class TelemedErrorView extends StatelessWidget {
  const TelemedErrorView({required this.message, super.key});
  final String message;
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[Text(message, textAlign: TextAlign.center), const SizedBox(height: 16), FilledButton(onPressed: () => context.read<TelemedBloc>().add(const TelemedPollRequested()), child: const Text('Обновить'))])));
}

class TelemedLoadingView extends StatelessWidget {
  const TelemedLoadingView({super.key});
  @override
  Widget build(BuildContext context) => VhShimmer(child: ListView(padding: const EdgeInsets.all(24), children: const <Widget>[_Block(height: 72), SizedBox(height: 24), _Block(height: 180), SizedBox(height: 24), _Block(height: 100)]));
}

class _Block extends StatelessWidget {
  const _Block({required this.height});
  final double height;
  @override
  Widget build(BuildContext context) => Container(height: height, decoration: BoxDecoration(color: const Color(0xFFE8ECF2), borderRadius: BorderRadius.circular(16)));
}
