import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';

void main() {
  test('parses an available slot returned by the booking API', () {
    final slot = BookingSlot.fromJson(<String, dynamic>{
      'id': '11111111-1111-4111-8111-111111111111',
      'clinic_location_id': '22222222-2222-4222-8222-222222222222',
      'starts_at': '2026-06-25T12:00:00.000Z',
      'ends_at': '2026-06-25T12:30:00.000Z',
      'remaining_capacity': 1,
    });

    expect(slot.remainingCapacity, 1);
    expect(slot.startsAt, DateTime.utc(2026, 6, 25, 12));
    expect(slot.endsAt, DateTime.utc(2026, 6, 25, 12, 30));
  });

  test('parses the authoritative hold result from VetHelp', () {
    final hold = CreatedBookingHold.fromJson(<String, dynamic>{
      'holdId': '33333333-3333-4333-8333-333333333333',
      'state': 'MANUAL_CONFIRM_PENDING',
      'slotId': '11111111-1111-4111-8111-111111111111',
      'expiresAt': '2026-06-25T12:16:00.000Z',
      'correlationId': '44444444-4444-4444-8444-444444444444',
    });

    expect(hold.state, 'MANUAL_CONFIRM_PENDING');
    expect(hold.expiresAt, DateTime.utc(2026, 6, 25, 12, 16));
  });
}
