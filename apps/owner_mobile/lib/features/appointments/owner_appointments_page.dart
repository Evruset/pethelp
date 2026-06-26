import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../booking/alternative_slot/alternative_slot_page.dart';
import '../booking/alternative_slot/alternative_slot_repository.dart';
import 'owner_appointments_repository.dart';

class OwnerAppointmentsPage extends StatefulWidget {
  const OwnerAppointmentsPage({
    super.key,
    required this.repository,
    this.alternativeSlotRepository,
  });

  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;

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
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _AppointmentsLoadError(onRetry: _reload);
          }

          final rows = snapshot.data ?? const <OwnerAppointment>[];
          final active = rows
              .where((row) => row.bucket == 'ACTIVE')
              .toList(growable: false);
          final history = rows
              .where((row) => row.bucket == 'HISTORY')
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
                      _AppointmentsList(
                        rows: active,
                        isHistory: false,
                        repository: widget.repository,
                        alternativeSlotRepository:
                            widget.alternativeSlotRepository,
                        onRefresh: _refresh,
                      ),
                      _AppointmentsList(
                        rows: history,
                        isHistory: true,
                        repository: widget.repository,
                        alternativeSlotRepository:
                            widget.alternativeSlotRepository,
                        onRefresh: _refresh,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      );
}

