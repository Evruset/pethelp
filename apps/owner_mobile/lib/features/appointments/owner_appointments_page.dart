import 'package:flutter/material.dart';

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
    setState(() => _request = request);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<OwnerAppointment>>(
      future: _request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_outlined, size: 48),
                  const SizedBox(height: 12),
                  const Text('Не удалось загрузить записи.'),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _reload,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Повторить'),
                  ),
                ],
              ),
            ),
          );
        }
        final appointments = snapshot.data ?? const <OwnerAppointment>[];
        if (appointments.isEmpty) {
          return const _AppointmentsEmpty();
        }
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            itemCount: appointments.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _AppointmentCard(appointment: appointments[index]),
          ),
        );
      },
    );
  }
}

class _AppointmentsEmpty extends StatelessWidget {
  const _AppointmentsEmpty();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.event_available_outlined, size: 48),
              SizedBox(height: 12),
              Text('Здесь появятся ваши записи'),
              SizedBox(height: 8),
              Text('После отправки заявки мы покажем её актуальный серверный статус.', textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({required this.appointment});

  final OwnerAppointment appointment;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final localizations = MaterialLocalizations.of(context);
    final date = localizations.formatMediumDate(appointment.startsAt);
    final start = TimeOfDay.fromDateTime(appointment.startsAt).format(context);
    final end = TimeOfDay.fromDateTime(appointment.endsAt).format(context);
    final state = _statePresentation(appointment.state, colors);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(appointment.clinicName, style: Theme.of(context).textTheme.titleMedium)),
                Chip(
                  avatar: Icon(state.icon, size: 16, color: state.color),
                  label: Text(state.label),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('$date · $start–$end'),
            const SizedBox(height: 4),
            Text('${appointment.petName} · ${appointment.clinicAddress}', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _StatePresentation {
  const _StatePresentation(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

_StatePresentation _statePresentation(String value, ColorScheme colors) => switch (value) {
      'MANUAL_CONFIRM_PENDING' => _StatePresentation('Ожидает клинику', Icons.hourglass_top_outlined, colors.primary),
      'CONFIRMED' => _StatePresentation('Подтверждена', Icons.check_circle_outline, colors.tertiary),
      'EXPIRED' || 'SLA_BREACHED' => _StatePresentation('Не подтверждена', Icons.schedule_outlined, colors.error),
      'RELEASED' || 'MIS_BOOKING_FAILED' => _StatePresentation('Отменена', Icons.event_busy_outlined, colors.error),
      _ => _StatePresentation('Обновляется', Icons.sync_outlined, colors.primary),
    };
