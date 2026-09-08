import 'dart:convert';

import 'package:http/http.dart' as http;

import 'booking_selection_models.dart';

abstract class BookingSelectionRepository {
  Future<BookingSelectionSnapshot> readOptions({
    required String locationId,
    String? serviceId,
    String? doctorId,
    String? selectedPetId,
  });
}

class HttpBookingSelectionRepository implements BookingSelectionRepository {
  HttpBookingSelectionRepository({
    required this.baseUrl,
    this.accessTokenProvider,
    http.Client? client,
  }) : client = client ?? http.Client();

  final Uri baseUrl;
  final Future<String> Function()? accessTokenProvider;
  final http.Client client;

  @override
  Future<BookingSelectionSnapshot> readOptions({
    required String locationId,
    String? serviceId,
    String? doctorId,
    String? selectedPetId,
  }) async {
    final query = <String, String>{
      if (serviceId != null) 'serviceId': serviceId,
      if (doctorId != null) 'doctorId': doctorId,
      if (selectedPetId != null) 'selectedPetId': selectedPetId,
      'limit': '50',
    };
    final token = await accessTokenProvider?.call();
    final response = await client.get(
      baseUrl
          .resolve('/v1/clinic-locations/$locationId/booking-options')
          .replace(queryParameters: query),
      headers: {
        'Accept': 'application/json',
        if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode != 200) {
      throw BookingSelectionApiException(response.statusCode);
    }
    return _snapshot(jsonDecode(response.body) as Map<String, dynamic>);
  }

  BookingSelectionSnapshot _snapshot(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>;
    final window = json['window'] as Map<String, dynamic>;
    final personalization = json['personalization'] as Map<String, dynamic>;
    return BookingSelectionSnapshot(
      clinicId: location['clinicId'] as String,
      clinicName: location['clinicName'] as String,
      locationId: location['id'] as String,
      locationAddress: location['address'] as String,
      timezone: location['timezone'] as String,
      serverNow: DateTime.parse(window['serverNow'] as String),
      availableDates: (window['availableDates'] as List).cast<String>(),
      freshness: _freshness(window['freshness'] as String),
      services:
          (json['services'] as List).cast<Map<String, dynamic>>().map((item) {
        final price = item['price'] as Map<String, dynamic>;
        return BookingOptionService(
          id: item['id'] as String,
          code: item['code'] as String,
          displayName: item['displayName'] as String,
          durationMinutes: item['durationMinutes'] as int,
          price: BookingPriceSnapshot(
            amount: price['amount'] as String,
            currency: price['currency'] as String,
            additionalCostsPossible: price['additionalCostsPossible'] as bool,
            finalPriceStatus: price['finalPriceStatus'] as String,
          ),
        );
      }).toList(growable: false),
      slots: (json['slots'] as List)
          .cast<Map<String, dynamic>>()
          .map((item) => BookingOptionSlot(
                id: item['id'] as String,
                serviceId: item['serviceId'] as String,
                startsAt: DateTime.parse(item['startsAt'] as String),
                endsAt: DateTime.parse(item['endsAt'] as String),
                localDate: item['localDate'] as String,
                localTime: item['localTime'] as String,
                timezone: item['timezone'] as String,
                availability: switch (item['availabilityState'] as String) {
                  'AVAILABLE' => BookingSlotAvailability.available,
                  'REQUEST_ONLY' => BookingSlotAvailability.requestOnly,
                  _ => BookingSlotAvailability.stale,
                },
                expectedVersion: item['expectedVersion'] as int,
                freshness: _freshness(item['freshness'] as String),
                confirmationMode:
                    _confirmation(item['confirmationMode'] as String),
                sourceUpdatedAt:
                    DateTime.parse(item['sourceUpdatedAt'] as String),
                priceReference: item['priceReference'] as String,
              ))
          .toList(growable: false),
      personalizationApplied: personalization['applied'] as bool,
    );
  }

  BookingAvailabilityFreshness _freshness(String value) => switch (value) {
        'CURRENT' => BookingAvailabilityFreshness.current,
        'AGING' => BookingAvailabilityFreshness.aging,
        'STALE' => BookingAvailabilityFreshness.stale,
        _ => BookingAvailabilityFreshness.unavailable,
      };

  BookingConfirmationMode _confirmation(String value) => switch (value) {
        'INSTANT' => BookingConfirmationMode.instant,
        'ALTERNATIVE_POSSIBLE' => BookingConfirmationMode.alternativePossible,
        _ => BookingConfirmationMode.clinicConfirmation,
      };
}

class BookingSelectionApiException implements Exception {
  const BookingSelectionApiException(this.statusCode);
  final int statusCode;
}