class _AppointmentsLoadError extends StatelessWidget {
  const _AppointmentsLoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 44),
              const SizedBox(height: 12),
              Text('Не удалось загрузить записи',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              const Text('Проверьте подключение и повторите попытку.',
                  textAlign: TextAlign.center),
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

class _AppointmentsList extends StatelessWidget {
  const _AppointmentsList({
    required this.rows,
    required this.isHistory,
    required this.repository,
    required this.alternativeSlotRepository,
    required this.onRefresh,
  });

  final List<OwnerAppointment> rows;
  final bool isHistory;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 88),
            Icon(
              isHistory
                  ? Icons.history_outlined
                  : Icons.calendar_today_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 14),
            Text(
              isHistory ? 'История записей пуста' : 'Активных записей нет',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              isHistory
                  ? 'Здесь останутся отменённые, неподтверждённые и прошедшие записи.'
                  : 'Новая заявка появится здесь после отправки в клинику.',
              textAlign: TextAlign.center,
            ),
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
        itemBuilder: (context, index) => _AppointmentCard(
          appointment: rows[index],
          repository: repository,
          alternativeSlotRepository: alternativeSlotRepository,
        ),
      ),
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({
    required this.appointment,
    required this.repository,
    required this.alternativeSlotRepository,
  });

  final OwnerAppointment appointment;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;

  @override
  Widget build(BuildContext context) {
    final visual = _presentationVisual(
      appointment.presentation,
      Theme.of(context).colorScheme,
    );
    final date = MaterialLocalizations.of(context)
        .formatMediumDate(appointment.startsAt);
    final start = TimeOfDay.fromDateTime(appointment.startsAt).format(context);
    final end = TimeOfDay.fromDateTime(appointment.endsAt).format(context);

    return Card(
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => OwnerAppointmentDetailPage(
            holdId: appointment.holdId,
            initialSummary: appointment,
            repository: repository,
            alternativeSlotRepository: alternativeSlotRepository,
          ),
        )),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      appointment.clinicName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  const SizedBox(width: 12),
                  _StatusPill(visual: visual),
                ],
              ),
              const SizedBox(height: 10),
              Text('$date · $start–$end'),
              const SizedBox(height: 4),
              Text(
                '${appointment.petName} · ${appointment.clinicAddress}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              Text(
                appointment.presentation.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OwnerAppointmentDetailPage extends StatefulWidget {
  const OwnerAppointmentDetailPage({
    super.key,
    required this.holdId,
    required this.initialSummary,
    required this.repository,
    this.alternativeSlotRepository,
  });

  final String holdId;
  final OwnerAppointment initialSummary;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;

  @override
  State<OwnerAppointmentDetailPage> createState() =>
      _OwnerAppointmentDetailPageState();
}

class _OwnerAppointmentDetailPageState
    extends State<OwnerAppointmentDetailPage> {
  Future<OwnerAppointmentDetail>? _request;
  OwnerAppointmentDetail? _last;
  Timer? _pollingTimer;
  bool _stale = false;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _reload() {
    final request = widget.repository.readDetail(widget.holdId);
    setState(() {
      _request = request;
      _stale = false;
    });
  }

  Future<void> _refresh() async {
    try {
      final detail = await widget.repository.readDetail(widget.holdId);
      if (!mounted) {
        return;
      }
      setState(() {
        _last = detail;
        _request = Future<OwnerAppointmentDetail>.value(detail);
        _stale = false;
      });
      _syncPolling(detail);
    } catch (_) {
      if (mounted) {
        setState(() {
          _stale = true;
        });
      }
    }
  }

  Future<void> _cancel(OwnerAppointmentDetail detail) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Отменить запись?'),
        content: Text(
          '${detail.clinicName}\n${_range(context, detail.startsAt, detail.endsAt)}\n\nЭто действие освободит заявку. Вернуть её автоматически не получится.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Назад'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Отменить'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _cancelling = true;
    });
    try {
      await widget.repository.releaseHold(detail.holdId);
      await _refresh();
      if (!mounted) {
        return;
      }
      await HapticFeedback.mediumImpact();
      if (mounted) _message(context, 'Запись отменена.');
    } on OwnerAppointmentsApiException catch (error) {
      if (mounted) _message(context, _releaseError(error));
    } catch (_) {
      if (mounted) {
        _message(context,
            'Не удалось отменить запись. Проверьте соединение и повторите попытку.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _cancelling = false;
        });
      }
    }
  }

  void _openAlternative(String holdId) {
    final repository = widget.alternativeSlotRepository;
    if (repository == null) {
      _message(context,
          'Экран альтернативного времени недоступен в этом запуске приложения.');
      return;
    }
    Navigator.of(context)
        .push(MaterialPageRoute<void>(
          builder: (_) => AlternativeSlotPage(
            holdId: holdId,
            repository: repository,
          ),
        ))
        .then((_) => _refresh());
  }

  void _syncPolling(OwnerAppointmentDetail detail) {
    final shouldPoll = detail.bucket == 'ACTIVE' && detail.actions.canRefresh;
    if (!shouldPoll) {
      _pollingTimer?.cancel();
      _pollingTimer = null;
      return;
    }
    _pollingTimer ??= Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _refresh();
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Детали записи')),
        body: FutureBuilder<OwnerAppointmentDetail>(
          future: _request,
          builder: (context, snapshot) {
            final detail = snapshot.data ?? _last;
            if (snapshot.connectionState != ConnectionState.done &&
                detail == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (detail == null) {
              return _AppointmentsLoadError(onRetry: _reload);
            }
            _last = detail;
            _syncPolling(detail);
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  if (_stale || snapshot.hasError) const _StaleBanner(),
                  _StatusHeader(detail: detail),
                  const SizedBox(height: 12),
                  _VisitCard(detail: detail),
                  const SizedBox(height: 12),
                  _TimelineCard(timeline: detail.timeline),
                  if (detail.actions.canRefresh ||
                      detail.actions.canReviewAlternative ||
                      detail.actions.canOpenRoute ||
                      detail.actions.canRebook ||
                      detail.actions.canCancel) ...[
                    const SizedBox(height: 12),
                    _ActionCard(
                      detail: detail,
                      cancelling: _cancelling,
                      onRefresh: _refresh,
                      onReviewAlternative: () =>
                          _openAlternative(detail.holdId),
                      onCancel: () => _cancel(detail),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      );
}

class _StaleBanner extends StatelessWidget {
  const _StaleBanner();

  @override
  Widget build(BuildContext context) => Card(
        color: Theme.of(context).colorScheme.errorContainer,
        child: const ListTile(
          leading: Icon(Icons.cloud_off_outlined),
          title: Text('Показаны последние полученные данные'),
          subtitle:
              Text('Потяните экран вниз, чтобы получить актуальный статус.'),
        ),
      );
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.detail});
  final OwnerAppointmentDetail detail;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final visual = _presentationVisual(detail.presentation, colors);
    return Card(
      color: visual.background,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(visual.icon, size: 32, color: visual.foreground),
            const SizedBox(width: 12),
            Expanded(
                child: Text(detail.presentation.label,
                    style: Theme.of(context).textTheme.titleLarge)),
          ]),
          const SizedBox(height: 8),
          Text(detail.presentation.description),
          const SizedBox(height: 8),
          Text('Обновлено: ${_dateTime(context, detail.latestStatusUpdateAt)}',
              style: Theme.of(context).textTheme.bodySmall),
        ]),
      ),
    );
  }
}

class _VisitCard extends StatelessWidget {
  const _VisitCard({required this.detail});
  final OwnerAppointmentDetail detail;

