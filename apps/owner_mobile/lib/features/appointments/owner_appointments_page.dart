import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../presentation/platform/owner_platform.dart';
import '../booking/alternative_slot/alternative_slot_page.dart';
import '../booking/alternative_slot/alternative_slot_repository.dart';
import 'owner_appointments_repository.dart';

class OwnerAppointmentsPage extends StatefulWidget {
  const OwnerAppointmentsPage({
    super.key,
    required this.repository,
    this.alternativeSlotRepository,
    this.platformOverride,
  });

  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final TargetPlatform? platformOverride;

  @override
  State<OwnerAppointmentsPage> createState() => _OwnerAppointmentsPageState();
}

class _OwnerAppointmentsPageState extends State<OwnerAppointmentsPage> {
  Future<List<OwnerAppointment>>? _request;
  int _cupertinoSegment = 0;

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

  bool _usesCupertino(BuildContext context) {
    final themedPlatform =
        context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
    return ownerUsesCupertino(
      platform: widget.platformOverride ?? themedPlatform,
    );
  }

  @override
  Widget build(BuildContext context) {
    final usesCupertino = _usesCupertino(context);
    if (usesCupertino) {
      return _buildCupertino(context);
    }
    return _buildMaterial(context);
  }

  Widget _buildMaterial(BuildContext context) =>
      FutureBuilder<List<OwnerAppointment>>(
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
                        platformOverride: widget.platformOverride,
                      ),
                      _AppointmentsList(
                        rows: history,
                        isHistory: true,
                        repository: widget.repository,
                        alternativeSlotRepository:
                            widget.alternativeSlotRepository,
                        onRefresh: _refresh,
                        platformOverride: widget.platformOverride,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      );

  Widget _buildCupertino(BuildContext context) =>
      FutureBuilder<List<OwnerAppointment>>(
        future: _request,
        builder: (context, snapshot) {
          final loading = snapshot.connectionState != ConnectionState.done;
          final rows = snapshot.data ?? const <OwnerAppointment>[];
          final active = rows
              .where((row) => row.bucket == 'ACTIVE')
              .toList(growable: false);
          final history = rows
              .where((row) => row.bucket == 'HISTORY')
              .toList(growable: false);
          final currentRows = _cupertinoSegment == 0 ? active : history;

          return CupertinoPageScaffold(
            navigationBar: CupertinoNavigationBar(
              middle: const Text('Записи'),
              trailing: CupertinoButton(
                minSize: 44,
                padding: EdgeInsets.zero,
                onPressed: loading ? null : _reload,
                child: const Icon(CupertinoIcons.refresh),
              ),
            ),
            child: SafeArea(
              bottom: false,
              child: Builder(
                builder: (context) {
                  if (loading) {
                    return const Center(child: CupertinoActivityIndicator());
                  }
                  if (snapshot.hasError) {
                    return _CupertinoAppointmentsLoadError(onRetry: _reload);
                  }
                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                        child: SizedBox(
                          width: double.infinity,
                          child: CupertinoSlidingSegmentedControl<int>(
                            groupValue: _cupertinoSegment,
                            children: const {
                              0: Padding(
                                padding: EdgeInsets.symmetric(vertical: 8),
                                child: Text('Активные'),
                              ),
                              1: Padding(
                                padding: EdgeInsets.symmetric(vertical: 8),
                                child: Text('История'),
                              ),
                            },
                            onValueChanged: (value) {
                              if (value == null) return;
                              setState(() => _cupertinoSegment = value);
                            },
                          ),
                        ),
                      ),
                      Expanded(
                        child: _CupertinoAppointmentsList(
                          rows: currentRows,
                          isHistory: _cupertinoSegment == 1,
                          repository: widget.repository,
                          alternativeSlotRepository:
                              widget.alternativeSlotRepository,
                          onRefresh: _refresh,
                          platformOverride: TargetPlatform.iOS,
                        ),
                      ),
                    ],
                  );
                },
              ),
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
    this.platformOverride,
  });

  final List<OwnerAppointment> rows;
  final bool isHistory;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final Future<void> Function() onRefresh;
  final TargetPlatform? platformOverride;

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
          platformOverride: platformOverride,
        ),
      ),
    );
  }
}

class _CupertinoAppointmentsList extends StatelessWidget {
  const _CupertinoAppointmentsList({
    required this.rows,
    required this.isHistory,
    required this.repository,
    required this.alternativeSlotRepository,
    required this.onRefresh,
    required this.platformOverride,
  });

  final List<OwnerAppointment> rows;
  final bool isHistory;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final Future<void> Function() onRefresh;
  final TargetPlatform platformOverride;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          CupertinoSliverRefreshControl(onRefresh: onRefresh),
          SliverFillRemaining(
            hasScrollBody: false,
            child: _CupertinoAppointmentsEmpty(isHistory: isHistory),
          ),
        ],
      );
    }

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        CupertinoSliverRefreshControl(onRefresh: onRefresh),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          sliver: SliverList.separated(
            itemCount: rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) => _CupertinoAppointmentRow(
              appointment: rows[index],
              repository: repository,
              alternativeSlotRepository: alternativeSlotRepository,
              platformOverride: platformOverride,
            ),
          ),
        ),
      ],
    );
  }
}

