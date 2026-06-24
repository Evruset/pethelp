import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/clock/server_clock.dart';
import '../../core/network/network_gate.dart';
import '../../core/operations/operation_id_store.dart';
import 'livekit_media_gateway.dart';
import 'telemed_models.dart';
import 'telemed_repository.dart';

sealed class TelemedEvent {
  const TelemedEvent();
}

class TelemedOpened extends TelemedEvent {
  const TelemedOpened();
}

class TelemedPollRequested extends TelemedEvent {
  const TelemedPollRequested();
}

class TelemedJoinRequested extends TelemedEvent {
  const TelemedJoinRequested();
}

class TelemedHangupPressed extends TelemedEvent {
  const TelemedHangupPressed();
}

class TelemedMicrophoneToggled extends TelemedEvent {
  const TelemedMicrophoneToggled(this.enabled);
  final bool enabled;
}

class TelemedCameraToggled extends TelemedEvent {
  const TelemedCameraToggled(this.enabled);
  final bool enabled;
}

class TelemedMediaChanged extends TelemedEvent {
  const TelemedMediaChanged(this.media);
  final MediaViewState media;
}

sealed class TelemedState {
  const TelemedState();
}

class TelemedLoading extends TelemedState {
  const TelemedLoading();
}

class TelemedWaitingForDoctor extends TelemedState {
  const TelemedWaitingForDoctor(this.snapshot);
  final TelemedSnapshot snapshot;
}

class TelemedJoiningRoom extends TelemedState {
  const TelemedJoiningRoom(this.snapshot);
  final TelemedSnapshot snapshot;
}

class TelemedInCall extends TelemedState {
  const TelemedInCall(this.snapshot, this.media);
  final TelemedSnapshot snapshot;
  final MediaViewState media;
}

class TelemedEnding extends TelemedState {
  const TelemedEnding(this.snapshot);
  final TelemedSnapshot snapshot;
}

class TelemedCompleted extends TelemedState {
  const TelemedCompleted();
}

class TelemedDoctorTimeout extends TelemedState {
  const TelemedDoctorTimeout(this.snapshot);
  final TelemedSnapshot snapshot;
}

class TelemedError extends TelemedState {
  const TelemedError(this.message, {this.snapshot});
  final String message;
  final TelemedSnapshot? snapshot;
}

class TelemedBloc extends Bloc<TelemedEvent, TelemedState> {
  TelemedBloc({
    required String sessionId,
    required TelemedDataSource repository,
    required TelemedMediaGateway media,
    required NetworkGate networkGate,
    required ServerClock serverClock,
    required OperationIdStore operationIds,
  })  : _sessionId = sessionId,
        _repository = repository,
        _media = media,
        _networkGate = networkGate,
        _serverClock = serverClock,
        _operationIds = operationIds,
        super(const TelemedLoading()) {
    on<TelemedOpened>(_readSnapshot);
    on<TelemedPollRequested>(_readSnapshot);
    on<TelemedJoinRequested>(_joinRoom);
    on<TelemedHangupPressed>(_requestEnd);
    on<TelemedMicrophoneToggled>(_toggleMicrophone);
    on<TelemedCameraToggled>(_toggleCamera);
    on<TelemedMediaChanged>(_mediaChanged);
    _mediaSubscription = _media.states.listen((media) => add(TelemedMediaChanged(media)));
  }

  final String _sessionId;
  final TelemedDataSource _repository;
  final TelemedMediaGateway _media;
  final NetworkGate _networkGate;
  final ServerClock _serverClock;
  final OperationIdStore _operationIds;
  late final StreamSubscription<MediaViewState> _mediaSubscription;
  Timer? _polling;

  Future<void> _readSnapshot(TelemedEvent event, Emitter<TelemedState> emit) async {
    final existing = _snapshotOf(state);
    if (existing == null) emit(const TelemedLoading());
    try {
      final snapshot = await _repository.read(_sessionId);
      _serverClock.synchronize(snapshot.serverNow.toIso8601String());
      _startPolling();

      switch (snapshot.status) {
        case TelemedSessionStatus.waitingForDoctor:
          if (state is! TelemedWaitingForDoctor) emit(TelemedWaitingForDoctor(snapshot));
        case TelemedSessionStatus.connected:
          if (state is TelemedEnding) {
            emit(TelemedEnding(snapshot));
          } else if (state is! TelemedInCall && state is! TelemedJoiningRoom) {
            add(const TelemedJoinRequested());
          }
        case TelemedSessionStatus.completed:
          await _media.disconnect();
          emit(const TelemedCompleted());
        case TelemedSessionStatus.doctorTimeout:
          await _media.disconnect();
          emit(TelemedDoctorTimeout(snapshot));
      }
    } on TelemedApiFailure catch (failure) {
      emit(TelemedError(_messageFor(failure), snapshot: existing));
    }
  }

