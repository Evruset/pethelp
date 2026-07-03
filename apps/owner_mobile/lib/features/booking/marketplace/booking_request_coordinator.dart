import 'package:uuid/uuid.dart';

import 'booking_marketplace_repository.dart';

class BookingHoldRequestContext {
  const BookingHoldRequestContext({
    required this.slotId,
    required this.petId,
    required this.correlationId,
    required this.idempotencyKey,
  });

  final String slotId;
  final String petId;
  final String correlationId;
  final String idempotencyKey;
}

typedef BookingUuidFactory = String Function();

class BookingHoldRequestCoordinator {
  BookingHoldRequestCoordinator({
    BookingUuidFactory? uuidFactory,
  }) : _uuidFactory = uuidFactory ?? const Uuid().v4;

  final BookingUuidFactory _uuidFactory;
  final Map<String, String> _idempotencyKeysBySlot = <String, String>{};
  String? _correlationId;

  String get correlationId => _correlationId ??= _uuidFactory();

  BookingHoldRequestContext contextFor({
    required String slotId,
    required String petId,
  }) {
    final flowCorrelationId = correlationId;
    final idempotencyKey = _idempotencyKeysBySlot.putIfAbsent(
      slotId,
      _uuidFactory,
    );

    return BookingHoldRequestContext(
      slotId: slotId,
      petId: petId,
      correlationId: flowCorrelationId,
      idempotencyKey: idempotencyKey,
    );
  }

  void releaseSlot(String slotId) {
    _idempotencyKeysBySlot.remove(slotId);
  }
}

enum BookingHoldFailureAction {
  slotLockedRetry,
  refreshAvailability,
  preserveSelectionAndRefresh,
  showGenericError,
}

BookingHoldFailureAction actionForBookingHoldFailure(
  BookingMarketplaceApiException error,
) {
  if (error.retryable) return BookingHoldFailureAction.slotLockedRetry;
  if (error.slotUnavailable || error.code == 'SLOT_VERSION_STALE') {
    return BookingHoldFailureAction.preserveSelectionAndRefresh;
  }
  if (error.holdExpired) return BookingHoldFailureAction.refreshAvailability;
  return BookingHoldFailureAction.showGenericError;
}