class _CupertinoAppointmentsEmpty extends StatelessWidget {
  const _CupertinoAppointmentsEmpty({required this.isHistory});

  final bool isHistory;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isHistory ? CupertinoIcons.clock : CupertinoIcons.calendar,
            size: 48,
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.activeBlue,
              context,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            isHistory ? 'История записей пуста' : 'Активных записей нет',
            textAlign: TextAlign.center,
            style: CupertinoTheme.of(context)
                .textTheme
                .navTitleTextStyle
                .copyWith(fontSize: 22),
          ),
          const SizedBox(height: 8),
          Text(
            isHistory
                ? 'Здесь останутся отменённые, неподтверждённые и прошедшие записи.'
                : 'Новая заявка появится здесь после отправки в клинику.',
            textAlign: TextAlign.center,
            style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                  color: CupertinoDynamicColor.resolve(
                    CupertinoColors.secondaryLabel,
                    context,
                  ),
                ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoAppointmentRow extends StatelessWidget {
  const _CupertinoAppointmentRow({
    required this.appointment,
    required this.repository,
    required this.alternativeSlotRepository,
    required this.platformOverride,
  });

  final OwnerAppointment appointment;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final TargetPlatform platformOverride;

  @override
  Widget build(BuildContext context) {
    final status = _ownerStatusView(
      appointment.presentation,
      state: appointment.state,
      bucket: appointment.bucket,
    );
    final tone = _cupertinoTone(context, status.tone);
    final stacksHeader = MediaQuery.textScalerOf(context).scale(1) >= 1.3;
    return Semantics(
      button: true,
      label:
          '${appointment.clinicName}, ${status.label}, ${appointment.petName}, ${_cupertinoRange(appointment.startsAt, appointment.endsAt)}',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: () => Navigator.of(context).push(
          ownerPageRoute<void>(
            context: context,
            platform: platformOverride,
            builder: (_) => OwnerAppointmentDetailPage(
              holdId: appointment.holdId,
              initialSummary: appointment,
              repository: repository,
              alternativeSlotRepository: alternativeSlotRepository,
              platformOverride: platformOverride,
            ),
          ),
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.secondarySystemGroupedBackground,
              context,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.separator,
                context,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (stacksHeader) ...[
                  Text(
                    appointment.clinicName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style:
                        CupertinoTheme.of(context).textTheme.navTitleTextStyle,
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: _CupertinoStatusPill(status: status),
                  ),
                ] else
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          appointment.clinicName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: CupertinoTheme.of(context)
                              .textTheme
                              .navTitleTextStyle,
                        ),
                      ),
                      const SizedBox(width: 12),
                      _CupertinoStatusPill(status: status),
                    ],
                  ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Icon(status.icon, size: 20, color: tone.foreground),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(_cupertinoRange(
                      appointment.startsAt,
                      appointment.endsAt,
                    ))),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${appointment.petName} · ${appointment.clinicAddress}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: CupertinoDynamicColor.resolve(
                              CupertinoColors.secondaryLabel,
                              context,
                            ),
                          ),
                ),
                const SizedBox(height: 8),
                Text(
                  status.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: CupertinoTheme.of(context).textTheme.textStyle,
                ),
              ],
            ),
          ),
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
    this.platformOverride,
  });

  final OwnerAppointment appointment;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    final status = _ownerStatusView(
      appointment.presentation,
      state: appointment.state,
      bucket: appointment.bucket,
    );
    final visual = _presentationVisual(
      status,
      Theme.of(context).colorScheme,
    );
    final date = MaterialLocalizations.of(context)
        .formatMediumDate(appointment.startsAt);
    final start = TimeOfDay.fromDateTime(appointment.startsAt).format(context);
    final end = TimeOfDay.fromDateTime(appointment.endsAt).format(context);

    return Card(
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          ownerPageRoute<void>(
            context: context,
            platform: platformOverride,
            builder: (_) => OwnerAppointmentDetailPage(
              holdId: appointment.holdId,
              initialSummary: appointment,
              repository: repository,
              alternativeSlotRepository: alternativeSlotRepository,
              platformOverride: platformOverride,
            ),
          ),
        ),
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
                status.description,
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
    this.platformOverride,
  });

  final String holdId;
  final OwnerAppointment initialSummary;
  final OwnerAppointmentsRepository repository;
  final AlternativeSlotRepository? alternativeSlotRepository;
  final TargetPlatform? platformOverride;

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
  bool _cancellationRequested = false;

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

  bool _usesCupertino(BuildContext context) {
    final themedPlatform =
        context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
    return ownerUsesCupertino(
      platform: widget.platformOverride ?? themedPlatform,
    );
  }

  Future<bool?> _confirmMaterialCancellation(
    BuildContext context,
    OwnerAppointmentDetail detail,
  ) {
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Запросить отмену?'),
        content: Text(
          '${detail.clinicName}\n${_range(context, detail.startsAt, detail.endsAt)}\n\nМенеджер поддержки свяжется с клиникой и подтвердит результат.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Назад'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Запросить отмену'),
          ),
        ],
      ),
    );
  }

  Future<bool?> _confirmCupertinoCancellation(
    BuildContext context,
    OwnerAppointmentDetail detail,
  ) {
    return showCupertinoDialog<bool>(
      context: context,
      builder: (dialogContext) => CupertinoAlertDialog(
        title: const Text('Запросить отмену?'),
        content: Text(
          '${detail.clinicName}\n${_cupertinoRange(detail.startsAt, detail.endsAt)}\n\nОтмена может требовать подтверждения клиники. Слот не освободится мгновенно.',
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Назад'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Запросить отмену'),
          ),
        ],
      ),
    );
  }

  Future<bool?> _confirmCancellation(
    OwnerAppointmentDetail detail, {
    required bool usesCupertino,
  }) {
    return usesCupertino
        ? _confirmCupertinoCancellation(context, detail)
        : _confirmMaterialCancellation(context, detail);
  }

  Future<void> _cancel(OwnerAppointmentDetail detail) async {
    final usesCupertino = _usesCupertino(context);
    final confirmed = await _confirmCancellation(
      detail,
      usesCupertino: usesCupertino,
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _cancelling = true;
    });
    try {
      await widget.repository.requestCancellation(detail.holdId);
      await _refresh();
      if (!mounted) {
        return;
      }
      setState(() {
        _cancellationRequested = true;
      });
      await HapticFeedback.mediumImpact();
      if (!usesCupertino && mounted) {
        _message(context, 'Запрос на отмену отправлен.');
      }
    } on OwnerAppointmentsApiException catch (error) {
      if (mounted) _ownerMessage(context, _cancellationError(error));
    } catch (_) {
      if (mounted) {
        _ownerMessage(context,
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
      _ownerMessage(context,
          'Экран альтернативного времени недоступен в этом запуске приложения.');
      return;
    }
    Navigator.of(context)
        .push(
          ownerPageRoute<void>(
            context: context,
            platform: widget.platformOverride,
            builder: (_) => AlternativeSlotPage(
              holdId: holdId,
              repository: repository,
            ),
          ),
        )
        .then((_) => _refresh());
  }

  Future<void> _openRoute(OwnerAppointmentDetail detail) async {
    final uri = _routeUri(detail);
    if (uri == null) {
      await Clipboard.setData(ClipboardData(text: detail.clinicAddress));
      if (mounted) {
        _ownerMessage(context, 'Адрес скопирован.');
      }
      return;
    }
    try {
      final opened = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!opened) {
        await Clipboard.setData(ClipboardData(text: detail.clinicAddress));
        if (mounted) {
          _ownerMessage(context, 'Адрес скопирован.');
        }
      }
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: detail.clinicAddress));
      if (mounted) {
        _ownerMessage(context, 'Адрес скопирован.');
      }
    }
  }

  Future<void> _callClinic(OwnerAppointmentDetail detail) async {
    final phone = detail.locationPhone?.trim();
    if (phone == null || phone.isEmpty) {
      return;
    }
    try {
      final opened = await launchUrl(
        Uri(scheme: 'tel', path: phone),
        mode: LaunchMode.externalApplication,
      );
      if (!opened) {
        await Clipboard.setData(ClipboardData(text: phone));
        if (mounted) {
          _ownerMessage(context, 'Телефон скопирован.');
        }
      }
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: phone));
      if (mounted) {
        _ownerMessage(context, 'Телефон скопирован.');
      }
    }
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
  Widget build(BuildContext context) {
    if (_usesCupertino(context)) {
      return _buildCupertino(context);
    }
    return _buildMaterial(context);
  }

  Widget _buildMaterial(BuildContext context) => Scaffold(
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
                      onOpenRoute: () => _openRoute(detail),
                      onCallClinic: () => _callClinic(detail),
                      onCancel: () => _cancel(detail),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      );

  Widget _buildCupertino(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Детали записи'),
      ),
      child: SafeArea(
        bottom: false,
        child: FutureBuilder<OwnerAppointmentDetail>(
          future: _request,
          builder: (context, snapshot) {
            final detail = snapshot.data ?? _last;
            if (snapshot.connectionState != ConnectionState.done &&
                detail == null) {
              return const Center(child: CupertinoActivityIndicator());
            }
            if (detail == null) {
              return _CupertinoAppointmentsLoadError(onRetry: _reload);
            }
            _last = detail;
            _syncPolling(detail);
            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                CupertinoSliverRefreshControl(onRefresh: _refresh),
                SliverList.list(
                  children: [
                    if (_stale || snapshot.hasError)
                      const _CupertinoStaleBanner(),
                    _CupertinoAppointmentDetailContent(
                      detail: detail,
                      cancellationRequested: _cancellationRequested,
                      cancelling: _cancelling,
                      onRefresh: _refresh,
                      onReviewAlternative: () =>
                          _openAlternative(detail.holdId),
                      onOpenRoute: () => _openRoute(detail),
                      onCallClinic: () => _callClinic(detail),
                      onCancel: () => _cancel(detail),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CupertinoAppointmentDetailContent extends StatelessWidget {
  const _CupertinoAppointmentDetailContent({
    required this.detail,
    required this.cancellationRequested,
    required this.cancelling,
    required this.onRefresh,
    required this.onReviewAlternative,
    required this.onOpenRoute,
    required this.onCallClinic,
    required this.onCancel,
  });

  final OwnerAppointmentDetail detail;
  final bool cancellationRequested;
  final bool cancelling;
  final Future<void> Function() onRefresh;
  final VoidCallback onReviewAlternative;
  final VoidCallback onOpenRoute;
  final VoidCallback onCallClinic;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final status = _ownerStatusView(
      detail.presentation,
      state: detail.state,
      bucket: detail.bucket,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CupertinoStatusHeader(detail: detail, status: status),
          if (cancellationRequested ||
              detail.state == 'CANCELLATION_REQUESTED' ||
              status.label == 'Запрошена отмена') ...[
            const SizedBox(height: 12),
            const _CupertinoCancellationNotice(),
          ],
          const SizedBox(height: 12),
          _CupertinoVisitSection(detail: detail),
          const SizedBox(height: 12),
          _CupertinoPetServiceSection(detail: detail),
          const SizedBox(height: 12),
          _CupertinoTimelineSection(timeline: detail.timeline),
          if (detail.actions.canRefresh ||
              detail.actions.canReviewAlternative ||
              detail.actions.canOpenRoute ||
              detail.actions.canRebook ||
              detail.actions.canCancel ||
              (detail.locationPhone?.trim().isNotEmpty ?? false)) ...[
            const SizedBox(height: 12),
            _CupertinoActionSections(
              detail: detail,
              cancelling: cancelling,
              onRefresh: onRefresh,
              onReviewAlternative: onReviewAlternative,
              onOpenRoute: onOpenRoute,
              onCallClinic: onCallClinic,
              onCancel: onCancel,
            ),
          ],
        ],
      ),
    );
  }
}

class _CupertinoStatusHeader extends StatelessWidget {
  const _CupertinoStatusHeader({
    required this.detail,
    required this.status,
  });

  final OwnerAppointmentDetail detail;
  final _OwnerStatusView status;

  @override
  Widget build(BuildContext context) {
    final tone = _cupertinoTone(context, status.tone);
    return Semantics(
      label:
          'Статус записи: ${status.label}. ${status.description}. Обновлено ${_cupertinoDateTime(detail.latestStatusUpdateAt)}',
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tone.background,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: tone.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(status.icon, size: 32, color: tone.foreground),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      status.label,
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .navTitleTextStyle
                          .copyWith(fontSize: 22),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                status.description,
                style: CupertinoTheme.of(context).textTheme.textStyle,
              ),
              const SizedBox(height: 8),
              Text(
                'Обновлено: ${_cupertinoDateTime(detail.latestStatusUpdateAt)}',
                style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                      color: CupertinoDynamicColor.resolve(
                        CupertinoColors.secondaryLabel,
                        context,
                      ),
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoVisitSection extends StatelessWidget {
  const _CupertinoVisitSection({required this.detail});

  final OwnerAppointmentDetail detail;

  @override
  Widget build(BuildContext context) {
    return _CupertinoGroupedSection(
      title: 'Когда и где',
      children: [
        _CupertinoInfoRow(
          icon: CupertinoIcons.calendar,
          label: 'Время визита',
          value: _cupertinoRange(detail.startsAt, detail.endsAt),
        ),
        _CupertinoInfoRow(
          icon: CupertinoIcons.building_2_fill,
          label: 'Клиника',
          value: detail.clinicName,
        ),
        _CupertinoInfoRow(
          icon: CupertinoIcons.location_solid,
          label: 'Адрес',
          value: detail.clinicAddress,
        ),
        if (detail.locationPhone != null &&
            detail.locationPhone!.trim().isNotEmpty)
          _CupertinoInfoRow(
            icon: CupertinoIcons.phone_fill,
            label: 'Телефон',
            value: detail.locationPhone!.trim(),
          ),
      ],
    );
  }
}

class _CupertinoPetServiceSection extends StatelessWidget {
  const _CupertinoPetServiceSection({required this.detail});

  final OwnerAppointmentDetail detail;

  @override
  Widget build(BuildContext context) {
    final service = detail.serviceName ?? 'Услуга не указана';
    final price = detail.priceAmount == null
        ? null
        : '${detail.priceAmount} ${detail.currency ?? ''}'.trim();
    return _CupertinoGroupedSection(
      title: 'Питомец и услуга',
      children: [
        _CupertinoInfoRow(
          icon: CupertinoIcons.heart_fill,
          label: 'Питомец',
          value: '${detail.petName} · ${_species(detail.petSpecies)}',
        ),
        _CupertinoInfoRow(
          icon: CupertinoIcons.bandage_fill,
          label: 'Услуга',
          value: price == null ? service : '$service · $price',
        ),
      ],
    );
  }
}

class _CupertinoTimelineSection extends StatelessWidget {
  const _CupertinoTimelineSection({required this.timeline});

  final List<OwnerAppointmentTimelineItem> timeline;

  @override
  Widget build(BuildContext context) {
    if (timeline.isEmpty) {
      return const _CupertinoGroupedSection(
        title: 'История статуса',
        children: [
          _CupertinoInfoRow(
            icon: CupertinoIcons.clock,
            label: 'События',
            value: 'VetHelp пока не получил событий по записи.',
          ),
        ],
      );
    }

    return _CupertinoGroupedSection(
      title: 'История статуса',
      children: [
        for (final item in timeline)
          _CupertinoInfoRow(
            icon: CupertinoIcons.check_mark_circled,
            label: _safeTimelineLabel(item.label),
            value: _cupertinoDateTime(item.at),
          ),
      ],
    );
  }
}

class _CupertinoActionSections extends StatelessWidget {
  const _CupertinoActionSections({
    required this.detail,
    required this.cancelling,
    required this.onRefresh,
    required this.onReviewAlternative,
    required this.onOpenRoute,
    required this.onCallClinic,
    required this.onCancel,
  });

  final OwnerAppointmentDetail detail;
  final bool cancelling;
  final Future<void> Function() onRefresh;
  final VoidCallback onReviewAlternative;
  final VoidCallback onOpenRoute;
  final VoidCallback onCallClinic;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final phoneAvailable =
        detail.locationPhone != null && detail.locationPhone!.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (detail.actions.canRefresh ||
            detail.actions.canReviewAlternative ||
            detail.actions.canOpenRoute ||
            phoneAvailable ||
            detail.actions.canRebook)
          _CupertinoGroupedSection(
            title: 'Действия',
            children: [
              if (detail.actions.canRefresh)
                _CupertinoActionRow(
                  icon: CupertinoIcons.refresh,
                  label: 'Обновить',
                  onPressed: () {
                    onRefresh();
                  },
                ),
              if (detail.actions.canReviewAlternative)
                _CupertinoActionRow(
                  icon: CupertinoIcons.arrow_2_squarepath,
                  label: 'Посмотреть другое время',
                  onPressed: onReviewAlternative,
                ),
              if (detail.actions.canOpenRoute)
                _CupertinoActionRow(
                  icon: CupertinoIcons.location,
                  label: 'Маршрут',
                  onPressed: onOpenRoute,
                ),
              if (phoneAvailable)
                _CupertinoActionRow(
                  icon: CupertinoIcons.phone,
                  label: 'Позвонить в клинику',
                  onPressed: onCallClinic,
                ),
              if (detail.actions.canRebook)
                _CupertinoActionRow(
                  icon: CupertinoIcons.search,
                  label: 'Записаться снова',
                  onPressed: () =>
                      Navigator.of(context).popUntil((route) => route.isFirst),
                ),
            ],
          ),
        if (detail.actions.canCancel) ...[
          const SizedBox(height: 12),
          _CupertinoGroupedSection(
            title: 'Отмена записи',
            children: [
              _CupertinoActionRow(
                icon: CupertinoIcons.xmark_circle,
                label: cancelling ? 'Отправляем запрос…' : 'Запросить отмену',
                destructive: true,
                enabled: !cancelling,
                trailing: cancelling
                    ? const CupertinoActivityIndicator()
                    : const Icon(CupertinoIcons.chevron_forward, size: 18),
                onPressed: onCancel,
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              'Отмена может требовать подтверждения клиники. Слот не освобождается мгновенно.',
              style: TextStyle(
                color: CupertinoColors.secondaryLabel,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _CupertinoGroupedSection extends StatelessWidget {
  const _CupertinoGroupedSection({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.secondarySystemGroupedBackground,
          context,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.separator,
            context,
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 18),
            ),
            const SizedBox(height: 10),
            for (var index = 0; index < children.length; index++) ...[
              if (index > 0) const _CupertinoHairline(),
              children[index],
            ],
          ],
        ),
      ),
    );
  }
}

class _CupertinoInfoRow extends StatelessWidget {
  const _CupertinoInfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 21,
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.activeBlue,
              context,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: CupertinoDynamicColor.resolve(
                              CupertinoColors.secondaryLabel,
                              context,
                            ),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: CupertinoTheme.of(context).textTheme.textStyle,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoActionRow extends StatelessWidget {
  const _CupertinoActionRow({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
    this.enabled = true,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool destructive;
  final bool enabled;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final color = destructive
        ? CupertinoDynamicColor.resolve(CupertinoColors.systemRed, context)
        : CupertinoDynamicColor.resolve(CupertinoColors.activeBlue, context);
    return Semantics(
      button: true,
      enabled: enabled,
      label: destructive ? '$label, опасное действие' : label,
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: enabled ? onPressed : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: enabled
                                ? color
                                : CupertinoDynamicColor.resolve(
                                    CupertinoColors.secondaryLabel,
                                    context,
                                  ),
                            fontWeight:
                                destructive ? FontWeight.w600 : FontWeight.w500,
                          ),
                ),
              ),
              trailing ??
                  Icon(
                    CupertinoIcons.chevron_forward,
                    size: 18,
                    color: CupertinoDynamicColor.resolve(
                      CupertinoColors.tertiaryLabel,
                      context,
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoHairline extends StatelessWidget {
  const _CupertinoHairline();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 31),
      child: ColoredBox(
        color:
            CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
        child: const SizedBox(height: 0.5, width: double.infinity),
      ),
    );
  }
}

class _CupertinoCancellationNotice extends StatelessWidget {
  const _CupertinoCancellationNotice();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label:
          'Запрос на отмену отправлен. Клиника должна подтвердить результат.',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.systemYellow.withValues(alpha: 0.16),
            context,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Padding(
          padding: EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(CupertinoIcons.info_circle),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Запрос на отмену отправлен. Клиника подтвердит итоговый статус.',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoStaleBanner extends StatelessWidget {
  const _CupertinoStaleBanner();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label:
          'Показаны последние полученные данные. Потяните экран вниз, чтобы получить актуальный статус.',
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.systemRed.withValues(alpha: 0.14),
              context,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Padding(
            padding: EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(CupertinoIcons.cloud),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Показаны последние полученные данные. Потяните вниз, чтобы обновить.',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoAppointmentsLoadError extends StatelessWidget {
  const _CupertinoAppointmentsLoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(CupertinoIcons.cloud, size: 44),
            const SizedBox(height: 12),
            Text(
              'Не удалось загрузить записи',
              textAlign: TextAlign.center,
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 22),
            ),
            const SizedBox(height: 6),
            Text(
              'Проверьте подключение и повторите попытку.',
              textAlign: TextAlign.center,
              style: CupertinoTheme.of(context).textTheme.textStyle,
            ),
            const SizedBox(height: 16),
            CupertinoButton(
              minSize: 44,
              color: CupertinoColors.activeBlue,
              borderRadius: BorderRadius.circular(14),
              onPressed: onRetry,
              child: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
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
    final status = _ownerStatusView(
      detail.presentation,
      state: detail.state,
      bucket: detail.bucket,
    );
    final visual = _presentationVisual(status, colors);
    return Card(
      color: visual.background,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(visual.icon, size: 32, color: visual.foreground),
            const SizedBox(width: 12),
            Expanded(
                child: Text(status.label,
                    style: Theme.of(context).textTheme.titleLarge)),
          ]),
          const SizedBox(height: 8),
          Text(status.description),
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
    required this.onOpenRoute,
    required this.onCallClinic,
    required this.onCancel,
  });

  final OwnerAppointmentDetail detail;
  final bool cancelling;
  final Future<void> Function() onRefresh;
  final VoidCallback onReviewAlternative;
  final VoidCallback onOpenRoute;
  final VoidCallback onCallClinic;
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
                  onPressed: onOpenRoute,
                  icon: const Icon(Icons.route_outlined),
                  label: const Text('Маршрут')),
            ],
            if (detail.locationPhone != null &&
                detail.locationPhone!.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: onCallClinic,
                icon: const Icon(Icons.call_outlined),
                label: const Text('Позвонить в клинику'),
              ),
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
                label: Text(cancelling ? 'Отправляем...' : 'Запросить отмену'),
              ),
            ],
          ]),
        ),
      );
}

