import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'features/booking/alternative_slot/alternative_slot_page.dart';
import 'features/booking/alternative_slot/alternative_slot_repository.dart';
import 'ui/vethelp_ios_theme.dart';

const bookingId = '11111111-1111-4111-8111-111111111111';
const proposalId = '22222222-2222-4222-8222-222222222222';

void main() => runApp(const _EvidenceApp());

class _EvidenceApp extends StatelessWidget {
  const _EvidenceApp();
  @override
  Widget build(BuildContext context) {
    final state = Uri.base.queryParameters['state'] ?? 'ALTERNATIVE_READY';
    var reads = 0;
    final repository = AlternativeSlotRepository(
        baseUrl: Uri.parse('https://evidence.invalid'),
        accessTokenProvider: () async => 'evidence',
        client: MockClient((request) async {
          if (state == 'ALTERNATIVE_NETWORK_AMBIGUOUS' && reads > 0) {
            throw Exception('ambiguous transport');
          }
          if (request.method == 'POST') {
            if (state == 'ALTERNATIVE_ACCEPT_SUBMITTING') {
              await Future<void>.delayed(const Duration(minutes: 1));
            }
            if (state == 'ALTERNATIVE_NETWORK_AMBIGUOUS') {
              reads++;
              throw Exception('ambiguous transport');
            }
            return _json({
              'bookingId': bookingId,
              'proposalId': proposalId,
              'state': 'PROCESSING'
            });
          }
          reads++;
          return _json(_snapshot(state));
        }));
    final page = AlternativeSlotPage(
        holdId: bookingId,
        repository: repository,
        offline: state == 'ALTERNATIVE_OFFLINE_STALE',
        evidenceInitialAccept: state == 'ALTERNATIVE_ACCEPT_SUBMITTING' ||
            state == 'ALTERNATIVE_NETWORK_AMBIGUOUS');
    return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: VetHelpTheme.light(),
        home: state == 'ALTERNATIVE_DECLINE_CONFIRMATION'
            ? _ProductionDialogFrame(child: page)
            : page);
  }
}

class _ProductionDialogFrame extends StatefulWidget {
  const _ProductionDialogFrame({required this.child});
  final Widget child;
  @override
  State<_ProductionDialogFrame> createState() => _ProductionDialogFrameState();
}

class _ProductionDialogFrameState extends State<_ProductionDialogFrame> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) showAlternativeDeclineDialog(context);
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

http.Response _json(Object value) => http.Response(jsonEncode(value), 200,
    headers: {'content-type': 'application/json'});

Map<String, dynamic> _snapshot(String evidenceState) {
  final state = switch (evidenceState) {
    'ALTERNATIVE_ACCEPTED' => 'ACCEPTED',
    'ALTERNATIVE_DECLINED' => 'DECLINED',
    'ALTERNATIVE_EXPIRED' => 'EXPIRED',
    'ALTERNATIVE_SUPERSEDED' => 'SUPERSEDED',
    'ALTERNATIVE_SLOT_UNAVAILABLE' => 'UNAVAILABLE',
    _ => 'ALTERNATIVE_PENDING'
  };
  final pending = state == 'ALTERNATIVE_PENDING';
  return {
    'bookingId': bookingId,
    'proposalId': proposalId,
    'state': state,
    'aggregateVersion': 7,
    'serverNow': '2026-07-16T09:00:00Z',
    'deadline': evidenceState == 'ALTERNATIVE_EXPIRING'
        ? '2026-07-16T09:00:45Z'
        : '2026-07-16T09:15:00Z',
    'originalSlot': {
      'id': '33333333-3333-4333-8333-333333333333',
      'startsAt': '2026-07-17T09:00:00Z',
      'endsAt': '2026-07-17T09:30:00Z'
    },
    'proposedSlot': {
      'id': '44444444-4444-4444-8444-444444444444',
      'startsAt': '2026-07-17T12:30:00Z',
      'endsAt': '2026-07-17T13:00:00Z'
    },
    'actions': {
      'canAccept': pending,
      'canDecline': pending,
      'code': pending ? 'ALTERNATIVE_RESOLUTION_REQUIRED' : 'ALTERNATIVE_$state'
    },
    'priceCopy': evidenceState == 'ALTERNATIVE_PRICE_CHANGED'
        ? 'Стоимость увеличится на 500 ₽. Окончательная стоимость подтверждается клиникой.'
        : 'Стоимость не изменилась.',
    'context': {
      'petId': '55555555-5555-4555-8555-555555555555',
      'clinicId': '66666666-6666-4666-8666-666666666666',
      'locationId': '77777777-7777-4777-8777-777777777777',
      'serviceId': '88888888-8888-4888-8888-888888888888',
      'doctorId': null
    }
  };
}
