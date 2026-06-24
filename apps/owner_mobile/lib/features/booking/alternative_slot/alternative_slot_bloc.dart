import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/clock/server_clock.dart';
import '../../../core/network/network_gate.dart';
import '../../../core/operations/operation_id_store.dart';
import 'alternative_slot_models.dart';
import 'alternative_slot_repository.dart';

sealed class AlternativeSlotEvent {
  const AlternativeSlotEvent();
}

class AlternativeSlotOpened extends AlternativeSlotEvent {
  const AlternativeSlotOpened();
}

class AlternativeSlotRefreshRequested extends AlternativeSlotEvent {
  const AlternativeSlotRefreshRequested();
}

class AlternativeSlotAcceptPressed extends AlternativeSlotEvent {
  const AlternativeSlotAcceptPressed();
}

class AlternativeSlotDeclinePressed extends AlternativeSlotEvent {
  const AlternativeSlotDeclinePressed();
}

sealed class AlternativeSlotState {
  const AlternativeSlotState();
}

class AlternativeSlotLoading extends AlternativeSlotState {
  const AlternativeSlotLoading();
}

class AlternativeSlotActive extends AlternativeSlotState {
  const AlternativeSlotActive(this.model);
  final AlternativeSlotViewModel model;
}

class AlternativeSlotSubmitting extends AlternativeSlotState {
  const AlternativeSlotSubmitting(this.model, this.action);
  final AlternativeSlotViewModel model;
  final String action;
}

class AlternativeSlotSoftRetry extends AlternativeSlotState {
  const AlternativeSlotSoftRetry(this.model);
  final AlternativeSlotViewModel model;
}

class AlternativeSlotSuccess extends AlternativeSlotState {
  const AlternativeSlotSuccess(this.result);
  final AlternativeActionResult result;
}

class AlternativeSlotFenced extends AlternativeSlotState {
  const AlternativeSlotFenced(this.reason, {this.model});
  final BookingFenceReason reason;
  final AlternativeSlotViewModel? model;
}

class AlternativeSlotError extends AlternativeSlotState {
  const AlternativeSlotError(this.message, {this.model});
  final String message;
  final AlternativeSlotViewModel? model;
}

class AlternativeSlotBloc extends Bloc<AlternativeSlotEvent, AlternativeSlotState> {
  AlternativeSlotBloc({
    required String holdId,
    required AlternativeSlotRepository repository,
    required NetworkGate networkGate,
    required ServerClock serverClock,
    required OperationIdStore operationIds,
  })  : _holdId = holdId,
        _repository = repository,
        _networkGate = networkGate,
        _serverClock = serverClock,
        _operationIds = operationIds,
        super(const AlternativeSlotLoading()) {
    on<AlternativeSlotOpened>(_load);
    on<AlternativeSlotRefreshRequested>(_load);
    on<AlternativeSlotAcceptPressed>(_accept);
    on<AlternativeSlotDeclinePressed>(_decline);
  }

  final String _holdId;
  final AlternativeSlotRepository _repository;
  final NetworkGate _networkGate;
  final ServerClock _serverClock;
  final OperationIdStore _operationIds;

  Future<void> _load(AlternativeSlotEvent event, Emitter<AlternativeSlotState> emit) async {
    final preserved = switch (state) {
      AlternativeSlotActive(:final model) => model,
      AlternativeSlotSubmitting(:final model) => model,
      AlternativeSlotSoftRetry(:final model) => model,
      AlternativeSlotError(:final model?) => model,
      _ => null,
    };
    if (preserved == null) emit(const AlternativeSlotLoading());

    try {
      final model = await _repository.read(_holdId);
      _serverClock.synchronize(model.serverNow.toIso8601String());
      if (!model.canDecide) {
        emit(AlternativeSlotFenced(_fenceForState(model.state), model: model));
        return;
      }
      emit(AlternativeSlotActive(model));
    } on ApiFailure catch (failure) {
      emit(AlternativeSlotError(_safeMessage(failure), model: preserved));
    }
  }

  Future<void> _accept(
    AlternativeSlotAcceptPressed event,
    Emitter<AlternativeSlotState> emit,
  ) async {
    final current = state;
    if (current is! AlternativeSlotActive) return;
    if (await _networkGate.check() != NetworkGateState.online) {
      emit(AlternativeSlotError('No Internet Connection. Action Blocked', model: current.model));
      return;
    }

    final operationId = _operationIds.getOrCreate(operation: 'accept-alternative', aggregateId: _holdId);
    emit(AlternativeSlotSubmitting(current.model, 'accept'));
    try {
      final result = await _repository.accept(_holdId, current.model.version, operationId);
      await _operationIds.clear(operation: 'accept-alternative', aggregateId: _holdId);
      emit(AlternativeSlotSuccess(result));
    } on ApiFailure catch (failure) {
      await _handleActionFailure(failure, current.model, emit);
    }
  }

  Future<void> _decline(
    AlternativeSlotDeclinePressed event,
    Emitter<AlternativeSlotState> emit,
  ) async {
    final current = state;
    if (current is! AlternativeSlotActive) return;
    if (await _networkGate.check() != NetworkGateState.online) {
      emit(AlternativeSlotError('No Internet Connection. Action Blocked', model: current.model));
      return;
    }

    final operationId = _operationIds.getOrCreate(operation: 'decline-alternative', aggregateId: _holdId);
    emit(AlternativeSlotSubmitting(current.model, 'decline'));
    try {
      final result = await _repository.decline(_holdId, current.model.version, operationId);
      await _operationIds.clear(operation: 'decline-alternative', aggregateId: _holdId);
      emit(AlternativeSlotSuccess(result));
    } on ApiFailure catch (failure) {
      await _handleActionFailure(failure, current.model, emit);
    }
  }

  Future<void> _handleActionFailure(
    ApiFailure failure,
    AlternativeSlotViewModel model,
    Emitter<AlternativeSlotState> emit,
  ) async {
    if (failure.statusCode == 409 &&
        (failure.code == 'SLOT_LOCKED_RETRY' || failure.code == 'SLOT_VERSION_STALE')) {
      emit(AlternativeSlotSoftRetry(model));
      add(const AlternativeSlotRefreshRequested());
      return;
    }
    if (failure.statusCode == 409 || failure.statusCode == 422) {
      emit(AlternativeSlotFenced(_fenceForCode(failure.code), model: model));
      return;
    }
    emit(AlternativeSlotError(_safeMessage(failure), model: model));
  }

  BookingFenceReason _fenceForCode(String code) => switch (code) {
        'HOLD_EXPIRED' => BookingFenceReason.expired,
        'SLOT_VERSION_STALE' => BookingFenceReason.staleVersion,
        'SLOT_ALREADY_TAKEN' => BookingFenceReason.unavailable,
        _ => BookingFenceReason.invalidTransition,
      };

  BookingFenceReason _fenceForState(String state) => switch (state) {
        'EXPIRED' => BookingFenceReason.expired,
        'RELEASED' => BookingFenceReason.unavailable,
        _ => BookingFenceReason.invalidTransition,
      };

  String _safeMessage(ApiFailure failure) => switch (failure.statusCode) {
        401 => 'Сессия истекла. Войдите в приложение ещё раз.',
        403 => 'Это действие недоступно для текущей учётной записи.',
        503 => 'VetHelp временно недоступен. Попробуйте ещё раз.',
        _ => 'Не удалось обновить запись. Повторите попытку.',
      };
}
