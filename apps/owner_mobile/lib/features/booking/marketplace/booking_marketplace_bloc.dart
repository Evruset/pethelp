import 'package:flutter_bloc/flutter_bloc.dart';

import 'booking_marketplace_repository.dart';
import 'booking_request_coordinator.dart';

typedef BookingRetryDelay = Future<void> Function(Duration delay);

sealed class BookingMarketplaceEvent {
  const BookingMarketplaceEvent();
}

class BookingMarketplaceOpened extends BookingMarketplaceEvent {
  const BookingMarketplaceOpened();
}

class BookingMarketplaceDaySelected extends BookingMarketplaceEvent {
  const BookingMarketplaceDaySelected(this.day);
  final DateTime day;
}

class BookingMarketplaceSlotSelected extends BookingMarketplaceEvent {
  const BookingMarketplaceSlotSelected(this.slot);
  final BookingSlot slot;
}

class BookingMarketplaceHoldRequested extends BookingMarketplaceEvent {
  const BookingMarketplaceHoldRequested();
}

class BookingMarketplaceRefreshRequested extends BookingMarketplaceEvent {
  const BookingMarketplaceRefreshRequested();
}

sealed class BookingMarketplaceState {
  const BookingMarketplaceState();
}

class BookingMarketplaceLoading extends BookingMarketplaceState {
  const BookingMarketplaceLoading({required this.selectedDay});
  final DateTime selectedDay;
}

class BookingMarketplaceReady extends BookingMarketplaceState {
  const BookingMarketplaceReady({
    required this.selectedDay,
    required this.slots,
    this.selectedSlot,
    this.notice,
  });

  final DateTime selectedDay;
  final List<BookingSlot> slots;
  final BookingSlot? selectedSlot;
  final String? notice;

  BookingMarketplaceReady copyWith({
    BookingSlot? selectedSlot,
    bool clearSelectedSlot = false,
    String? notice,
    bool clearNotice = false,
  }) {
    return BookingMarketplaceReady(
      selectedDay: selectedDay,
      slots: slots,
      selectedSlot:
          clearSelectedSlot ? null : selectedSlot ?? this.selectedSlot,
      notice: clearNotice ? null : notice ?? this.notice,
    );
  }
}

class BookingMarketplaceCreatingHold extends BookingMarketplaceState {
  const BookingMarketplaceCreatingHold({
    required this.selectedDay,
    required this.slots,
    required this.selectedSlot,
  });

  final DateTime selectedDay;
  final List<BookingSlot> slots;
  final BookingSlot selectedSlot;
}

class BookingSlotLockingInProgress extends BookingMarketplaceState {
  const BookingSlotLockingInProgress({
    required this.selectedDay,
    required this.slots,
    required this.selectedSlot,
    required this.correlationId,
    required this.retryAttempt,
    required this.nextDelay,
  });

  final DateTime selectedDay;
  final List<BookingSlot> slots;
  final BookingSlot selectedSlot;
  final String correlationId;
  final int retryAttempt;
  final Duration nextDelay;
}

class BookingMarketplaceHoldCreated extends BookingMarketplaceState {
  const BookingMarketplaceHoldCreated(this.hold);
  final CreatedBookingHold hold;
}

class BookingMarketplaceError extends BookingMarketplaceState {
  const BookingMarketplaceError({
    required this.selectedDay,
    required this.message,
    this.slots = const <BookingSlot>[],
    this.selectedSlot,
    this.showSlotUnavailableDialog = false,
  });

  final DateTime selectedDay;
  final String message;
  final List<BookingSlot> slots;
  final BookingSlot? selectedSlot;
  final bool showSlotUnavailableDialog;
}

