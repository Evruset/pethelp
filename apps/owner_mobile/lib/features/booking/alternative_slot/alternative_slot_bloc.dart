import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

import 'alternative_slot_repository.dart';

sealed class AlternativeSlotEvent {
  const AlternativeSlotEvent();
}

class AlternativeSlotOpened extends AlternativeSlotEvent {
  const AlternativeSlotOpened(this.holdId);
  final String holdId;
}

class AlternativeSlotAcceptPressed extends AlternativeSlotEvent {
  const AlternativeSlotAcceptPressed();
}

class AlternativeSlotRefreshRequested extends AlternativeSlotEvent {
  const AlternativeSlotRefreshRequested();
}

sealed class AlternativeSlotState {
  const AlternativeSlotState();
}

class AlternativeSlotLoading extends AlternativeSlotState {
  const AlternativeSlotLoading();
}

class AlternativeSlotActive extends AlternativeSlotState {
  const AlternativeSlotActive(this.snapshot, this.correlationId, this.idempotencyKey);
  final AlternativeSlotSnapshot snapshot;
  final String correlationId;
  final String idempotencyKey;
}

class AlternativeSlotAccepting extends AlternativeSlotState {
  const AlternativeSlotAccepting(this.snapshot);
  final AlternativeSlotSnapshot snapshot;
}

class AlternativeSlotAcceptedState extends AlternativeSlotState {
  const AlternativeSlotAcceptedState(this.result);
  final AlternativeSlotAccepted result;
}

class AlternativeSlotSoftRetry extends AlternativeSlotState {
  const AlternativeSlotSoftRetry(this.message);
  final String message;
}

class AlternativeSlotFencedState extends AlternativeSlotState {
  const AlternativeSlotFencedState(this.reason);
  final String reason;
}

class AlternativeSlotErrorState extends AlternativeSlotState {
  const AlternativeSlotErrorState(this.message);
  final String message;
}

class AlternativeSlotBloc extends Bloc<AlternativeSlotEvent, AlternativeSlotState> {
  AlternativeSlotBloc({required AlternativeSlotRepository repository})
      : _repository = repository,
        super(const AlternativeSlotLoading()) {
    on<AlternativeSlotOpened>(_onOpened);
    on<AlternativeSlotAcceptPressed>(_onAcceptPressed);
    on<AlternativeSlotRefreshRequested>(_onRefreshRequested);
  }

  final AlternativeSlotRepository _repository;
  final Uuid _uuid = const Uuid();
  String? _holdId;
  String? _correlationId;
  String? _idempotencyKey;

  Future<void> _onOpened(AlternativeSlotOpened event, Emitter<AlternativeSlotState> emit) async {
    _holdId = event.holdId;
    _correlationId ??= _uuid.v4();
    _idempotencyKey ??= _uuid.v4();
    emit(const AlternativeSlotLoading());
    await _load(emit);
  }

  Future<void> _onRefreshRequested(AlternativeSlotRefreshRequested event, Emitter<AlternativeSlotState> emit) async {
    emit(const AlternativeSlotLoading());
    await _load(emit);
  }

  Future<void> _onAcceptPressed(AlternativeSlotAcceptPressed event, Emitter<AlternativeSlotState> emit) async {
    final current = state;
    if (current is! AlternativeSlotActive) return;

    if (DateTime.now().toUtc().isAfter(current.snapshot.expiresAt)) {
      emit(const AlternativeSlotFencedState('HOLD_EXPIRED'));
      return;
    }

    emit(AlternativeSlotAccepting(current.snapshot));
    final result = await _repository.acceptAlternative(
      holdId: current.snapshot.holdId,
      correlationId: current.correlationId,
      idempotencyKey: current.idempotencyKey,
    );

    switch (result) {
      case AlternativeSlotSuccess<AlternativeSlotAccepted>(value: final value):
        emit(AlternativeSlotAcceptedState(value));
      case AlternativeSlotRetry<AlternativeSlotAccepted>():
        emit(const AlternativeSlotSoftRetry('Обновляем состояние записи.'));
        await _load(emit);
      case AlternativeSlotFenced<AlternativeSlotAccepted>(reason: final reason):
        emit(AlternativeSlotFencedState(reason));
      case AlternativeSlotFailure<AlternativeSlotAccepted>(message: final message):
        emit(AlternativeSlotErrorState(message));
    }
  }

  Future<void> _load(Emitter<AlternativeSlotState> emit) async {
    final holdId = _holdId;
    final correlationId = _correlationId;
    final idempotencyKey = _idempotencyKey;
    if (holdId == null || correlationId == null || idempotencyKey == null) {
      emit(const AlternativeSlotErrorState('Не удалось открыть предложение.'));
      return;
    }

    final result = await _repository.readSnapshot(holdId);
    switch (result) {
      case AlternativeSlotSuccess<AlternativeSlotSnapshot>(value: final value):
        emit(AlternativeSlotActive(value, correlationId, idempotencyKey));
      case AlternativeSlotRetry<AlternativeSlotSnapshot>():
        emit(const AlternativeSlotSoftRetry('Обновляем состояние записи.'));
      case AlternativeSlotFenced<AlternativeSlotSnapshot>(reason: final reason):
        emit(AlternativeSlotFencedState(reason));
      case AlternativeSlotFailure<AlternativeSlotSnapshot>(message: final message):
        emit(AlternativeSlotErrorState(message));
    }
  }
}