  Future<void> _joinRoom(TelemedJoinRequested event, Emitter<TelemedState> emit) async {
    final snapshot = _snapshotOf(state);
    if (snapshot == null || snapshot.status != TelemedSessionStatus.connected) return;
    if (await _networkGate.check() != NetworkGateState.online) {
      emit(TelemedError('No Internet Connection. Action Blocked', snapshot: snapshot));
      return;
    }
    emit(TelemedJoiningRoom(snapshot));
    try {
      final token = await _repository.issueRoomToken(_sessionId);
      await _media.connect(token);
      emit(TelemedInCall(snapshot, _media.current));
    } on TelemedApiFailure catch (failure) {
      emit(TelemedError(_messageFor(failure), snapshot: snapshot));
    } catch {
      emit(TelemedError('Не удалось подключиться к видеоконсультации. Попробуйте ещё раз.', snapshot: snapshot));
    }
  }

  Future<void> _requestEnd(TelemedHangupPressed event, Emitter<TelemedState> emit) async {
    final snapshot = _snapshotOf(state);
    if (snapshot == null) return;
    if (await _networkGate.check() != NetworkGateState.online) {
      emit(TelemedError('No Internet Connection. Action Blocked', snapshot: snapshot));
      return;
    }
    try {
      final operationId = await _operationIds.getOrCreate(operation: 'end-telemed', aggregateId: _sessionId);
      await _repository.requestEnd(_sessionId, operationId);
      await _media.disconnect();
      emit(TelemedEnding(snapshot));
      _startPolling();
    } on TelemedApiFailure catch (failure) {
      emit(TelemedError(_messageFor(failure), snapshot: snapshot));
    }
  }

  Future<void> _toggleMicrophone(TelemedMicrophoneToggled event, Emitter<TelemedState> emit) async {
    final snapshot = _snapshotOf(state);
    if (snapshot == null) return;
    await _media.setMicrophoneEnabled(event.enabled);
    emit(TelemedInCall(snapshot, _media.current));
  }

  Future<void> _toggleCamera(TelemedCameraToggled event, Emitter<TelemedState> emit) async {
    final snapshot = _snapshotOf(state);
    if (snapshot == null) return;
    await _media.setCameraEnabled(event.enabled);
    emit(TelemedInCall(snapshot, _media.current));
  }

  void _mediaChanged(TelemedMediaChanged event, Emitter<TelemedState> emit) {
    final current = state;
    if (current is TelemedInCall) emit(TelemedInCall(current.snapshot, event.media));
  }

  TelemedSnapshot? _snapshotOf(TelemedState current) => switch (current) {
        TelemedWaitingForDoctor(:final snapshot) => snapshot,
        TelemedJoiningRoom(:final snapshot) => snapshot,
        TelemedInCall(:final snapshot) => snapshot,
        TelemedEnding(:final snapshot) => snapshot,
        TelemedDoctorTimeout(:final snapshot) => snapshot,
        TelemedError(:final snapshot?) => snapshot,
        _ => null,
      };

  void _startPolling() {
    _polling ??= Timer.periodic(const Duration(seconds: 5), (_) => add(const TelemedPollRequested()));
  }

  String _messageFor(TelemedApiFailure failure) => switch (failure.statusCode) {
        401 => 'Сессия истекла. Войдите в приложение ещё раз.',
        403 => 'Эта консультация недоступна для текущей учётной записи.',
        409 => 'Статус консультации изменился. Получаем актуальные данные.',
        503 => 'Сервис видеоконсультации временно недоступен.',
        _ => 'Не удалось обновить статус консультации.',
      };

  @override
  Future<void> close() async {
    _polling?.cancel();
    await _mediaSubscription.cancel();
    _media.dispose();
    return super.close();
  }
}