class BookingMarketplaceBloc
    extends Bloc<BookingMarketplaceEvent, BookingMarketplaceState> {
  BookingMarketplaceBloc({
    required BookingMarketplaceRepository repository,
    required this.clinicLocationId,
    required this.serviceId,
    required this.petId,
    BookingHoldRequestCoordinator? requestCoordinator,
    BookingRetryDelay? retryDelay,
    DateTime? initialDay,
  })  : _repository = repository,
        _requestCoordinator =
            requestCoordinator ?? BookingHoldRequestCoordinator(),
        _retryDelay = retryDelay ?? Future<void>.delayed,
        _selectedDay = _dayStart(initialDay ?? DateTime.now().toUtc()),
        super(BookingMarketplaceLoading(
          selectedDay: _dayStart(initialDay ?? DateTime.now().toUtc()),
        )) {
    on<BookingMarketplaceOpened>(_onOpened);
    on<BookingMarketplaceDaySelected>(_onDaySelected);
    on<BookingMarketplaceSlotSelected>(_onSlotSelected);
    on<BookingMarketplaceHoldRequested>(_onHoldRequested);
    on<BookingMarketplaceRefreshRequested>(_onRefreshRequested);
  }

  final BookingMarketplaceRepository _repository;
  final BookingHoldRequestCoordinator _requestCoordinator;
  final BookingRetryDelay _retryDelay;
  final String clinicLocationId;
  final String serviceId;
  final String petId;
  DateTime _selectedDay;
  static const List<Duration> _slotLockedRetryDelays = <Duration>[
    Duration(seconds: 1),
    Duration(seconds: 2),
    Duration(seconds: 4),
  ];

  static DateTime _dayStart(DateTime value) {
    final utc = value.toUtc();
    return DateTime.utc(utc.year, utc.month, utc.day);
  }

  Future<void> _onOpened(
    BookingMarketplaceOpened event,
    Emitter<BookingMarketplaceState> emit,
  ) async {
    await _load(emit);
  }

  Future<void> _onRefreshRequested(
    BookingMarketplaceRefreshRequested event,
    Emitter<BookingMarketplaceState> emit,
  ) async {
    await _load(emit);
  }

  Future<void> _onDaySelected(
    BookingMarketplaceDaySelected event,
    Emitter<BookingMarketplaceState> emit,
  ) async {
    _selectedDay = _dayStart(event.day);
    await _load(emit);
  }

  void _onSlotSelected(
    BookingMarketplaceSlotSelected event,
    Emitter<BookingMarketplaceState> emit,
  ) {
    final current = state;
    if (current is! BookingMarketplaceReady) return;
    if (!current.slots.any((slot) => slot.id == event.slot.id)) return;
    emit(current.copyWith(selectedSlot: event.slot, clearNotice: true));
  }

  Future<void> _onHoldRequested(
    BookingMarketplaceHoldRequested event,
    Emitter<BookingMarketplaceState> emit,
  ) async {
    final current = state;
    if (current is! BookingMarketplaceReady || current.selectedSlot == null) {
      return;
    }

    final selectedSlot = current.selectedSlot!;
    final requestContext = _requestCoordinator.contextFor(
      slotId: selectedSlot.id,
      petId: petId,
    );

    emit(BookingMarketplaceCreatingHold(
      selectedDay: current.selectedDay,
      slots: current.slots,
      selectedSlot: selectedSlot,
    ));

    await _tryCreateHold(
      emit,
      readyState: current,
      requestContext: requestContext,
    );
  }

  Future<void> _tryCreateHold(
    Emitter<BookingMarketplaceState> emit, {
    required BookingMarketplaceReady readyState,
    required BookingHoldRequestContext requestContext,
  }) async {
    final selectedSlot = readyState.selectedSlot!;

    try {
      final hold = await _repository.createHold(
        slotId: requestContext.slotId,
        petId: requestContext.petId,
        correlationId: requestContext.correlationId,
        idempotencyKey: requestContext.idempotencyKey,
      );
      emit(BookingMarketplaceHoldCreated(hold));
    } on BookingMarketplaceApiException catch (error) {
      final action = actionForBookingHoldFailure(error);
      if (action == BookingHoldFailureAction.slotLockedRetry) {
        final retried = await _retrySlotLock(
          emit,
          readyState: readyState,
          requestContext: requestContext,
        );
        if (retried) return;
        _requestCoordinator.releaseSlot(selectedSlot.id);
        emit(BookingMarketplaceError(
          selectedDay: readyState.selectedDay,
          message: 'Это время уже заняли. Выберите другое время.',
          slots: readyState.slots,
          selectedSlot: selectedSlot,
          showSlotUnavailableDialog: true,
        ));
        return;
      }
      if (action == BookingHoldFailureAction.refreshAvailability) {
        _requestCoordinator.releaseSlot(selectedSlot.id);
        emit(BookingMarketplaceLoading(selectedDay: readyState.selectedDay));
        await _load(
          emit,
          notice: 'Это время уже заняли. Выберите другое время.',
        );
        return;
      }
      emit(BookingMarketplaceError(
        selectedDay: readyState.selectedDay,
        message: _messageFor(error),
        slots: readyState.slots,
        selectedSlot: selectedSlot,
      ));
    } catch (_) {
      emit(BookingMarketplaceError(
        selectedDay: readyState.selectedDay,
        message:
            'Не удалось оформить запись. Проверьте соединение и повторите попытку.',
        slots: readyState.slots,
        selectedSlot: selectedSlot,
      ));
    }
  }

  Future<bool> _retrySlotLock(
    Emitter<BookingMarketplaceState> emit, {
    required BookingMarketplaceReady readyState,
    required BookingHoldRequestContext requestContext,
  }) async {
    final selectedSlot = readyState.selectedSlot!;

    for (var index = 0; index < _slotLockedRetryDelays.length; index += 1) {
      final delay = _slotLockedRetryDelays[index];
      emit(BookingSlotLockingInProgress(
        selectedDay: readyState.selectedDay,
        slots: readyState.slots,
        selectedSlot: selectedSlot,
        correlationId: requestContext.correlationId,
        retryAttempt: index + 1,
        nextDelay: delay,
      ));
      await _retryDelay(delay);

      try {
        final hold = await _repository.createHold(
          slotId: requestContext.slotId,
          petId: requestContext.petId,
          correlationId: requestContext.correlationId,
          idempotencyKey: requestContext.idempotencyKey,
        );
        emit(BookingMarketplaceHoldCreated(hold));
        return true;
      } on BookingMarketplaceApiException catch (error) {
        final action = actionForBookingHoldFailure(error);
        if (action == BookingHoldFailureAction.slotLockedRetry) {
          continue;
        }
        if (action == BookingHoldFailureAction.refreshAvailability) {
          _requestCoordinator.releaseSlot(selectedSlot.id);
          emit(BookingMarketplaceLoading(selectedDay: readyState.selectedDay));
          await _load(
            emit,
            notice: 'Это время уже заняли. Выберите другое время.',
          );
          return true;
        }
        emit(BookingMarketplaceError(
          selectedDay: readyState.selectedDay,
          message: _messageFor(error),
          slots: readyState.slots,
          selectedSlot: selectedSlot,
        ));
        return true;
      } catch (_) {
        emit(BookingMarketplaceError(
          selectedDay: readyState.selectedDay,
          message:
              'Не удалось оформить запись. Проверьте соединение и повторите попытку.',
          slots: readyState.slots,
          selectedSlot: selectedSlot,
        ));
        return true;
      }
    }

    return false;
  }

  Future<void> _load(
    Emitter<BookingMarketplaceState> emit, {
    String? notice,
  }) async {
    emit(BookingMarketplaceLoading(selectedDay: _selectedDay));
    try {
      final slots = await _repository.listSlots(
        clinicLocationId: clinicLocationId,
        serviceId: serviceId,
        from: _selectedDay,
        to: _selectedDay.add(const Duration(days: 1)),
      );
      emit(BookingMarketplaceReady(
        selectedDay: _selectedDay,
        slots: slots,
        notice: notice,
      ));
    } on BookingMarketplaceApiException catch (error) {
      emit(BookingMarketplaceError(
        selectedDay: _selectedDay,
        message: _messageFor(error),
      ));
    } catch (_) {
      emit(BookingMarketplaceError(
        selectedDay: _selectedDay,
        message:
            'Не удалось загрузить доступное время. Проверьте соединение и повторите попытку.',
      ));
    }
  }

  String _messageFor(BookingMarketplaceApiException error) {
    return switch (error.code) {
      'UNAUTHENTICATED' =>
        'Сессия истекла. Войдите снова и обновите список времени.',
      'PET_OWNERSHIP_MISMATCH' =>
        'Не удалось подтвердить доступ к профилю питомца.',
      'EXTERNAL_PATIENT_MAPPING_REQUIRED' =>
        'Клиника пока не может принять запись для этого питомца. Выберите другую клинику.',
      'HOLD_EXPIRED' => 'Это время уже заняли. Выберите другое время.',
      _ => 'Не удалось выполнить действие. Повторите попытку.',
    };
  }
}
