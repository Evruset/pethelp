import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';
import 'alternative_slot_repository.dart';

sealed class AlternativeSlotEvent {
  const AlternativeSlotEvent();
}

class AlternativeSlotOpened extends AlternativeSlotEvent {
  const AlternativeSlotOpened(this.bookingId);
  final String bookingId;
}

class AlternativeSlotAcceptPressed extends AlternativeSlotEvent {
  const AlternativeSlotAcceptPressed();
}

class AlternativeSlotDeclinePressed extends AlternativeSlotEvent {
  const AlternativeSlotDeclinePressed();
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
  const AlternativeSlotActive(this.snapshot);
  final AlternativeSlotSnapshot snapshot;
}

class AlternativeSlotSubmitting extends AlternativeSlotState {
  const AlternativeSlotSubmitting(this.snapshot, this.accept);
  final AlternativeSlotSnapshot snapshot;
  final bool accept;
}

class AlternativeSlotDeclinedState extends AlternativeSlotState {
  const AlternativeSlotDeclinedState(this.intent);
  final ReturnToAvailabilityIntent intent;
}

class AlternativeSlotFencedState extends AlternativeSlotState {
  const AlternativeSlotFencedState(this.reason);
  final String reason;
}

class AlternativeSlotErrorState extends AlternativeSlotState {
  const AlternativeSlotErrorState(this.message, {this.retry = true});
  final String message;
  final bool retry;
}

class AlternativeSlotBloc
    extends Bloc<AlternativeSlotEvent, AlternativeSlotState> {
  AlternativeSlotBloc(
      {required AlternativeSlotRepository repository, this.offline = false})
      : _repository = repository,
        super(const AlternativeSlotLoading()) {
    on<AlternativeSlotOpened>(_opened);
    on<AlternativeSlotRefreshRequested>(_refresh);
    on<AlternativeSlotAcceptPressed>((e, emit) => _resolve(true, emit));
    on<AlternativeSlotDeclinePressed>((e, emit) => _resolve(false, emit));
  }
  final AlternativeSlotRepository _repository;
  final bool offline;
  final Uuid _uuid = const Uuid();
  String? _bookingId, _correlationId, _acceptKey, _declineKey;

  Future<void> _opened(
      AlternativeSlotOpened e, Emitter<AlternativeSlotState> emit) async {
    _bookingId = e.bookingId;
    _correlationId ??= _uuid.v4();
    _acceptKey ??= _uuid.v4();
    _declineKey ??= _uuid.v4();
    await _load(emit);
  }

  Future<void> _refresh(AlternativeSlotRefreshRequested e,
      Emitter<AlternativeSlotState> emit) async {
    emit(const AlternativeSlotLoading());
    await _load(emit);
  }

  Future<void> _load(Emitter<AlternativeSlotState> emit) async {
    final id = _bookingId;
    if (id == null) {
      emit(const AlternativeSlotErrorState('Не удалось открыть предложение.'));
      return;
    }
    final result = await _repository.readSnapshot(id);
    switch (result) {
      case AlternativeSlotSuccess<AlternativeSlotSnapshot>(value: final v):
        emit(AlternativeSlotActive(v));
      case AlternativeSlotFenced<AlternativeSlotSnapshot>(reason: final r):
        emit(AlternativeSlotFencedState(r));
      case AlternativeSlotRetry<AlternativeSlotSnapshot>():
        emit(const AlternativeSlotErrorState(
            'Состояние обновляется. Повторите попытку.'));
      case AlternativeSlotFailure<AlternativeSlotSnapshot>(message: final m):
        emit(AlternativeSlotErrorState(m));
    }
  }

  Future<void> _resolve(bool accept, Emitter<AlternativeSlotState> emit) async {
    final current = state;
    if (current is! AlternativeSlotActive) return;
    if (offline) {
      emit(const AlternativeSlotErrorState(
          'Нет подключения. Решение нельзя отправить офлайн.',
          retry: false));
      return;
    }
    emit(AlternativeSlotSubmitting(current.snapshot, accept));
    final result = await _repository.resolve(
        snapshot: current.snapshot,
        accept: accept,
        idempotencyKey: accept ? _acceptKey! : _declineKey!,
        correlationId: _correlationId!);
    if (result
        case AlternativeSlotFenced<AlternativeResolution>(
          reason: final reason
        )) {
      emit(AlternativeSlotFencedState(reason));
      return;
    }
    // A command response, retry response, or transport ambiguity is never local success.
    final readback = await _repository.readSnapshot(current.snapshot.bookingId);
    switch (readback) {
      case AlternativeSlotSuccess<AlternativeSlotSnapshot>(value: final v):
        if (!accept && v.state == 'DECLINED') {
          emit(AlternativeSlotDeclinedState(ReturnToAvailabilityIntent(
              bookingId: v.bookingId,
              excludedSlotIds: [v.originalSlot.id, v.alternativeSlot.id])));
        } else {
          emit(AlternativeSlotActive(v));
        }
      case AlternativeSlotFenced<AlternativeSlotSnapshot>(reason: final r):
        emit(AlternativeSlotFencedState(r));
      case AlternativeSlotRetry<AlternativeSlotSnapshot>():
        emit(const AlternativeSlotErrorState(
            'Решение отправлено. Проверяем состояние.'));
      case AlternativeSlotFailure<AlternativeSlotSnapshot>():
        emit(const AlternativeSlotErrorState(
            'Не удалось подтвердить итог. Обновите экран.'));
    }
  }
}
