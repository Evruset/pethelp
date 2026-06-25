import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

enum TelemedWaitingStateKind {
  waitingForDoctor,
  connected,
  doctorTimeout,
  completed,
}

class TelemedWaitingSnapshot {
  const TelemedWaitingSnapshot({
    required this.sessionId,
    required this.state,
    required this.doctorJoinDeadlineAt,
    required this.serverNow,
    required this.version,
  });

  final String sessionId;
  final TelemedWaitingStateKind state;
  final DateTime doctorJoinDeadlineAt;
  final DateTime serverNow;
  final int version;

  Duration remainingAt(DateTime deviceNowUtc) {
    final serverOffset = serverNow.difference(DateTime.now().toUtc());
    return doctorJoinDeadlineAt.difference(deviceNowUtc.add(serverOffset));
  }
}

abstract class TelemedWaitingRepository {
  Future<TelemedWaitingSnapshot> readSession(String sessionId);
}

sealed class TelemedWaitingEvent {
  const TelemedWaitingEvent();
}

class TelemedWaitingOpened extends TelemedWaitingEvent {
  const TelemedWaitingOpened(this.sessionId);
  final String sessionId;
}

class TelemedWaitingRefreshRequested extends TelemedWaitingEvent {
  const TelemedWaitingRefreshRequested();
}

class TelemedRealtimeSnapshotReceived extends TelemedWaitingEvent {
  const TelemedRealtimeSnapshotReceived(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

sealed class TelemedWaitingState {
  const TelemedWaitingState();
}

class TelemedWaitingLoading extends TelemedWaitingState {
  const TelemedWaitingLoading();
}

class TelemedWaitingForDoctor extends TelemedWaitingState {
  const TelemedWaitingForDoctor(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

class TelemedConnectingRoom extends TelemedWaitingState {
  const TelemedConnectingRoom(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

class TelemedDoctorTimeout extends TelemedWaitingState {
  const TelemedDoctorTimeout();
}

class TelemedCompleted extends TelemedWaitingState {
  const TelemedCompleted();
}

class TelemedWaitingError extends TelemedWaitingState {
  const TelemedWaitingError(this.message);
  final String message;
}

class TelemedWaitingBloc extends Bloc<TelemedWaitingEvent, TelemedWaitingState> {
  TelemedWaitingBloc({required TelemedWaitingRepository repository})
      : _repository = repository,
        super(const TelemedWaitingLoading()) {
    on<TelemedWaitingOpened>(_onOpened);
    on<TelemedWaitingRefreshRequested>(_onRefresh);
    on<TelemedRealtimeSnapshotReceived>(_onRealtime);
  }

  final TelemedWaitingRepository _repository;
  String? _sessionId;

  Future<void> _onOpened(TelemedWaitingOpened event, Emitter<TelemedWaitingState> emit) async {
    _sessionId = event.sessionId;
    emit(const TelemedWaitingLoading());
    await _readAuthoritative(emit);
  }

  Future<void> _onRefresh(TelemedWaitingRefreshRequested event, Emitter<TelemedWaitingState> emit) async {
    await _readAuthoritative(emit);
  }

  void _onRealtime(TelemedRealtimeSnapshotReceived event, Emitter<TelemedWaitingState> emit) {
    final current = state;
    if (current is TelemedWaitingForDoctor && event.snapshot.version <= current.snapshot.version) return;
    _emitSnapshot(emit, event.snapshot);
  }

  Future<void> _readAuthoritative(Emitter<TelemedWaitingState> emit) async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      emit(const TelemedWaitingError('Не удалось определить консультацию.'));
      return;
    }
    try {
      final snapshot = await _repository.readSession(sessionId);
      _emitSnapshot(emit, snapshot);
    } catch (_) {
      emit(const TelemedWaitingError('Не удалось получить статус подключения врача.'));
    }
  }

  void _emitSnapshot(Emitter<TelemedWaitingState> emit, TelemedWaitingSnapshot snapshot) {
    switch (snapshot.state) {
      case TelemedWaitingStateKind.waitingForDoctor:
        emit(TelemedWaitingForDoctor(snapshot));
      case TelemedWaitingStateKind.connected:
        emit(TelemedConnectingRoom(snapshot));
      case TelemedWaitingStateKind.doctorTimeout:
        emit(const TelemedDoctorTimeout());
      case TelemedWaitingStateKind.completed:
        emit(const TelemedCompleted());
    }
  }
}
