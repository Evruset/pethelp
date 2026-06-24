import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import 'livekit_media_gateway.dart';
import 'telemed_bloc.dart';
import 'telemed_views.dart';

class TelemedPage extends ConsumerWidget {
  const TelemedPage({required this.sessionId, super.key});

  final String sessionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return BlocProvider<TelemedBloc>(
      create: (_) => TelemedBloc(
        sessionId: sessionId,
        repository: ref.read(telemedRepositoryProvider),
        media: LiveKitMediaGateway(),
        networkGate: ref.read(networkGateProvider),
        serverClock: ref.read(serverClockProvider),
        operationIds: ref.read(operationIdStoreProvider),
      )..add(const TelemedOpened()),
      child: _Screen(serverClock: ref.read(serverClockProvider)),
    );
  }
}

class _Screen extends StatelessWidget {
  const _Screen({required this.serverClock});
  final dynamic serverClock;

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<TelemedBloc, TelemedState>(
      listener: (context, state) {
        if (state is TelemedError && state.message == 'No Internet Connection. Action Blocked') {
          showActionBlockedDialog(context);
        }
      },
      builder: (context, state) {
        final body = switch (state) {
          TelemedLoading() => const TelemedLoadingView(),
          TelemedWaitingForDoctor(:final snapshot) => WaitingRoomView(snapshot: snapshot, serverClock: serverClock),
          TelemedJoiningRoom() => const JoiningRoomView(),
          TelemedInCall(:final snapshot, :final media) => CallRoomView(snapshot: snapshot, media: media),
          TelemedEnding() => const EndingRoomView(),
          TelemedCompleted() => const CompletedRoomView(),
          TelemedDoctorTimeout(:final snapshot) => DoctorTimeoutView(snapshot: snapshot),
          TelemedError(:final message) => TelemedErrorView(message: message),
          _ => const TelemedErrorView(message: 'Не удалось получить статус консультации.'),
        };
        return Scaffold(appBar: AppBar(title: const Text('Онлайн-консультация')), body: body);
      },
    );
  }
}
