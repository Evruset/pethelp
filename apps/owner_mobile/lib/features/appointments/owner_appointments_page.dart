import 'package:flutter/material.dart';

import '../booking/marketplace/booking_hold_status_page.dart';
import 'owner_appointments_repository.dart';

class OwnerAppointmentsPage extends StatefulWidget {
  const OwnerAppointmentsPage({super.key, required this.repository});
  final OwnerAppointmentsRepository repository;

  @override
  State<OwnerAppointmentsPage> createState() => _OwnerAppointmentsPageState();
}

class _OwnerAppointmentsPageState extends State<OwnerAppointmentsPage> {
  Future<List<OwnerAppointment>>? _request;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    final request = widget.repository.list();
    setState(() {
      _request = request;
    });
  }

  Future<void> _refresh() async {
    _reload();
    await _request;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<OwnerAppointment>>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Center(
              child: FilledButton.icon(onPressed: _reload, icon: const Icon(Icons.refresh), label: const Text('Повторить загрузку')),
            );
          }
          final rows = snapshot.data ?? const <OwnerAppointment>[];
          if (rows.isEmpty) return const _AppointmentsEmpty();
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _AppointmentCard(
                appointment: rows[index],
                readHold: widget.repository.readHold,
              ),
            ),
          );
        },
      );
}

class _AppointmentsEmpty extends StatelessWidget {
  const _AppointmentsEmpty();
  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('Здесь появятся ваши записи. После отправки заявки мы покажем её актуальный серверный статус.', textAlign: TextAlign.center),
        ),
      );
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({required this.appointment, required this.readHold});
  final OwnerAppointment appointment;
  final BookingHoldReader readHold;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final date = MaterialLocalizations.of(context).formatMediumDate(appointment.startsAt);
    final start = TimeOfDay.fromDateTime(appointment.startsAt).format(context);
    final end = TimeOfDay.fromDateTime(appointment.endsAt).format(context);
    final state = _state(appointment.state, colors);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => BookingHoldStatusPage(
            holdId: appointment.holdId,
            initialState: appointment.state,
            readHold: readHold,
          ),
        )),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(appointment.clinicName, style: Theme.of(context).textTheme.titleMedium)),
              Chip(avatar: Icon(state.icon, size: 16, color: state.color), label: Text(state.label)),
            ]),
            const SizedBox(height: 8),
            Text('$date · $start–$end'),
            const SizedBox(height: 4),
            Row(children: [
              Expanded(child: Text('${appointment.petName} · ${appointment.clinicAddress}', style: Theme.of(context).textTheme.bodySmall)),
              const Icon(Icons.chevron_right),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _StateView {
  const _StateView(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

_StateView _state(String value, ColorScheme colors) => switch (value) {
      'MANUAL_CONFIRM_PENDING' => _StateView('Ожидает клинику', Icons.hourglass_top_outlined, colors.primary),
      'CONFIRMED' => _StateView('Подтверждена', Icons.check_circle_outline, colors.tertiary),
      'EXPIRED' || 'SLA_BREACHED' => _StateView('Не подтверждена', Icons.schedule_outlined, colors.error),
      'RELEASED' || 'MIS_BOOKING_FAILED' => _StateView('Отменена', Icons.event_busy_outlined, colors.error),
      _ => _StateView('Обновляется', Icons.sync_outlined, colors.primary),
    };
