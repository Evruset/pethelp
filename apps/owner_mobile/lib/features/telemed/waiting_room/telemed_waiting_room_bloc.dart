import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'telemed_room_access_repository.dart';
import 'telemed_waiting_room_repository.dart';

enum TelemedWaitingStateKind {
  waitingForDoctor,
  connected,
  doctorTimeout,
  completed,
  cancelled,
}

class TelemedWaitingSnapshot {
  const TelemedWaitingSnapshot({
    required this.sessionId,
    required this.state,
    required this.doctorJoinDeadlineAt,
    required this.serverNow,
    required this.version,
    this.telemedCaseState,
    this.paymentStatus,
    this.refundState,
  });

  final String sessionId;
  final TelemedWaitingStateKind state;
  final DateTime doctorJoinDeadlineAt;
  final DateTime serverNow;
  final int version;
  final String? telemedCaseState;
  final String? paymentStatus;
  final String? refundState;

  Duration remainingAt(DateTime deviceNowUtc) {
    final serverOffset = serverNow.difference(DateTime.now().toUtc());
    return doctorJoinDeadlineAt.difference(deviceNowUtc.add(serverOffset));
  }
}

abstract class TelemedWaitingRepository {
  Future<TelemedWaitingSnapshot> readSession(String sessionId);
  Future<TelemedWaitingSnapshot> cancelSession(String sessionId);
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

class TelemedWaitingCancelRequested extends TelemedWaitingEvent {
  const TelemedWaitingCancelRequested();
}

sealed class TelemedWaitingState {
  const TelemedWaitingState();
}

class TelemedWaitingLoading extends TelemedWaitingState {
  const TelemedWaitingLoading();
}

class TelemedWaitingForDoctor extends TelemedWaitingState {
  const TelemedWaitingForDoctor(this.snapshot, {this.cancelError});
  final TelemedWaitingSnapshot snapshot;
  final String? cancelError;
}

class TelemedWaitingCancelling extends TelemedWaitingState {
  const TelemedWaitingCancelling(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

class TelemedConnectingRoom extends TelemedWaitingState {
  const TelemedConnectingRoom(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

class TelemedRoomReady extends TelemedWaitingState {
  const TelemedRoomReady(this.access);
  final TelemedRoomAccess access;
}

class TelemedDoctorTimeout extends TelemedWaitingState {
  const TelemedDoctorTimeout(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

class TelemedCompleted extends TelemedWaitingState {
  const TelemedCompleted();
}

class TelemedCancelled extends TelemedWaitingState {
  const TelemedCancelled(this.snapshot);
  final TelemedWaitingSnapshot snapshot;
}

class TelemedWaitingError extends TelemedWaitingState {
  const TelemedWaitingError(this.message);
  final String message;
}

class TelemedWaitingBloc
    extends Bloc<TelemedWaitingEvent, TelemedWaitingState> {
  TelemedWaitingBloc({
    required TelemedWaitingRepository repository,
    required TelemedRoomAccessRepository roomAccessRepository,
  })  : _repository = repository,
        _roomAccessRepository = roomAccessRepository,
        super(const TelemedWaitingLoading()) {
    on<TelemedWaitingOpened>(_onOpened);
    on<TelemedWaitingRefreshRequested>(_onRefresh);
    on<TelemedRealtimeSnapshotReceived>(_onRealtime);
    on<TelemedWaitingCancelRequested>(_onCancel);
  }

  final TelemedWaitingRepository _repository;
  final TelemedRoomAccessRepository _roomAccessRepository;
  String? _sessionId;

  Future<void> _onOpened(
      TelemedWaitingOpened event, Emitter<TelemedWaitingState> emit) async {
    _sessionId = event.sessionId;
    emit(const TelemedWaitingLoading());
    await _readAuthoritative(emit);
  }

  Future<void> _onRefresh(TelemedWaitingRefreshRequested event,
      Emitter<TelemedWaitingState> emit) async {
    final current = state;
    if (current is TelemedRoomReady) {
      await _refreshRoomStatus(emit, current);
      return;
    }
    await _readAuthoritative(emit);
  }

  Future<void> _onRealtime(TelemedRealtimeSnapshotReceived event,
      Emitter<TelemedWaitingState> emit) async {
    final current = state;
    if (current is TelemedWaitingForDoctor &&
        event.snapshot.version <= current.snapshot.version) {
      return;
    }
    await _emitSnapshot(emit, event.snapshot);
  }

  Future<void> _onCancel(TelemedWaitingCancelRequested event,
      Emitter<TelemedWaitingState> emit) async {
    final current = state;
    if (current is! TelemedWaitingForDoctor) return;
    emit(TelemedWaitingCancelling(current.snapshot));
    try {
      final snapshot =
          await _repository.cancelSession(current.snapshot.sessionId);
      await _emitSnapshot(emit, snapshot);
    } on TelemedWaitingApiException catch (error) {
      emit(TelemedWaitingForDoctor(
        current.snapshot,
        cancelError: _cancelMessage(error.code),
      ));
    } catch (_) {
      emit(TelemedWaitingForDoctor(
        current.snapshot,
        cancelError:
            'Не удалось отменить консультацию. Проверьте статус и попробуйте снова.',
      ));
    }
  }

  Future<void> _readAuthoritative(Emitter<TelemedWaitingState> emit) async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      emit(const TelemedWaitingError('Не удалось определить консультацию.'));
      return;
    }
    try {
      final snapshot = await _repository.readSession(sessionId);
      await _emitSnapshot(emit, snapshot);
    } on TelemedWaitingApiException catch (error) {
      emit(TelemedWaitingError(_waitingMessage(error.code)));
    } catch (_) {
      emit(const TelemedWaitingError(
          'Не удалось получить статус подключения врача.'));
    }
  }

  Future<void> _emitSnapshot(Emitter<TelemedWaitingState> emit,
      TelemedWaitingSnapshot snapshot) async {
    switch (snapshot.state) {
      case TelemedWaitingStateKind.waitingForDoctor:
        emit(TelemedWaitingForDoctor(snapshot));
      case TelemedWaitingStateKind.connected:
        emit(TelemedConnectingRoom(snapshot));
        await _createRoomAccess(emit, snapshot.sessionId);
      case TelemedWaitingStateKind.doctorTimeout:
        emit(TelemedDoctorTimeout(snapshot));
      case TelemedWaitingStateKind.completed:
        emit(const TelemedCompleted());
      case TelemedWaitingStateKind.cancelled:
        emit(TelemedCancelled(snapshot));
    }
  }

  Future<void> _createRoomAccess(
      Emitter<TelemedWaitingState> emit, String sessionId) async {
    try {
      final access = await _roomAccessRepository.createRoomAccess(sessionId);
      emit(TelemedRoomReady(access));
    } on TelemedRoomAccessUnavailable catch (error) {
      emit(TelemedWaitingError(_roomAccessMessage(error.code)));
    } catch (_) {
      emit(const TelemedWaitingError(
          'Не удалось подготовить комнату консультации. Обновите статус.'));
    }
  }

  Future<void> _refreshRoomStatus(
      Emitter<TelemedWaitingState> emit, TelemedRoomReady current) async {
    final sessionId = _sessionId;
    if (sessionId == null) return;
    try {
      final snapshot = await _repository.readSession(sessionId);
      if (snapshot.state == TelemedWaitingStateKind.connected) {
        emit(current);
        return;
      }
      await _emitSnapshot(emit, snapshot);
    } on TelemedWaitingApiException catch (error) {
      emit(TelemedWaitingError(_waitingMessage(error.code)));
    } catch (_) {
      emit(const TelemedWaitingError(
          'Не удалось получить статус консультации.'));
    }
  }

  String _roomAccessMessage(String code) {
    return switch (code) {
      'TELEMED_DOCTOR_NOT_CONNECTED' =>
        'Врач ещё не подключился. Обновите статус через несколько секунд.',
      'LIVEKIT_CONFIGURATION_MISSING' =>
        'Видеосвязь временно недоступна. Поддержка VetHelp уже получила сигнал.',
      'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
      _ => 'Не удалось подготовить комнату консультации.',
    };
  }

  String _waitingMessage(String code) {
    return switch (code) {
      'TELEMED_SESSION_NOT_FOUND' =>
        'Консультация не найдена или недоступна для этого профиля.',
      'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
      _ => 'Не удалось получить статус подключения врача.',
    };
  }

  String _cancelMessage(String code) {
    return switch (code) {
      'TELEMED_SESSION_NOT_CANCELLABLE' =>
        'Врач уже подключается или консультация завершилась. Обновите статус.',
      'TELEMED_SESSION_ALREADY_CANCELLED' =>
        'Консультация уже отменена. Обновите список консультаций.',
      'TELEMED_OWNER_CANCEL_UNSUPPORTED' =>
        'Эту консультацию нельзя отменить из приложения.',
      'INVALID_IDEMPOTENCY_KEY' =>
        'Не удалось безопасно подтвердить отмену. Попробуйте ещё раз.',
      'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
      _ =>
        'Не удалось отменить консультацию. Проверьте статус и попробуйте снова.',
    };
  }
}
