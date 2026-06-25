import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'telemed_waiting_room_bloc.dart';

class TelemedWaitingRoomPage extends StatelessWidget {
  const TelemedWaitingRoomPage({
    super.key,
    required this.sessionId,
    required this.repository,
  });

  final String sessionId;
  final TelemedWaitingRepository repository;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => TelemedWaitingBloc(repository: repository)..add(TelemedWaitingOpened(sessionId)),
      child: const _TelemedWaitingRoomView(),
    );
  }
}

class _TelemedWaitingRoomView extends StatelessWidget {
  const _TelemedWaitingRoomView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Консультация VetHelp')),
      body: BlocBuilder<TelemedWaitingBloc, TelemedWaitingState>(
        builder: (context, state) {
          return switch (state) {
            TelemedWaitingLoading() => const _WaitingSkeleton(),
            TelemedWaitingForDoctor(snapshot: final snapshot) => _WaitingForDoctor(snapshot: snapshot),
            TelemedConnectingRoom() => const _ConnectingRoom(),
            TelemedDoctorTimeout() => const _DoctorTimeout(),
            TelemedCompleted() => const _Completed(),
            TelemedWaitingError(message: final message) => _Error(message: message),
          };
        },
      ),
    );
  }
}

class _WaitingSkeleton extends StatelessWidget {
  const _WaitingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _PlaceholderCard(height: 160),
        SizedBox(height: 16),
        _PlaceholderCard(height: 88),
        SizedBox(height: 16),
        _PlaceholderCard(height: 72),
      ],
    );
  }
}

class _WaitingForDoctor extends StatelessWidget {
  const _WaitingForDoctor({required this.snapshot});

  final TelemedWaitingSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Icon(Icons.medical_services_outlined, size: 52),
                      SizedBox(height: 12),
                      Text('Ожидаем подключения врача', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w600)),
                      SizedBox(height: 8),
                      Text('Не закрывайте экран. Мы покажем актуальный статус, как только он изменится.', textAlign: TextAlign.center),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(child: Padding(padding: const EdgeInsets.all(16), child: _ServerCountdown(snapshot: snapshot))),
              const SizedBox(height: 16),
              const Card(
                child: ListTile(
                  leading: Icon(Icons.health_and_safety_outlined),
                  title: Text('Важно'),
                  subtitle: Text('При ухудшении состояния питомца не ждите консультацию: используйте экстренный маршрут.'),
                ),
              ),
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: OutlinedButton(
            onPressed: () => context.read<TelemedWaitingBloc>().add(const TelemedWaitingRefreshRequested()),
            child: const Text('Проверить статус'),
          ),
        ),
      ],
    );
  }
}

class _ServerCountdown extends StatefulWidget {
  const _ServerCountdown({required this.snapshot});

  final TelemedWaitingSnapshot snapshot;

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
    final remaining = widget.snapshot.remainingAt(DateTime.now().toUtc());
    final totalSeconds = remaining.inSeconds.clamp(0, 3600);
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    final critical = totalSeconds <= 30;
    return Row(
      children: [
        Icon(critical ? Icons.warning_amber_rounded : Icons.timer_outlined, color: critical ? Theme.of(context).colorScheme.error : null),
        const SizedBox(width: 12),
        Expanded(child: Text(critical ? 'Проверяем статус подключения' : 'Ожидаем врача: $minutes:$seconds')),
      ],
    );
  }
}

class _ConnectingRoom extends StatelessWidget {
  const _ConnectingRoom();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [CircularProgressIndicator(), SizedBox(height: 16), Text('Врач подключился. Готовим консультацию...')]));
  }
}

class _DoctorTimeout extends StatelessWidget {
  const _DoctorTimeout();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Врач не вышел на связь. Проверяем автоматический возврат средств.', textAlign: TextAlign.center)));
  }
}

class _Completed extends StatelessWidget {
  const _Completed();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Консультация завершена'));
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(message, textAlign: TextAlign.center)));
  }
}

class _PlaceholderCard extends StatelessWidget {
  const _PlaceholderCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(16)),
    );
  }
}