  @override
  Widget build(BuildContext context) {
    final service = detail.serviceName ?? 'Услуга не указана';
    final price = detail.priceAmount == null
        ? null
        : '${detail.priceAmount} ${detail.currency ?? ''}'.trim();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(detail.clinicName,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(detail.clinicAddress),
          if (detail.locationPhone != null)
            Text(detail.locationPhone!,
                style: Theme.of(context).textTheme.bodySmall),
          const Divider(height: 24),
          _InfoRow(
              icon: Icons.pets_outlined,
              label: '${detail.petName} · ${_species(detail.petSpecies)}'),
          _InfoRow(
              icon: Icons.medical_services_outlined,
              label: price == null ? service : '$service · $price'),
          _InfoRow(
              icon: Icons.schedule_outlined,
              label: _range(context, detail.startsAt, detail.endsAt)),
        ]),
      ),
    );
  }
}

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({required this.timeline});
  final List<OwnerAppointmentTimelineItem> timeline;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('История статуса',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (timeline.isEmpty)
              const Text('VetHelp пока не получил событий по записи.')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: timeline.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = timeline[index];
                  return Row(children: [
                    const Icon(Icons.radio_button_checked, size: 16),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.label),
                          Text(_dateTime(context, item.at),
                              style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ),
                  ]);
                },
              ),
          ]),
        ),
      );
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.detail,
    required this.cancelling,
    required this.onRefresh,
    required this.onReviewAlternative,
    required this.onCancel,
  });

  final OwnerAppointmentDetail detail;
  final bool cancelling;
  final Future<void> Function() onRefresh;
  final VoidCallback onReviewAlternative;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (detail.actions.canRefresh)
              OutlinedButton.icon(
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Обновить')),
            if (detail.actions.canReviewAlternative) ...[
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                  onPressed: onReviewAlternative,
                  icon: const Icon(Icons.swap_horiz),
                  label: const Text('Посмотреть другое время')),
            ],
            if (detail.actions.canOpenRoute) ...[
              const SizedBox(height: 8),
              FilledButton.tonalIcon(
                  onPressed: () => _message(context,
                      'Маршрут до клиники появится после подключения карт.'),
                  icon: const Icon(Icons.route_outlined),
                  label: const Text('Маршрут')),
            ],
            if (detail.actions.canRebook) ...[
              const SizedBox(height: 8),
              FilledButton.icon(
                  onPressed: () =>
                      Navigator.of(context).popUntil((route) => route.isFirst),
                  icon: const Icon(Icons.search),
                  label: const Text('Записаться снова')),
            ],
            if (detail.actions.canCancel) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: cancelling ? null : onCancel,
                icon: cancelling
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.event_busy_outlined),
                label: Text(cancelling ? 'Отменяем...' : 'Отменить'),
              ),
            ],
          ]),
        ),
      );
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.visual});
  final _PresentationVisual visual;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: visual.background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(visual.icon, size: 15, color: visual.foreground),
            const SizedBox(width: 6),
            Flexible(
              child: Text(visual.label,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium),
            ),
          ]),
        ),
      );
}

class _PresentationVisual {
  const _PresentationVisual({
    required this.label,
    required this.icon,
    required this.foreground,
    required this.background,
  });

  final String label;
  final IconData icon;
  final Color foreground;
  final Color background;
}

_PresentationVisual _presentationVisual(
  OwnerAppointmentPresentation presentation,
  ColorScheme colors,
) {
  return switch (presentation.tone) {
    'success' => _PresentationVisual(
        label: presentation.label,
        icon: Icons.check_circle_outline,
        foreground: colors.primary,
        background: colors.primaryContainer,
      ),
    'warning' => _PresentationVisual(
        label: presentation.label,
        icon: Icons.schedule_outlined,
        foreground: colors.onSecondaryContainer,
        background: colors.secondaryContainer,
      ),
    'danger' => _PresentationVisual(
        label: presentation.label,
        icon: Icons.event_busy_outlined,
        foreground: colors.error,
        background: colors.errorContainer,
      ),
    'neutral' => _PresentationVisual(
        label: presentation.label,
        icon: Icons.history_outlined,
        foreground: colors.onSurfaceVariant,
        background: colors.surfaceContainerHigh,
      ),
    _ => _PresentationVisual(
        label: presentation.label,
        icon: Icons.info_outline,
        foreground: colors.primary,
        background: colors.primaryContainer,
      ),
  };
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(children: [
          Icon(icon, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(label)),
        ]),
      );
}

String _species(String value) => switch (value.toLowerCase()) {
      'cat' => 'кошка',
      'dog' => 'собака',
      _ => value,
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
  return '$date · $start–$end';
}

void _message(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

String _releaseError(OwnerAppointmentsApiException error) =>
    switch (error.code) {
      'HOLD_EXPIRED' => 'Заявка уже истекла. Обновите детали записи.',
      'INVALID_TRANSITION' => 'Эту запись уже нельзя отменить.',
      'SLOT_LOCKED_RETRY' =>
        'Клиника обновляет слот. Повторите отмену через несколько секунд.',
      'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
      _ => 'Не удалось отменить запись. Повторите попытку.',
    };
