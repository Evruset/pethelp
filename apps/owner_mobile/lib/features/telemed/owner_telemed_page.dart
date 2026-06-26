import 'package:flutter/material.dart';

import 'owner_telemed_repository.dart';
import 'waiting_room/telemed_room_access_repository.dart';
import 'waiting_room/telemed_waiting_room_bloc.dart';
import 'waiting_room/telemed_waiting_room_page.dart';

class OwnerTelemedPage extends StatefulWidget {
  const OwnerTelemedPage({
    super.key,
    required this.repository,
    required this.waitingRepository,
    required this.roomAccessRepository,
    this.onCreateConsultation,
  });

  final OwnerTelemedRepository repository;
  final TelemedWaitingRepository waitingRepository;
  final TelemedRoomAccessRepository roomAccessRepository;
  final VoidCallback? onCreateConsultation;

  @override
  State<OwnerTelemedPage> createState() => _OwnerTelemedPageState();
}

class _OwnerTelemedPageState extends State<OwnerTelemedPage> {
  Future<List<OwnerTelemedSession>>? _request;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _request = widget.repository.list();
    });
  }

  Future<void> _refresh() async {
    _reload();
    await _request;
  }

  void _openWaitingRoom(OwnerTelemedSession session) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TelemedWaitingRoomPage(
        sessionId: session.sessionId,
        repository: widget.waitingRepository,
        roomAccessRepository: widget.roomAccessRepository,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Онлайн-консультации')),
      body: FutureBuilder<List<OwnerTelemedSession>>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _TelemedError(onRetry: _reload);
          }
          final rows = snapshot.data ?? const <OwnerTelemedSession>[];
          final active = rows
              .where((session) => session.bucket == 'ACTIVE')
              .toList(growable: false);
          final history = rows
              .where((session) => session.bucket != 'ACTIVE')
              .toList(growable: false);
          return DefaultTabController(
            length: 2,
            child: Column(
              children: [
                const TabBar(tabs: [
                  Tab(text: 'Активные'),
                  Tab(text: 'История'),
                ]),
                Expanded(
                  child: TabBarView(
                    children: [
                      _TelemedSessionList(
                        rows: active,
                        emptyText:
                            'Активных онлайн-консультаций нет. Новая консультация появится здесь после оплаты и подтверждения.',
                        onRefresh: _refresh,
                        onOpen: _openWaitingRoom,
                        onCreateConsultation: widget.onCreateConsultation,
                      ),
                      _TelemedSessionList(
                        rows: history,
                        emptyText:
                            'Завершённые и отменённые консультации появятся здесь.',
                        onRefresh: _refresh,
                        onOpen: _openWaitingRoom,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TelemedSessionList extends StatelessWidget {
  const _TelemedSessionList({
    required this.rows,
    required this.emptyText,
    required this.onRefresh,
    required this.onOpen,
    this.onCreateConsultation,
  });

  final List<OwnerTelemedSession> rows;
  final String emptyText;
  final Future<void> Function() onRefresh;
  final ValueChanged<OwnerTelemedSession> onOpen;
  final VoidCallback? onCreateConsultation;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 72),
            Icon(Icons.video_call_outlined,
                size: 48, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 12),
            Text(emptyText, textAlign: TextAlign.center),
            if (onCreateConsultation != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onCreateConsultation,
                icon: const Icon(Icons.search),
                label: const Text('Выбрать онлайн-приём'),
              ),
            ],
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => _TelemedSessionCard(
          session: rows[index],
          onOpen: () => onOpen(rows[index]),
        ),
      ),
    );
  }
}

class _TelemedSessionCard extends StatelessWidget {
  const _TelemedSessionCard({required this.session, required this.onOpen});

  final OwnerTelemedSession session;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final state = _state(session.state, colors);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(state.icon, color: state.color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      state.label,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 8),
              Text(session.serviceName ?? 'Онлайн-консультация'),
              const SizedBox(height: 4),
              Text(
                '${session.petName} · ${session.clinicName}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              Text(_range(context, session.startsAt, session.endsAt)),
              if (session.state == 'WAITING_FOR_DOCTOR') ...[
                const SizedBox(height: 8),
                Text(
                  'Врач должен подключиться до ${_dateTime(context, session.doctorJoinDeadlineAt)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TelemedError extends StatelessWidget {
  const _TelemedError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 44),
            const SizedBox(height: 12),
            const Text(
              'Не удалось загрузить консультации. Проверьте соединение и повторите попытку.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить'),
            ),
          ],
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
      'WAITING_FOR_DOCTOR' => _StateView(
          'Ожидаем врача', Icons.hourglass_top_outlined, colors.primary),
      'CONNECTED' =>
        _StateView('Врач подключился', Icons.video_call, colors.tertiary),
      'COMPLETED' =>
        _StateView('Завершена', Icons.check_circle_outline, colors.primary),
      'DOCTOR_TIMEOUT' => _StateView(
          'Врач не подключился', Icons.schedule_outlined, colors.error),
      _ =>
        _StateView('Статус обновляется', Icons.sync_outlined, colors.primary),
    };

String _dateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(local);
  final time = TimeOfDay.fromDateTime(local).format(context);
  return '$date, $time';
}

String _range(BuildContext context, DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(first);
  final start = TimeOfDay.fromDateTime(first).format(context);
  final end = TimeOfDay.fromDateTime(last).format(context);
  return '$date · $start-$end';
}
