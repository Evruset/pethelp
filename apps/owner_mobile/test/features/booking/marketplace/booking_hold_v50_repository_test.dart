import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_selection_models.dart';

void main() {
  test('create hold sends typed authority fields and stable operation headers',
      () async {
    late http.Request sent;
    final repository = HttpBookingMarketplaceRepository(
      baseUrl: Uri.parse('https://api.example.test'),
      accessTokenProvider: () async => 'owner-token',
      client: MockClient((request) async {
        sent = request;
        return http.Response(
            jsonEncode({
              'holdId': 'hold-1',
              'state': 'MANUAL_CONFIRM_PENDING',
              'slotId': 'slot-1',
              'expiresAt': '2026-07-17T06:45:00Z',
              'correlationId': 'corr-1',
            }),
            201);
      }),
    );

    await repository.createSelectionHold(const CreateBookingHoldRequest(
      selection: _selection,
      operationKey: 'operation-1',
      correlationId: 'corr-1',
    ));

    expect(sent.url.path, '/v1/booking-holds');
    expect(sent.headers['idempotency-key'], 'operation-1');
    expect(sent.headers['x-correlation-id'], 'corr-1');
    expect(sent.headers['authorization'], 'Bearer owner-token');
    expect(jsonDecode(sent.body), {
      'petId': 'pet-1',
      'slotId': 'slot-1',
      'expectedSlotVersion': 17,
      'serviceId': 'service-1',
      'doctorId': null,
    });
    expect(sent.body, isNot(contains('clinicId')));
    expect(sent.body, isNot(contains('ownerId')));
    expect(sent.body, isNot(contains('price')));
  });

  test('authoritative snapshot uses server clock and terminal classification',
      () async {
    final snapshot = BookingHoldSnapshot.fromJson({
      'holdId': 'hold-1',
      'slotId': 'slot-1',
      'state': 'EXPIRED',
      'expiresAt': '2026-07-17T06:45:00Z',
      'startsAt': '2026-07-17T07:00:00Z',
      'endsAt': '2026-07-17T07:30:00Z',
      'serverNow': '2026-07-17T06:46:00Z',
      'aggregateVersion': 4,
    });

    expect(snapshot.serverNow, DateTime.utc(2026, 7, 17, 6, 46));
    expect(snapshot.aggregateVersion, 4);
    expect(snapshot.isTerminal, isTrue);
  });
}

const _selection = BookingSelectionContext(
  petId: 'pet-1',
  clinicId: 'clinic-1',
  locationId: 'location-1',
  serviceId: 'service-1',
  doctorId: null,
  selectedDate: '2026-07-17',
  slotId: 'slot-1',
  expectedSlotVersion: 17,
  confirmationMode: BookingConfirmationMode.clinicConfirmation,
  priceSnapshot: BookingPriceSnapshot(
    amount: '2500.00',
    currency: 'RUB',
    additionalCostsPossible: true,
    finalPriceStatus: 'CLINIC_AGREEMENT_REQUIRED',
  ),
  priceReference: 'service:service-1',
  availabilityFreshness: BookingAvailabilityFreshness.current,
);
