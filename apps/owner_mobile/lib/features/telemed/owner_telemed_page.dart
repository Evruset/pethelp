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

  /// Kept temporarily for call-site compatibility. Telemedicine intake is not
  /// available yet, so the page deliberately never opens the clinic catalog.
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
    final request = widget.repository.list();
    setState(() {
      _request = request;
    });
  }

  Future<void> _refresh() async {
    _reload();
    await _request;
  }

  void _openWaitingRoom(OwnerTelemedSession session) {
    if (session.bucket != 'ACTIVE') return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TelemedWaitingRoomPage(
        sessionId: session.sessionId,
        repository: widget.waitingRepository,
        roomAccessRepository: widget.roomAccessRepository,
      ),
    ));
  }

  void _openConsultationAvailability() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => const _TelemedIntakeUnavailablePage(),
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
                        emptyTitle: 'Нет активных консультаций',
                        emptyText:
                            'Онлайн-консультация появится здесь после оформления и подтверждения.',
                        onRefresh: _refresh,
                        onOpen: _openWaitingRoom,
                        onCreateConsultation: _openConsultationAvailability,
                      ),
                      _TelemedSessionList(
                        rows: history,
                        emptyTitle: 'История консультаций пуста',
                        emptyText:
                            'Завершённые и отменённые консультации появятся здесь.',
                        onRefresh: _refresh,
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
    required this.emptyTitle,
    required this.emptyText,
    required this.onRefresh,
    this.onOpen,
    this.onCreateConsultation,
  });

  final List<OwnerTelemedSession> rows;
  final String emptyTitle;
  final String emptyText;
  final Future<void> Function() onRefresh;
  final ValueChanged<OwnerTelemedSession>? onOpen;
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
            Icon(
              Icons.video_call_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 12),
            Text(
              emptyTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(emptyText, textAlign: TextAlign.center),
            if (onCreateConsultation != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onCreateConsultation,
                icon: const Icon(Icons.video_call_outlined),
                label: const Text('Выбрать онлайн-консультацию'),
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
          onOpen: onOpen == null ? null : () => onOpen!(rows[index]),
        ),
      ),
    );
  }
}

class _TelemedSessionCard extends StatelessWidget {
  const _TelemedSessionCard({required this.session, this.onOpen});

  final OwnerTelemedSession session;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final state = _state(session.state, colors);
    final canOpen = onOpen != null;

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
                  if (canOpen) const Icon(Icons.chevron_right),
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
              if (state.description != null) ...[
                const SizedBox(height: 8),
                Text(
                  state.description!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
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

class _TelemedIntakeUnavailablePage extends StatelessWidget {
  const _TelemedIntakeUnavailablePage();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Онлайн-консультация')),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 72),
                  Icon(
                    Icons.health_and_safety_outlined,
                    size: 56,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Онлайн-консультация скоро будет доступна',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Сначала мы уточним вопрос о питомце и проверим, подходит ли дистанционная консультация.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Вернуться к помощи питомцу'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
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
  const _StateView(this.label, this.icon, this.color, {this.description});

  final String label;
  final IconData icon;
  final Color color;
  final String? description;
}

_StateView _state(String value, ColorScheme colors) => switch (value) {
      'WAITING_FOR_DOCTOR' => _StateView(
          'Ожидаем врача',
          Icons.hourglass_top_outlined,
          colors.primary,
        ),
      'CONNECTED' => _StateView(
          'Врач подключился',
          Icons.video_call,
          colors.tertiary,
        ),
      'COMPLETED' => _StateView(
          'Консультация завершена',
          Icons.check_circle_outline,
          colors.primary,
        ),
      'DOCTOR_TIMEOUT' => _StateView(
          'Врач не подключился',
          Icons.schedule_outlined,
          colors.error,
          description:
              'Консультация не состоялась. Выберите другой способ помощи питомцу.',
        ),
      _ => _StateView(
          'Статус обновляется',
          Icons.sync_outlined,
          colors.primary,
        ),
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