class _CupertinoStatusPill extends StatelessWidget {
  const _CupertinoStatusPill({required this.status});

  final _OwnerStatusView status;

  @override
  Widget build(BuildContext context) {
    final tone = _cupertinoTone(context, status.tone);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tone.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(status.icon, size: 15, color: tone.foreground),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                status.label,
                overflow: TextOverflow.ellipsis,
                style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                      color: tone.foreground,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
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

class _OwnerStatusView {
  const _OwnerStatusView({
    required this.label,
    required this.description,
    required this.icon,
    required this.tone,
  });

  final String label;
  final String description;
  final IconData icon;
  final String tone;
}

_OwnerStatusView _ownerStatusView(
  OwnerAppointmentPresentation presentation, {
  required String state,
  required String bucket,
}) {
  final code = presentation.code;
  final normalizedState = state.toUpperCase();
  final normalizedBucket = bucket.toUpperCase();

  switch (code) {
    case 'WAITING_FOR_CLINIC':
      return const _OwnerStatusView(
        label: 'Ожидаем подтверждения',
        description: 'Клиника проверяет возможность записи.',
        icon: CupertinoIcons.hourglass,
        tone: 'info',
      );
    case 'CHECKING_AVAILABILITY':
      return const _OwnerStatusView(
        label: 'Проверяем время',
        description: 'VetHelp сверяет выбранное окно с клиникой.',
        icon: CupertinoIcons.clock,
        tone: 'info',
      );
    case 'ALTERNATIVE_TIME_REQUIRED':
      return const _OwnerStatusView(
        label: 'Нужно выбрать время',
        description: 'Клиника предложила другое доступное время.',
        icon: CupertinoIcons.arrow_2_squarepath,
        tone: 'warning',
      );
    case 'CONFIRMED_UPCOMING':
      return const _OwnerStatusView(
        label: 'Подтверждена',
        description: 'Клиника подтвердила визит.',
        icon: CupertinoIcons.check_mark_circled,
        tone: 'success',
      );
    case 'VISIT_TIME_PASSED':
      return const _OwnerStatusView(
        label: 'Время визита прошло',
        description:
            'Клиника пока не передала отметку о фактическом визите. Детали записи сохранены в истории.',
        icon: CupertinoIcons.clock,
        tone: 'neutral',
      );
    case 'NOT_CONFIRMED':
      return const _OwnerStatusView(
        label: 'Не подтверждена',
        description: 'Клиника не успела подтвердить заявку.',
        icon: CupertinoIcons.exclamationmark_triangle,
        tone: 'warning',
      );
    case 'CANCELLED':
      return const _OwnerStatusView(
        label: 'Отменена',
        description: 'Это время больше недоступно.',
        icon: CupertinoIcons.xmark_circle,
        tone: 'danger',
      );
    case 'HISTORY_RECORDED':
      return const _OwnerStatusView(
        label: 'Запись сохранена',
        description: 'Событие сохранено в истории записи.',
        icon: CupertinoIcons.archivebox,
        tone: 'neutral',
      );
    case 'STATUS_SYNCING':
      if (normalizedState == 'CANCELLATION_REQUESTED') {
        return const _OwnerStatusView(
          label: 'Запрошена отмена',
          description:
              'Менеджер поддержки свяжется с клиникой и подтвердит результат.',
          icon: CupertinoIcons.exclamationmark_circle,
          tone: 'warning',
        );
      }
      if (normalizedState == 'RESCHEDULE_REQUESTED') {
        return const _OwnerStatusView(
          label: 'Запрошен перенос',
          description: 'Клиника подберёт другое время и обновит запись.',
          icon: CupertinoIcons.arrow_2_squarepath,
          tone: 'warning',
        );
      }
      return const _OwnerStatusView(
        label: 'Проверяем статус',
        description: 'VetHelp получает актуальные данные от клиники.',
        icon: CupertinoIcons.info_circle,
        tone: 'info',
      );
  }

  if (normalizedBucket == 'HISTORY' && normalizedState == 'CONFIRMED') {
    return const _OwnerStatusView(
      label: 'Время визита прошло',
      description:
          'Клиника пока не передала отметку о фактическом визите. Детали записи сохранены в истории.',
      icon: CupertinoIcons.clock,
      tone: 'neutral',
    );
  }

  switch (normalizedState) {
    case 'MANUAL_CONFIRM_PENDING':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'WAITING_FOR_CLINIC',
          label: 'Ожидаем подтверждения',
          description: 'Клиника проверяет возможность записи.',
          tone: 'info',
        ),
        state: state,
        bucket: bucket,
      );
    case 'MIS_RESERVATION_PENDING':
    case 'MIS_RECONCILIATION_PENDING':
    case 'MIS_HELD':
    case 'PAYMENT_PENDING':
    case 'PAYMENT_IN_PROGRESS':
    case 'PAYMENT_RECONCILIATION_PENDING':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'CHECKING_AVAILABILITY',
          label: 'Проверяем время',
          description: 'VetHelp сверяет выбранное окно с клиникой.',
          tone: 'info',
        ),
        state: state,
        bucket: bucket,
      );
    case 'ALTERNATIVE_PENDING':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'ALTERNATIVE_TIME_REQUIRED',
          label: 'Нужно выбрать время',
          description: 'Клиника предложила другое доступное время.',
          tone: 'warning',
        ),
        state: state,
        bucket: bucket,
      );
    case 'CONFIRMED':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'CONFIRMED_UPCOMING',
          label: 'Подтверждена',
          description: 'Клиника подтвердила визит.',
          tone: 'success',
        ),
        state: state,
        bucket: bucket,
      );
    case 'RESCHEDULE_REQUESTED':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'STATUS_SYNCING',
          label: 'Запрошен перенос',
          description: 'Клиника подберёт другое время и обновит запись.',
          tone: 'warning',
        ),
        state: state,
        bucket: bucket,
      );
    case 'COMPLETED':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'HISTORY_RECORDED',
          label: 'Приём завершён',
          description: 'Заключение врача сохранено в истории питомца.',
          tone: 'success',
        ),
        state: state,
        bucket: bucket,
      );
    case 'CANCELLATION_REQUESTED':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'STATUS_SYNCING',
          label: 'Запрошена отмена',
          description:
              'Менеджер поддержки свяжется с клиникой и подтвердит результат.',
          tone: 'warning',
        ),
        state: state,
        bucket: bucket,
      );
    case 'SLA_BREACHED':
    case 'EXPIRED':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'NOT_CONFIRMED',
          label: 'Не подтверждена',
          description: 'Клиника не успела подтвердить заявку.',
          tone: 'warning',
        ),
        state: state,
        bucket: bucket,
      );
    case 'RELEASED':
    case 'MIS_BOOKING_FAILED':
      return _ownerStatusView(
        const OwnerAppointmentPresentation(
          code: 'CANCELLED',
          label: 'Отменена',
          description: 'Это время больше недоступно.',
          tone: 'danger',
        ),
        state: state,
        bucket: bucket,
      );
  }

  final safeLabel = _isTechnicalText(presentation.label)
      ? 'Проверяем статус'
      : presentation.label;
  final safeDescription = _isTechnicalText(presentation.description)
      ? 'VetHelp получает актуальные данные от клиники.'
      : presentation.description;
  return _OwnerStatusView(
    label: safeLabel,
    description: safeDescription,
    icon: CupertinoIcons.info_circle,
    tone: _safeTone(presentation.tone),
  );
}

