import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

import 'booking_marketplace_repository.dart';

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

class BookingMarketplaceHoldCreated extends BookingMarketplaceState {
  const BookingMarketplaceHoldCreated(this.hold);
  final CreatedBookingHold hold;
}

class BookingMarketplaceError extends BookingMarketplaceState {
  const BookingMarketplaceError({
    required this.selectedDay,
    required this.message,
  });

  final DateTime selectedDay;
  final String message;
}

class BookingMarketplaceBloc
    extends Bloc<BookingMarketplaceEvent, BookingMarketplaceState> {
  BookingMarketplaceBloc({
    required BookingMarketplaceRepository repository,
    required this.clinicLocationId,
    required this.serviceId,
    required this.petId,
    DateTime? initialDay,
  })  : _repository = repository,
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
  final String clinicLocationId;
  final String serviceId;
  final String petId;
  final Uuid _uuid = const Uuid();
  final Map<String, String> _operationKeysBySlot = <String, String>{};
  String? _correlationId;
  DateTime _selectedDay;

  static DateTime _dayStart(DateTime value) {
    final utc = value.toUtc();
    return DateTime.utc(utc.year, utc.month, utc.day);
  }

  Future<void> _onOpened(
    BookingMarketplaceOpened event,
    Emitter<BookingMarketplaceState> emit,
  ) async {
    _correlationId ??= _uuid.v4();
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
    final correlationId = _correlationId ??= _uuid.v4();
    final idempotencyKey = _operationKeysBySlot.putIfAbsent(
      selectedSlot.id,
      _uuid.v4,
    );

    emit(BookingMarketplaceCreatingHold(
      selectedDay: current.selectedDay,
      slots: current.slots,
      selectedSlot: selectedSlot,
    ));

    try {
      final hold = await _repository.createHold(
        slotId: selectedSlot.id,
        petId: petId,
        correlationId: correlationId,
        idempotencyKey: idempotencyKey,
      );
      emit(BookingMarketplaceHoldCreated(hold));
    } on BookingMarketplaceApiException catch (error) {
      if (error.retryable) {
        emit(BookingMarketplaceLoading(selectedDay: current.selectedDay));
        await _load(
          emit,
          notice:
              'Обновляем доступность. Выбранное время пока не подтверждено.',
        );
        return;
      }
      if (error.slotUnavailable) {
        _operationKeysBySlot.remove(selectedSlot.id);
        emit(BookingMarketplaceLoading(selectedDay: current.selectedDay));
        await _load(
          emit,
          notice: 'Это время уже занято. Показываем актуальные окна.',
        );
        return;
      }
      emit(BookingMarketplaceError(
        selectedDay: current.selectedDay,
        message: _messageFor(error),
      ));
    } catch (_) {
      emit(BookingMarketplaceError(
        selectedDay: current.selectedDay,
        message:
            'Не удалось создать заявку. Проверьте соединение и повторите попытку.',
      ));
    }
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
      'HOLD_EXPIRED' =>
        'Время для подтверждения уже истекло. Обновите доступные окна.',
      _ => 'Не удалось выполнить действие. Повторите попытку.',
    };
  }
}