_PresentationVisual _presentationVisual(
  _OwnerStatusView status,
  ColorScheme colors,
) {
  return switch (status.tone) {
    'success' => _PresentationVisual(
        label: status.label,
        icon: Icons.check_circle_outline,
        foreground: colors.primary,
        background: colors.primaryContainer,
      ),
    'warning' => _PresentationVisual(
        label: status.label,
        icon: Icons.schedule_outlined,
        foreground: colors.onSecondaryContainer,
        background: colors.secondaryContainer,
      ),
    'danger' => _PresentationVisual(
        label: status.label,
        icon: Icons.event_busy_outlined,
        foreground: colors.error,
        background: colors.errorContainer,
      ),
    'neutral' => _PresentationVisual(
        label: status.label,
        icon: Icons.history_outlined,
        foreground: colors.onSurfaceVariant,
        background: colors.surfaceContainerHigh,
      ),
    _ => _PresentationVisual(
        label: status.label,
        icon: Icons.info_outline,
        foreground: colors.primary,
        background: colors.primaryContainer,
      ),
  };
}

class _CupertinoTone {
  const _CupertinoTone({
    required this.foreground,
    required this.background,
    required this.border,
  });

  final Color foreground;
  final Color background;
  final Color border;
}

_CupertinoTone _cupertinoTone(BuildContext context, String tone) {
  final separator = CupertinoDynamicColor.resolve(
    CupertinoColors.separator,
    context,
  );
  return switch (tone) {
    'success' => _CupertinoTone(
        foreground:
            CupertinoDynamicColor.resolve(CupertinoColors.systemGreen, context),
        background: CupertinoDynamicColor.resolve(
          CupertinoColors.systemGreen.withValues(alpha: 0.14),
          context,
        ),
        border: separator,
      ),
    'warning' => _CupertinoTone(
        foreground: CupertinoDynamicColor.resolve(
            CupertinoColors.systemOrange, context),
        background: CupertinoDynamicColor.resolve(
          CupertinoColors.systemYellow.withValues(alpha: 0.18),
          context,
        ),
        border: separator,
      ),
    'danger' => _CupertinoTone(
        foreground:
            CupertinoDynamicColor.resolve(CupertinoColors.systemRed, context),
        background: CupertinoDynamicColor.resolve(
          CupertinoColors.systemRed.withValues(alpha: 0.13),
          context,
        ),
        border: separator,
      ),
    'neutral' => _CupertinoTone(
        foreground: CupertinoDynamicColor.resolve(
          CupertinoColors.secondaryLabel,
          context,
        ),
        background: CupertinoDynamicColor.resolve(
          CupertinoColors.tertiarySystemFill,
          context,
        ),
        border: separator,
      ),
    _ => _CupertinoTone(
        foreground:
            CupertinoDynamicColor.resolve(CupertinoColors.activeBlue, context),
        background: CupertinoDynamicColor.resolve(
          CupertinoColors.activeBlue.withValues(alpha: 0.12),
          context,
        ),
        border: separator,
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

bool _isTechnicalText(String value) {
  final text = value.trim();
  if (text.isEmpty) return true;
  return RegExp(r'\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b').hasMatch(text) ||
      RegExp(r'\b[45]\d\d\b').hasMatch(text) ||
      text.toLowerCase().contains('snapshot');
}

String _safeTone(String tone) => switch (tone) {
      'success' || 'warning' || 'danger' || 'neutral' || 'info' => tone,
      _ => 'info',
    };

String _safeTimelineLabel(String value) {
  if (_isTechnicalText(value)) return 'Статус обновлён';
  return value;
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

String _cupertinoDateTime(DateTime value) {
  final local = value.toLocal();
  return '${_cupertinoDate(local)}, ${_cupertinoTime(local)}';
}

String _cupertinoRange(DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  return '${_cupertinoDate(first)} · ${_cupertinoTime(first)}–${_cupertinoTime(last)}';
}

String _cupertinoDate(DateTime value) {
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
}

String _cupertinoTime(DateTime value) {
  return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}

Uri? _routeUri(OwnerAppointmentDetail detail) {
  final latitude = detail.locationLatitude;
  final longitude = detail.locationLongitude;
  if (latitude != null && longitude != null) {
    return Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': '$latitude,$longitude',
    });
  }
  final address = detail.clinicAddress.trim();
  if (address.isEmpty) return null;
  return Uri.https('www.google.com', '/maps/search/', {
    'api': '1',
    'query': address,
  });
}

void _message(BuildContext context, String text) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

void _ownerMessage(BuildContext context, String text) {
  final inCupertinoFlow =
      context.findAncestorWidgetOfExactType<CupertinoPageScaffold>() != null ||
          context.findAncestorWidgetOfExactType<CupertinoApp>() != null;
  if (!inCupertinoFlow) {
    _message(context, text);
    return;
  }
  showCupertinoDialog<void>(
    context: context,
    builder: (dialogContext) => CupertinoAlertDialog(
      title: const Text('VetHelp'),
      content: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(text),
      ),
      actions: [
        CupertinoDialogAction(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: const Text('Понятно'),
        ),
      ],
    ),
  );
}

String _cancellationError(OwnerAppointmentsApiException error) =>
    switch (error.code) {
      'HOLD_EXPIRED' => 'Заявка уже истекла. Обновите детали записи.',
      'INVALID_TRANSITION' ||
      'INVALID_STATE_TRANSITION' =>
        'Эту запись уже нельзя отменить.',
      'SLOT_LOCKED_RETRY' =>
        'Клиника обновляет слот. Повторите отмену через несколько секунд.',
      'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
      _ => 'Не удалось отправить запрос отмены. Повторите попытку.',
    };
