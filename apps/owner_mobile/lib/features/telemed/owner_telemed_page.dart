import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../presentation/platform/owner_platform.dart';
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
    this.onRequestEmergency,
    this.onBrowseClinics,
    this.platformOverride,
  });

  final OwnerTelemedRepository repository;
  final TelemedWaitingRepository waitingRepository;
  final TelemedRoomAccessRepository roomAccessRepository;

  /// Kept temporarily for call-site compatibility. Telemedicine intake is not
  /// now opens the safety intake instead of directly entering payment/queue.
  final VoidCallback? onCreateConsultation;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;
  final TargetPlatform? platformOverride;

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

  Future<void> _openWaitingRoom(OwnerTelemedSession session) async {
    if (session.bucket != 'ACTIVE') return;
    await Navigator.of(context).push(ownerPageRoute<void>(
      context: context,
      platform: widget.platformOverride,
      builder: (_) => TelemedWaitingRoomPage(
        sessionId: session.sessionId,
        repository: widget.waitingRepository,
        roomAccessRepository: widget.roomAccessRepository,
        onBrowseClinics: widget.onBrowseClinics,
        platformOverride: widget.platformOverride,
      ),
    ));
    if (mounted) _reload();
  }

  void _openConsultationAvailability() {
    Navigator.of(context).push(ownerPageRoute<void>(
      context: context,
      platform: widget.platformOverride,
      builder: (_) => _TelemedIntakePage(
        repository: widget.repository,
        onRequestEmergency: widget.onRequestEmergency,
        onBrowseClinics: widget.onBrowseClinics,
        platformOverride: widget.platformOverride,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_usesCupertino(context)) {
      return _buildCupertino(context);
    }
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
                        onBrowseClinics: widget.onBrowseClinics,
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

  bool _usesCupertino(BuildContext context) {
    final themedPlatform =
        context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
    return ownerUsesCupertino(
      platform: widget.platformOverride ?? themedPlatform,
    );
  }

  Widget _buildCupertino(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Онлайн-консультации'),
      ),
      child: SafeArea(
        bottom: false,
        child: FutureBuilder<List<OwnerTelemedSession>>(
          future: _request,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CupertinoActivityIndicator());
            }
            if (snapshot.hasError) {
              return _CupertinoTelemedError(onRetry: _reload);
            }

            final rows = snapshot.data ?? const <OwnerTelemedSession>[];
            final active = rows
                .where((session) => session.bucket == 'ACTIVE')
                .toList(growable: false);
            final history = rows
                .where((session) => session.bucket != 'ACTIVE')
                .toList(growable: false);

            return CustomScrollView(
              slivers: [
                CupertinoSliverRefreshControl(onRefresh: _refresh),
                SliverList(
                  delegate: SliverChildListDelegate([
                    const SizedBox(height: 12),
                    _CupertinoTelemedSafetyPanel(
                      onEmergency: widget.onRequestEmergency,
                      onBrowseClinics: widget.onBrowseClinics,
                    ),
                    CupertinoListSection.insetGrouped(
                      header: const Text('Активные'),
                      children: active.isEmpty
                          ? [
                              _CupertinoTelemedEmptyRow(
                                title: 'Нет активных консультаций',
                                text:
                                    'Онлайн-консультация появится здесь после проверки безопасности и подтверждения backend.',
                                actionLabel: 'Проверить онлайн-консультацию',
                                onAction: _openConsultationAvailability,
                              ),
                            ]
                          : [
                              for (final session in active)
                                _CupertinoTelemedSessionTile(
                                  session: session,
                                  active: true,
                                  onOpen: () => _openWaitingRoom(session),
                                  onBrowseClinics: widget.onBrowseClinics,
                                  onEmergency: widget.onRequestEmergency,
                                ),
                            ],
                    ),
                    CupertinoListSection.insetGrouped(
                      header: const Text('История'),
                      children: history.isEmpty
                          ? const [
                              _CupertinoTelemedEmptyRow(
                                title: 'История консультаций пуста',
                                text:
                                    'Завершённые и отменённые консультации появятся здесь.',
                              ),
                            ]
                          : [
                              for (final session in history)
                                _CupertinoTelemedSessionTile(
                                  session: session,
                                  active: false,
                                  onBrowseClinics: widget.onBrowseClinics,
                                  onEmergency: widget.onRequestEmergency,
                                ),
                            ],
                    ),
                    const SizedBox(height: 24),
                  ]),
                ),
              ],
            );
          },
        ),
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
    this.onBrowseClinics,
  });

  final List<OwnerTelemedSession> rows;
  final String emptyTitle;
  final String emptyText;
  final Future<void> Function() onRefresh;
  final ValueChanged<OwnerTelemedSession>? onOpen;
  final VoidCallback? onCreateConsultation;
  final VoidCallback? onBrowseClinics;

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
          onBrowseClinics: onBrowseClinics,
        ),
      ),
    );
  }
}

class _TelemedSessionCard extends StatelessWidget {
  const _TelemedSessionCard({
    required this.session,
    this.onOpen,
    this.onBrowseClinics,
  });

  final OwnerTelemedSession session;
  final VoidCallback? onOpen;
  final VoidCallback? onBrowseClinics;

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
              if (session.refundState != null) ...[
                const SizedBox(height: 8),
                Text(
                  _paymentActionLabel(session.refundState!),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.onSurfaceVariant,
                      ),
                ),
              ],
              if (session.state == 'WAITING_FOR_DOCTOR') ...[
                const SizedBox(height: 8),
                Text(
                  'Врач должен подключиться до ${_dateTime(context, session.doctorJoinDeadlineAt)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              if (session.recommendationText != null) ...[
                const SizedBox(height: 12),
                _TelemedResultBlock(
                  icon: Icons.fact_check_outlined,
                  title: 'Рекомендация врача',
                  text: session.recommendationText!,
                ),
              ],
              if (session.followUpNotes != null) ...[
                const SizedBox(height: 12),
                _TelemedResultBlock(
                  icon: Icons.event_available_outlined,
                  title: 'Следующий шаг',
                  text: session.followUpNotes!,
                ),
              ],
              if (session.safetyEscalation == true) ...[
                const SizedBox(height: 12),
                _TelemedResultBlock(
                  icon: Icons.local_hospital_outlined,
                  title: 'Нужен очный осмотр',
                  text:
                      'Врач отметил, что безопаснее продолжить помощь в клинике.',
                ),
              ],
              if ((session.followUpNotes != null ||
                      session.safetyEscalation == true) &&
                  onBrowseClinics != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onBrowseClinics,
                  icon: const Icon(Icons.local_hospital_outlined),
                  label: const Text('Выбрать клинику'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TelemedResultBlock extends StatelessWidget {
  const _TelemedResultBlock({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: theme.colorScheme.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.labelLarge),
              const SizedBox(height: 4),
              Text(text, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

class _CupertinoTelemedSafetyPanel extends StatelessWidget {
  const _CupertinoTelemedSafetyPanel({
    this.onEmergency,
    this.onBrowseClinics,
  });

  final VoidCallback? onEmergency;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Semantics(
        liveRegion: true,
        label:
            'Важно. При ухудшении состояния не ждите онлайн-ответа. Можно открыть срочные клиники или каталог клиник.',
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.systemRed.withValues(alpha: 0.14),
              context,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.systemRed,
                context,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      CupertinoIcons.exclamationmark_triangle_fill,
                      color: CupertinoDynamicColor.resolve(
                        CupertinoColors.systemRed,
                        context,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'При ухудшении состояния не ждите онлайн-ответа.',
                      ),
                    ),
                  ],
                ),
                if (onEmergency != null || onBrowseClinics != null) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (onEmergency != null)
                        CupertinoButton(
                          minSize: 44,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          color: CupertinoColors.systemRed,
                          borderRadius: BorderRadius.circular(999),
                          onPressed: onEmergency,
                          child: const Text(
                            'Срочные клиники',
                            style: TextStyle(color: CupertinoColors.white),
                          ),
                        ),
                      if (onBrowseClinics != null)
                        CupertinoButton(
                          minSize: 44,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          color: CupertinoDynamicColor.resolve(
                            CupertinoColors.tertiarySystemFill,
                            context,
                          ),
                          borderRadius: BorderRadius.circular(999),
                          onPressed: onBrowseClinics,
                          child: const Text('Каталог клиник'),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoTelemedEmptyRow extends StatelessWidget {
  const _CupertinoTelemedEmptyRow({
    required this.title,
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: CupertinoTheme.of(context)
                .textTheme
                .navTitleTextStyle
                .copyWith(fontSize: 18),
          ),
          const SizedBox(height: 6),
          Text(text),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 12),
            CupertinoButton.filled(
              minSize: 44,
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class _CupertinoTelemedSessionTile extends StatelessWidget {
  const _CupertinoTelemedSessionTile({
    required this.session,
    required this.active,
    this.onOpen,
    this.onBrowseClinics,
    this.onEmergency,
  });

  final OwnerTelemedSession session;
  final bool active;
  final VoidCallback? onOpen;
  final VoidCallback? onBrowseClinics;
  final VoidCallback? onEmergency;

  @override
  Widget build(BuildContext context) {
    final presentation = _telemedPresentation(session.state);
    final warning = session.safetyEscalation == true;
    final paymentCopy = _paymentActionCopy(session.refundState);
    return CupertinoListTile.notched(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      leading: Semantics(
        label: presentation.label,
        child: Icon(
          presentation.cupertinoIcon,
          color: CupertinoDynamicColor.resolve(presentation.color, context),
        ),
      ),
      title: Text(presentation.label),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                _safeTelemedText(session.serviceName ?? 'Онлайн-консультация')),
            const SizedBox(height: 3),
            Text('${session.petName} · ${session.clinicName}'),
            const SizedBox(height: 3),
            Text(_cupertinoRange(session.startsAt, session.endsAt)),
            if (presentation.description != null) ...[
              const SizedBox(height: 6),
              Text(presentation.description!),
            ],
            if (active && session.state == 'WAITING_FOR_DOCTOR') ...[
              const SizedBox(height: 6),
              Text(
                'Следующее действие: оставайтесь на экране и проверяйте статус. Дедлайн подключения врача: ${_cupertinoDateTime(session.doctorJoinDeadlineAt)}.',
              ),
            ],
            if (paymentCopy != null) ...[
              const SizedBox(height: 6),
              Text(paymentCopy),
            ],
            if (session.recommendationText != null) ...[
              const SizedBox(height: 8),
              _CupertinoInlineTelemedBlock(
                title: 'Рекомендация врача',
                text: _safeTelemedText(session.recommendationText!),
              ),
            ],
            if (session.followUpNotes != null) ...[
              const SizedBox(height: 8),
              _CupertinoInlineTelemedBlock(
                title: 'Следующий шаг',
                text: _safeTelemedText(session.followUpNotes!),
              ),
            ],
            if (warning) ...[
              const SizedBox(height: 8),
              _CupertinoInlineTelemedBlock(
                title: 'Нужен очный осмотр',
                text:
                    'Врач отметил, что безопаснее продолжить помощь в клинике.',
                warning: true,
              ),
            ],
            if ((warning || session.followUpNotes != null) &&
                onBrowseClinics != null) ...[
              const SizedBox(height: 10),
              CupertinoButton(
                minSize: 44,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.tertiarySystemFill,
                  context,
                ),
                borderRadius: BorderRadius.circular(12),
                onPressed: onBrowseClinics,
                child: const Text('Выбрать клинику'),
              ),
            ],
            if (warning && onEmergency != null) ...[
              const SizedBox(height: 8),
              CupertinoButton(
                minSize: 44,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                color: CupertinoColors.systemRed,
                borderRadius: BorderRadius.circular(12),
                onPressed: onEmergency,
                child: const Text(
                  'Срочные клиники',
                  style: TextStyle(color: CupertinoColors.white),
                ),
              ),
            ],
          ],
        ),
      ),
      trailing:
          active && onOpen != null ? const CupertinoListTileChevron() : null,
      onTap: active ? onOpen : null,
    );
  }
}

class _CupertinoInlineTelemedBlock extends StatelessWidget {
  const _CupertinoInlineTelemedBlock({
    required this.title,
    required this.text,
    this.warning = false,
  });

  final String title;
  final String text;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    final color = warning
        ? CupertinoDynamicColor.resolve(CupertinoColors.systemRed, context)
        : CupertinoDynamicColor.resolve(CupertinoColors.activeBlue, context);
    return Semantics(
      liveRegion: warning,
      label: '$title. $text',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            warning
                ? CupertinoIcons.exclamationmark_triangle_fill
                : CupertinoIcons.info_circle,
            color: color,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: CupertinoTheme.of(context)
                      .textTheme
                      .textStyle
                      .copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(text),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TelemedIntakePage extends StatefulWidget {
  const _TelemedIntakePage({
    required this.repository,
    this.onRequestEmergency,
    this.onBrowseClinics,
    this.platformOverride,
  });

  final OwnerTelemedRepository repository;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;
  final TargetPlatform? platformOverride;

  @override
  State<_TelemedIntakePage> createState() => _TelemedIntakePageState();
}

class _TelemedIntakePageState extends State<_TelemedIntakePage> {
  static const _consentVersion = 'owner-mobile-telemed-v1';
  static const _space = 16.0;
  static const _spaceSmall = 8.0;

  late Future<List<TelemedPet>> _petsRequest;
  String? _petId;
  String _category = 'SKIN_EAR_EYE';
  String _duration = 'ONE_TO_THREE_DAYS';
  bool _priorClinicVisit = false;
  bool _consent = false;
  bool _loading = false;
  bool _paymentLoading = false;
  String? _error;
  String? _paymentError;
  TelemedIntakeResult? _result;
  TelemedPaymentIntent? _paymentIntent;

  final Set<String> _redFlags = <String>{};

  @override
  void initState() {
    super.initState();
    _reloadPets();
  }

  void _reloadPets() {
    _petsRequest = _loadPets();
  }

  Future<List<TelemedPet>> _loadPets() async {
    final pets = await widget.repository.listPets();
    if (mounted && pets.isNotEmpty && _petId == null) {
      setState(() {
        _petId = pets.first.id;
      });
    }
    return pets;
  }

  Future<void> _submit() async {
    final petId = _petId;
    if (petId == null || !_consent || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.repository.createIntake(
        TelemedIntakeInput(
          petId: petId,
          category: _category,
          symptomDuration: _duration,
          priorClinicVisit: _priorClinicVisit,
          emergencyRedFlags: _redFlags.toList(growable: false),
          consentVersion: _consentVersion,
        ),
      );
      if (!mounted) return;
      setState(() {
        _result = result;
      });
    } on OwnerTelemedApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _intakeError(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось проверить, подходит ли онлайн-консультация.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _openEmergency() {
    Navigator.of(context).pop();
    widget.onRequestEmergency?.call();
  }

  void _openClinics() {
    Navigator.of(context).pop();
    widget.onBrowseClinics?.call();
  }

  Future<void> _createPaymentIntent() async {
    final result = _result;
    if (result == null || _paymentLoading) return;
    setState(() {
      _paymentLoading = true;
      _paymentError = null;
    });
    try {
      final intent =
          await widget.repository.createPaymentIntent(result.intakeId);
      if (!mounted) return;
      setState(() {
        _paymentIntent = intent;
      });
      final checkoutUrl = intent.checkoutUrl;
      if (checkoutUrl != null && checkoutUrl.isNotEmpty) {
        final launched = await launchUrl(
          Uri.parse(checkoutUrl),
          mode: LaunchMode.externalApplication,
        );
        if (!launched && mounted) {
          setState(() {
            _paymentError = 'Checkout создан, но не удалось открыть ссылку.';
          });
        }
      }
    } on OwnerTelemedApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _paymentError = _paymentErrorFor(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _paymentError = 'Не удалось открыть оплату онлайн-консультации.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _paymentLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_usesCupertino(context)) {
      return _buildCupertino(context);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Онлайн-консультация')),
      body: SafeArea(
        child: _buildBody(
          context,
          loading: const Center(child: CircularProgressIndicator()),
          errorBuilder: (onRetry) => _TelemedIntakeError(onRetry: onRetry),
          emptyPets: const _TelemedNoPets(),
          formBuilder: _materialForm,
          resultBuilder: _materialResult,
        ),
      ),
    );
  }

  bool _usesCupertino(BuildContext context) {
    final themedPlatform =
        context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
    return ownerUsesCupertino(
      platform: widget.platformOverride ?? themedPlatform,
    );
  }

  Widget _buildCupertino(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Онлайн-консультация'),
      ),
      child: SafeArea(
        bottom: false,
        child: _buildBody(
          context,
          loading: const Center(child: CupertinoActivityIndicator()),
          errorBuilder: (onRetry) =>
              _CupertinoTelemedIntakeError(onRetry: onRetry),
          emptyPets: const _CupertinoTelemedNoPets(),
          formBuilder: _cupertinoForm,
          resultBuilder: _cupertinoResult,
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context, {
    required Widget loading,
    required Widget Function(VoidCallback onRetry) errorBuilder,
    required Widget emptyPets,
    required Widget Function(List<TelemedPet> pets) formBuilder,
    required Widget Function(TelemedIntakeResult result) resultBuilder,
  }) {
    return FutureBuilder<List<TelemedPet>>(
      future: _petsRequest,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return loading;
        }
        if (snapshot.hasError) {
          return errorBuilder(() {
            setState(() {
              _error = null;
              _reloadPets();
            });
          });
        }
        final pets = snapshot.data ?? const <TelemedPet>[];
        if (pets.isEmpty) return emptyPets;
        final result = _result;
        if (result != null) return resultBuilder(result);
        return formBuilder(pets);
      },
    );
  }

  Widget _materialForm(List<TelemedPet> pets) {
    return _TelemedIntakeForm(
      pets: pets,
      selectedPetId: _petId,
      category: _category,
      duration: _duration,
      priorClinicVisit: _priorClinicVisit,
      consent: _consent,
      loading: _loading,
      error: _error,
      redFlags: _redFlags,
      onPetChanged: (value) => setState(() => _petId = value),
      onCategoryChanged: (value) => setState(() => _category = value),
      onDurationChanged: (value) => setState(() => _duration = value),
      onPriorClinicVisitChanged: (value) =>
          setState(() => _priorClinicVisit = value),
      onConsentChanged: (value) => setState(() => _consent = value),
      onRedFlagsChanged: _replaceRedFlags,
      onSubmit: _submit,
    );
  }

  Widget _cupertinoForm(List<TelemedPet> pets) {
    return _CupertinoTelemedIntakeForm(
      pets: pets,
      selectedPetId: _petId,
      category: _category,
      duration: _duration,
      priorClinicVisit: _priorClinicVisit,
      consent: _consent,
      loading: _loading,
      error: _error,
      redFlags: _redFlags,
      onPetChanged: (value) => setState(() => _petId = value),
      onCategoryChanged: (value) => setState(() => _category = value),
      onDurationChanged: (value) => setState(() => _duration = value),
      onPriorClinicVisitChanged: (value) =>
          setState(() => _priorClinicVisit = value),
      onConsentChanged: (value) => setState(() => _consent = value),
      onRedFlagsChanged: _replaceRedFlags,
      onSubmit: _submit,
      onOpenEmergency:
          widget.onRequestEmergency == null ? null : _openEmergency,
      onBrowseClinics: widget.onBrowseClinics == null ? null : _openClinics,
    );
  }

  Widget _materialResult(TelemedIntakeResult result) {
    return _TelemedIntakeResultView(
      result: result,
      onRequestEmergency:
          widget.onRequestEmergency == null ? null : _openEmergency,
      onBrowseClinics: widget.onBrowseClinics == null ? null : _openClinics,
      onBack: () => Navigator.of(context).pop(),
      paymentIntent: _paymentIntent,
      paymentLoading: _paymentLoading,
      paymentError: _paymentError,
      onCreatePayment: result.routingTarget == 'TELEMED_PAYMENT_QUEUE'
          ? _createPaymentIntent
          : null,
    );
  }

  Widget _cupertinoResult(TelemedIntakeResult result) {
    return _CupertinoTelemedIntakeResultView(
      result: result,
      onRequestEmergency:
          widget.onRequestEmergency == null ? null : _openEmergency,
      onBrowseClinics: widget.onBrowseClinics == null ? null : _openClinics,
      onBack: () => Navigator.of(context).pop(),
      paymentIntent: _paymentIntent,
      paymentLoading: _paymentLoading,
      paymentError: _paymentError,
      onCreatePayment: result.routingTarget == 'TELEMED_PAYMENT_QUEUE'
          ? _createPaymentIntent
          : null,
    );
  }

  void _replaceRedFlags(Set<String> value) {
    setState(() {
      _redFlags
        ..clear()
        ..addAll(value);
    });
  }
}

class _TelemedIntakeForm extends StatelessWidget {
  const _TelemedIntakeForm({
    required this.pets,
    required this.selectedPetId,
    required this.category,
    required this.duration,
    required this.priorClinicVisit,
    required this.consent,
    required this.loading,
    required this.error,
    required this.redFlags,
    required this.onPetChanged,
    required this.onCategoryChanged,
    required this.onDurationChanged,
    required this.onPriorClinicVisitChanged,
    required this.onConsentChanged,
    required this.onRedFlagsChanged,
    required this.onSubmit,
  });

  final List<TelemedPet> pets;
  final String? selectedPetId;
  final String category;
  final String duration;
  final bool priorClinicVisit;
  final bool consent;
  final bool loading;
  final String? error;
  final Set<String> redFlags;
  final ValueChanged<String?> onPetChanged;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onDurationChanged;
  final ValueChanged<bool> onPriorClinicVisitChanged;
  final ValueChanged<bool> onConsentChanged;
  final ValueChanged<Set<String>> onRedFlagsChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(_TelemedIntakePageState._space),
      children: [
        Text('Сначала проверим безопасность',
            style: theme.textTheme.titleLarge),
        const SizedBox(height: _TelemedIntakePageState._spaceSmall),
        const Text(
          'Онлайн-консультация не используется при срочных симптомах и не заменяет очный осмотр.',
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: selectedPetId,
          decoration: const InputDecoration(labelText: 'Питомец'),
          items: [
            for (final pet in pets)
              DropdownMenuItem(
                value: pet.id,
                child: Text('${pet.name} · ${_speciesLabel(pet.species)}'),
              ),
          ],
          onChanged: loading ? null : onPetChanged,
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: category,
          decoration: const InputDecoration(labelText: 'Тема вопроса'),
          items: [
            for (final option in _telemedCategories)
              DropdownMenuItem(value: option.code, child: Text(option.label)),
          ],
          onChanged: loading || selectedPetId == null
              ? null
              : (value) => onCategoryChanged(value ?? category),
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: duration,
          decoration: const InputDecoration(labelText: 'Как давно'),
          items: const [
            DropdownMenuItem(
                value: 'NO_SYMPTOMS', child: Text('Нет симптомов')),
            DropdownMenuItem(
                value: 'LESS_THAN_24H', child: Text('Меньше 24 часов')),
            DropdownMenuItem(
                value: 'ONE_TO_THREE_DAYS', child: Text('1-3 дня')),
            DropdownMenuItem(
                value: 'MORE_THAN_THREE_DAYS', child: Text('Больше 3 дней')),
          ],
          onChanged:
              loading ? null : (value) => onDurationChanged(value ?? duration),
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        Text('Есть срочные признаки?', style: theme.textTheme.titleMedium),
        const SizedBox(height: _TelemedIntakePageState._spaceSmall),
        _TelemedRedFlagChips(
          selected: redFlags,
          enabled: !loading,
          onChanged: onRedFlagsChanged,
        ),
        const SizedBox(height: _TelemedIntakePageState._spaceSmall),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: priorClinicVisit,
          onChanged: loading ? null : onPriorClinicVisitChanged,
          title: const Text('Уже были в клинике по этому вопросу'),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: consent,
          onChanged:
              loading ? null : (value) => onConsentChanged(value == true),
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text(
            'Понимаю ограничения: это не экстренная помощь, не диагноз, не рецепт и не страховое решение.',
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: _TelemedIntakePageState._spaceSmall),
          Text(
            error!,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.error),
          ),
        ],
        const SizedBox(height: _TelemedIntakePageState._space),
        FilledButton.icon(
          onPressed:
              consent && selectedPetId != null && !loading ? onSubmit : null,
          icon: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.health_and_safety_outlined),
          label: Text(loading ? 'Проверяем' : 'Проверить возможность онлайн'),
        ),
      ],
    );
  }
}

class _CupertinoTelemedIntakeForm extends StatelessWidget {
  const _CupertinoTelemedIntakeForm({
    required this.pets,
    required this.selectedPetId,
    required this.category,
    required this.duration,
    required this.priorClinicVisit,
    required this.consent,
    required this.loading,
    required this.error,
    required this.redFlags,
    required this.onPetChanged,
    required this.onCategoryChanged,
    required this.onDurationChanged,
    required this.onPriorClinicVisitChanged,
    required this.onConsentChanged,
    required this.onRedFlagsChanged,
    required this.onSubmit,
    this.onOpenEmergency,
    this.onBrowseClinics,
  });

  final List<TelemedPet> pets;
  final String? selectedPetId;
  final String category;
  final String duration;
  final bool priorClinicVisit;
  final bool consent;
  final bool loading;
  final String? error;
  final Set<String> redFlags;
  final ValueChanged<String?> onPetChanged;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onDurationChanged;
  final ValueChanged<bool> onPriorClinicVisitChanged;
  final ValueChanged<bool> onConsentChanged;
  final ValueChanged<Set<String>> onRedFlagsChanged;
  final VoidCallback onSubmit;
  final VoidCallback? onOpenEmergency;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    final pet = _selectedPet(pets, selectedPetId);
    return ListView(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 28),
      children: [
        const _CupertinoTelemedSafetyPanel(),
        CupertinoListSection.insetGrouped(
          header: const Text('Проверка безопасности'),
          footer: const Text(
            'Онлайн-консультация не заменяет срочную помощь, очный осмотр, диагноз, рецепт или страховое решение.',
          ),
          children: [
            _CupertinoPickerTile(
              label: 'Питомец',
              value: pet == null
                  ? 'Выберите питомца'
                  : '${pet.name} · ${_speciesLabel(pet.species)}',
              enabled: !loading,
              onTap: () => _showPetSheet(context),
            ),
            _CupertinoPickerTile(
              label: 'Тема вопроса',
              value: _optionLabel(_telemedCategories, category),
              enabled: !loading && selectedPetId != null,
              onTap: () => _showOptionSheet(
                context,
                title: 'Тема вопроса',
                options: _telemedCategories,
                selected: category,
                onSelected: onCategoryChanged,
              ),
            ),
            _CupertinoPickerTile(
              label: 'Как давно',
              value: _durationLabel(duration),
              enabled: !loading,
              onTap: () => _showDurationSheet(context),
            ),
            _CupertinoSwitchTile(
              label: 'Уже были в клинике',
              value: priorClinicVisit,
              enabled: !loading,
              onChanged: onPriorClinicVisitChanged,
            ),
          ],
        ),
        CupertinoListSection.insetGrouped(
          header: const Text('Срочные признаки'),
          footer: redFlags.isEmpty
              ? const Text('Если есть тяжёлые признаки, лучше не ждать онлайн.')
              : const Text(
                  'Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.',
                ),
          children: [
            for (final option in _telemedRedFlags)
              _CupertinoTelemedToggleRow(
                label: option.label,
                selected: redFlags.contains(option.code),
                enabled: !loading,
                warning: true,
                onChanged: (value) {
                  final next = Set<String>.from(redFlags);
                  value ? next.add(option.code) : next.remove(option.code);
                  onRedFlagsChanged(next);
                },
              ),
          ],
        ),
        CupertinoListSection.insetGrouped(
          header: const Text('Согласие'),
          children: [
            Semantics(
              label:
                  'Согласие на ограничения онлайн-консультации. Это не экстренная помощь, не диагноз, не рецепт и не страховое решение.',
              toggled: consent,
              child: _CupertinoSwitchTile(
                label:
                    'Понимаю ограничения онлайн-консультации и хочу продолжить',
                value: consent,
                enabled: !loading,
                onChanged: onConsentChanged,
              ),
            ),
          ],
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Semantics(
              liveRegion: true,
              child: Text(
                _safeTelemedText(error!),
                style: TextStyle(
                  color: CupertinoDynamicColor.resolve(
                    CupertinoColors.systemRed,
                    context,
                  ),
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: CupertinoButton.filled(
            minSize: 52,
            onPressed:
                consent && selectedPetId != null && !loading ? onSubmit : null,
            child: loading
                ? const CupertinoActivityIndicator(color: CupertinoColors.white)
                : const Text('Проверить возможность онлайн'),
          ),
        ),
        if (onOpenEmergency != null || onBrowseClinics != null) ...[
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                if (onOpenEmergency != null)
                  Expanded(
                    child: CupertinoButton(
                      minSize: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      color: CupertinoColors.systemRed,
                      borderRadius: BorderRadius.circular(14),
                      onPressed: loading ? null : onOpenEmergency,
                      child: const Text(
                        'Срочно',
                        style: TextStyle(color: CupertinoColors.white),
                      ),
                    ),
                  ),
                if (onOpenEmergency != null && onBrowseClinics != null)
                  const SizedBox(width: 8),
                if (onBrowseClinics != null)
                  Expanded(
                    child: CupertinoButton(
                      minSize: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      color: CupertinoDynamicColor.resolve(
                        CupertinoColors.tertiarySystemFill,
                        context,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      onPressed: loading ? null : onBrowseClinics,
                      child: const Text('Клиники'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  void _showPetSheet(BuildContext context) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (context) => CupertinoActionSheet(
        title: const Text('Питомец'),
        actions: [
          for (final pet in pets)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.of(context).pop();
                onPetChanged(pet.id);
              },
              child: Text('${pet.name} · ${_speciesLabel(pet.species)}'),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
      ),
    );
  }

  void _showOptionSheet(
    BuildContext context, {
    required String title,
    required List<_TelemedOption> options,
    required String selected,
    required ValueChanged<String> onSelected,
  }) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (context) => CupertinoActionSheet(
        title: Text(title),
        actions: [
          for (final option in options)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.of(context).pop();
                onSelected(option.code);
              },
              child: Text(option.label),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
      ),
    );
  }

  void _showDurationSheet(BuildContext context) {
    showCupertinoModalPopup<void>(
      context: context,
      builder: (context) => CupertinoActionSheet(
        title: const Text('Как давно'),
        actions: [
          for (final option in _durationOptions.entries)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.of(context).pop();
                onDurationChanged(option.key);
              },
              child: Text(option.value),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Отмена'),
        ),
      ),
    );
  }
}

class _CupertinoPickerTile extends StatelessWidget {
  const _CupertinoPickerTile({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final String value;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return CupertinoListTile.notched(
      title: Text(label),
      subtitle: Text(value),
      trailing: const CupertinoListTileChevron(),
      onTap: enabled ? onTap : null,
    );
  }
}

class _CupertinoSwitchTile extends StatelessWidget {
  const _CupertinoSwitchTile({
    required this.label,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return CupertinoListTile.notched(
      title: Text(label),
      trailing: CupertinoSwitch(
        value: value,
        onChanged: enabled ? onChanged : null,
      ),
      onTap: enabled ? () => onChanged(!value) : null,
    );
  }
}

class _CupertinoTelemedToggleRow extends StatelessWidget {
  const _CupertinoTelemedToggleRow({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.warning,
    required this.onChanged,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final bool warning;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      toggled: selected,
      enabled: enabled,
      label: label,
      child: CupertinoListTile.notched(
        leading: Icon(
          warning
              ? CupertinoIcons.exclamationmark_triangle
              : CupertinoIcons.circle,
          color: CupertinoDynamicColor.resolve(
            warning ? CupertinoColors.systemRed : CupertinoColors.activeBlue,
            context,
          ),
        ),
        title: Text(label),
        trailing: Icon(
          selected
              ? CupertinoIcons.check_mark_circled_solid
              : CupertinoIcons.circle,
          color: selected
              ? CupertinoColors.activeBlue
              : CupertinoDynamicColor.resolve(
                  CupertinoColors.tertiaryLabel,
                  context,
                ),
        ),
        onTap: enabled ? () => onChanged(!selected) : null,
      ),
    );
  }
}

class _TelemedRedFlagChips extends StatelessWidget {
  const _TelemedRedFlagChips({
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final Set<String> selected;
  final bool enabled;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final option in _telemedRedFlags)
            FilterChip(
              avatar: Icon(option.icon, size: 18),
              label: Text(option.label),
              selected: selected.contains(option.code),
              onSelected: enabled
                  ? (value) {
                      final next = Set<String>.from(selected);
                      value ? next.add(option.code) : next.remove(option.code);
                      onChanged(next);
                    }
                  : null,
            ),
        ],
      );
}

class _TelemedIntakeResultView extends StatelessWidget {
  const _TelemedIntakeResultView({
    required this.result,
    required this.onBack,
    required this.paymentIntent,
    required this.paymentLoading,
    required this.paymentError,
    this.onRequestEmergency,
    this.onBrowseClinics,
    this.onCreatePayment,
  });

  final TelemedIntakeResult result;
  final VoidCallback onBack;
  final TelemedPaymentIntent? paymentIntent;
  final bool paymentLoading;
  final String? paymentError;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;
  final VoidCallback? onCreatePayment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final view = _eligibilityView(result.outcome, theme.colorScheme);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: view.background,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(view.icon, color: view.foreground),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(view.title, style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Text(view.description),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ограничения', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final guardrail in result.guardrails.take(5))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text('• ${_guardrailLabel(guardrail)}'),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (result.routingTarget == 'EMERGENCY_ROUTE' &&
            onRequestEmergency != null)
          FilledButton.icon(
            onPressed: onRequestEmergency,
            icon: const Icon(Icons.warning_amber_rounded),
            label: const Text('Открыть срочный маршрут'),
          )
        else if (result.routingTarget == 'CLINIC_BOOKING' &&
            onBrowseClinics != null)
          FilledButton.icon(
            onPressed: onBrowseClinics,
            icon: const Icon(Icons.local_hospital_outlined),
            label: const Text('Выбрать клинику'),
          )
        else if (result.routingTarget == 'TELEMED_PAYMENT_QUEUE')
          FilledButton.icon(
            onPressed: paymentLoading ? null : onCreatePayment,
            icon: paymentLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.payments_outlined),
            label: Text(paymentLoading ? 'Создаём оплату' : 'Перейти к оплате'),
          ),
        if (paymentIntent != null) ...[
          const SizedBox(height: 8),
          Text(
            'Оплата создана: ${paymentIntent!.amount} ${paymentIntent!.currency}. Правила отмены оплаты: ${paymentIntent!.refundPolicyVersion}.',
            style: theme.textTheme.bodySmall,
          ),
        ],
        if (paymentError != null) ...[
          const SizedBox(height: 8),
          Text(
            paymentError!,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.error),
          ),
        ],
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: onBack,
          child: const Text('Вернуться'),
        ),
      ],
    );
  }
}

class _CupertinoTelemedIntakeResultView extends StatelessWidget {
  const _CupertinoTelemedIntakeResultView({
    required this.result,
    required this.onBack,
    required this.paymentIntent,
    required this.paymentLoading,
    required this.paymentError,
    this.onRequestEmergency,
    this.onBrowseClinics,
    this.onCreatePayment,
  });

  final TelemedIntakeResult result;
  final VoidCallback onBack;
  final TelemedPaymentIntent? paymentIntent;
  final bool paymentLoading;
  final String? paymentError;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;
  final VoidCallback? onCreatePayment;

  @override
  Widget build(BuildContext context) {
    final view = _cupertinoEligibilityView(context, result.outcome);
    final paymentReady = result.routingTarget == 'TELEMED_PAYMENT_QUEUE' &&
        onCreatePayment != null;
    return ListView(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 28),
      children: [
        CupertinoListSection.insetGrouped(
          header: const Text('Результат проверки'),
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Semantics(
                liveRegion: true,
                label: '${view.title}. ${view.description}',
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(view.icon, color: view.foreground),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            view.title,
                            style: CupertinoTheme.of(context)
                                .textTheme
                                .navTitleTextStyle
                                .copyWith(fontSize: 18),
                          ),
                          const SizedBox(height: 6),
                          Text(view.description),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        CupertinoListSection.insetGrouped(
          header: const Text('Ограничения'),
          children: [
            for (final guardrail in result.guardrails.take(5))
              CupertinoListTile.notched(
                leading: const Icon(CupertinoIcons.check_mark_circled),
                title: Text(_guardrailLabel(guardrail)),
              ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (result.routingTarget == 'EMERGENCY_ROUTE' &&
                  onRequestEmergency != null)
                CupertinoButton(
                  minSize: 52,
                  color: CupertinoColors.systemRed,
                  borderRadius: BorderRadius.circular(16),
                  onPressed: onRequestEmergency,
                  child: const Text(
                    'Открыть срочные клиники',
                    style: TextStyle(color: CupertinoColors.white),
                  ),
                )
              else if (result.routingTarget == 'CLINIC_BOOKING' &&
                  onBrowseClinics != null)
                CupertinoButton.filled(
                  minSize: 52,
                  borderRadius: BorderRadius.circular(16),
                  onPressed: onBrowseClinics,
                  child: const Text('Выбрать клинику'),
                )
              else if (paymentReady)
                CupertinoButton.filled(
                  minSize: 52,
                  borderRadius: BorderRadius.circular(16),
                  onPressed: paymentLoading ? null : onCreatePayment,
                  child: paymentLoading
                      ? const CupertinoActivityIndicator(
                          color: CupertinoColors.white,
                        )
                      : const Text('Продолжить к следующему шагу'),
                ),
              if (paymentIntent != null) ...[
                const SizedBox(height: 10),
                Text(
                  'Backend подготовил оплату: ${paymentIntent!.amount} ${paymentIntent!.currency}. Правила отмены: ${paymentIntent!.refundPolicyVersion}.',
                  textAlign: TextAlign.center,
                ),
              ],
              if (paymentError != null) ...[
                const SizedBox(height: 10),
                Text(
                  _safeTelemedText(paymentError!),
                  style: TextStyle(
                    color: CupertinoDynamicColor.resolve(
                      CupertinoColors.systemRed,
                      context,
                    ),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 8),
              CupertinoButton(
                minSize: 44,
                onPressed: onBack,
                child: const Text('Вернуться'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TelemedIntakeError extends StatelessWidget {
  const _TelemedIntakeError({required this.onRetry});

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
              const Text(
                'Не удалось загрузить питомцев для онлайн-консультации.',
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

class _CupertinoTelemedIntakeError extends StatelessWidget {
  const _CupertinoTelemedIntakeError({required this.onRetry});

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
            const Text(
              'Не удалось загрузить питомцев для онлайн-консультации.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            CupertinoButton.filled(
              minSize: 44,
              onPressed: onRetry,
              child: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
}

class _TelemedNoPets extends StatelessWidget {
  const _TelemedNoPets();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Для онлайн-консультации нужно добавить питомца в профиль.',
            textAlign: TextAlign.center,
          ),
        ),
      );
}

class _CupertinoTelemedNoPets extends StatelessWidget {
  const _CupertinoTelemedNoPets();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Для онлайн-консультации нужно добавить питомца в профиль.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

class _TelemedOption {
  const _TelemedOption(this.code, this.label, this.icon);

  final String code;
  final String label;
  final IconData icon;
}

class _EligibilityView {
  const _EligibilityView(
    this.title,
    this.description,
    this.icon,
    this.foreground,
    this.background,
  );

  final String title;
  final String description;
  final IconData icon;
  final Color foreground;
  final Color background;
}

const List<_TelemedOption> _telemedCategories = [
  _TelemedOption(
      'SKIN_EAR_EYE', 'Кожа, уши или глаза', Icons.visibility_outlined),
  _TelemedOption('NUTRITION', 'Питание', Icons.restaurant_outlined),
  _TelemedOption('BEHAVIOR', 'Поведение', Icons.psychology_outlined),
  _TelemedOption(
      'MEDICATION_QUESTION', 'Вопрос по назначению', Icons.medication_outlined),
  _TelemedOption('POST_VISIT_FOLLOW_UP', 'Контроль после визита',
      Icons.event_available_outlined),
  _TelemedOption('VOMITING_DIARRHEA', 'Рвота или диарея', Icons.sick_outlined),
  _TelemedOption('PAIN_LAMENESS', 'Боль или хромота', Icons.healing_outlined),
  _TelemedOption('GENERAL_QUESTION', 'Общий вопрос', Icons.help_outline),
  _TelemedOption('OTHER', 'Другое', Icons.more_horiz),
];

const List<_TelemedOption> _telemedRedFlags = [
  _TelemedOption('BREATHING_DISTRESS', 'Тяжёлое дыхание', Icons.air_outlined),
  _TelemedOption('COLLAPSE_OR_UNCONSCIOUS', 'Потеря сознания',
      Icons.warning_amber_rounded),
  _TelemedOption('SEIZURE', 'Судороги', Icons.flash_on_outlined),
  _TelemedOption(
      'SEVERE_BLEEDING', 'Сильное кровотечение', Icons.bloodtype_outlined),
  _TelemedOption('MAJOR_TRAUMA', 'Травма', Icons.personal_injury_outlined),
  _TelemedOption('TOXIN_INGESTION', 'Отравление', Icons.science_outlined),
  _TelemedOption('BLOAT_OR_BLOCKED_URINATION', 'Вздутие или не мочится',
      Icons.emergency_outlined),
];

String _speciesLabel(String value) => switch (value) {
      'DOG' => 'собака',
      'CAT' => 'кошка',
      _ => 'питомец',
    };

String _intakeError(String code) {
  return switch (code) {
    'TELEMED_CONSENT_REQUIRED' =>
      'Подтвердите ограничения онлайн-консультации.',
    'OWNER_PET_NOT_FOUND' =>
      'Питомец не найден в текущем профиле. Обновите список и попробуйте снова.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось проверить, подходит ли онлайн-консультация.',
  };
}

String _paymentErrorFor(String code) {
  return switch (code) {
    'TELEMED_INTAKE_NOT_ELIGIBLE' =>
      'Оплата доступна только после безопасного результата онлайн-консультации.',
    'ACQUIRING_PROVIDER_UNAVAILABLE' =>
      'Платёжный провайдер временно недоступен. Попробуйте позже.',
    'TELEMED_PAYMENT_NOT_CREATABLE' =>
      'Оплата уже находится в другом состоянии. Обновите консультации.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось открыть оплату онлайн-консультации.',
  };
}

_EligibilityView _eligibilityView(String outcome, ColorScheme colors) {
  return switch (outcome) {
    'EMERGENCY' => _EligibilityView(
        'Нужна срочная помощь',
        'Онлайн-консультация не подходит. Откройте срочный маршрут и звоните в проверенную клинику.',
        Icons.warning_amber_rounded,
        colors.error,
        colors.errorContainer,
      ),
    'SAME_DAY_CLINIC' => _EligibilityView(
        'Лучше очный визит сегодня',
        'По этим симптомам безопаснее выбрать клинику, а не ждать онлайн-очередь.',
        Icons.local_hospital_outlined,
        colors.onSecondaryContainer,
        colors.secondaryContainer,
      ),
    'TELEMED_ELIGIBLE' => _EligibilityView(
        'Онлайн-консультация подходит',
        'Можно продолжить к оплате и очереди, когда этот шаг будет доступен.',
        Icons.video_call_outlined,
        colors.primary,
        colors.primaryContainer,
      ),
    _ => _EligibilityView(
        'Нужны уточнения',
        'Ответов недостаточно для безопасного онлайн-маршрута. Уточните симптомы или выберите клинику.',
        Icons.info_outline,
        colors.onSurfaceVariant,
        colors.surfaceContainerHighest,
      ),
  };
}

String _guardrailLabel(String value) {
  return switch (value) {
    'Telemedicine does not replace emergency care.' =>
      'Телемедицина не заменяет срочную помощь.',
    'VetHelp does not promise a diagnosis in telemedicine intake.' =>
      'VetHelp не обещает диагноз на этапе intake.',
    'Telemedicine intake does not create prescriptions.' =>
      'Intake не создаёт рецепт.',
    'Telemedicine intake does not confirm insurance coverage.' =>
      'Intake не подтверждает страховое покрытие.',
    'A veterinarian may still recommend an in-person examination.' =>
      'Ветеринар может рекомендовать очный осмотр.',
    _ => value,
  };
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

class _CupertinoTelemedError extends StatelessWidget {
  const _CupertinoTelemedError({required this.onRetry});

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
            const Text(
              'Не удалось загрузить консультации. Проверьте соединение и повторите попытку.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            CupertinoButton.filled(
              minSize: 44,
              onPressed: onRetry,
              child: const Text('Повторить'),
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

class _CupertinoEligibilityView {
  const _CupertinoEligibilityView({
    required this.title,
    required this.description,
    required this.icon,
    required this.foreground,
  });

  final String title;
  final String description;
  final IconData icon;
  final Color foreground;
}

class _TelemedPresentation {
  const _TelemedPresentation({
    required this.label,
    required this.cupertinoIcon,
    required this.color,
    this.description,
  });

  final String label;
  final IconData cupertinoIcon;
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
              'Консультация не состоялась. Статус авторизации оплаты проверяется автоматически.',
        ),
      'CANCELLED' => _StateView(
          'Консультация отменена',
          Icons.cancel_outlined,
          colors.primary,
        ),
      _ => _StateView(
          'Статус обновляется',
          Icons.sync_outlined,
          colors.primary,
        ),
    };

_TelemedPresentation _telemedPresentation(String value) => switch (value) {
      'WAITING_FOR_DOCTOR' => const _TelemedPresentation(
          label: 'Ожидаем врача',
          cupertinoIcon: CupertinoIcons.hourglass,
          color: CupertinoColors.activeBlue,
          description:
              'Подключение начнётся только после подтверждения статуса backend.',
        ),
      'CONNECTED' => const _TelemedPresentation(
          label: 'Врач подключился',
          cupertinoIcon: CupertinoIcons.videocam_circle,
          color: CupertinoColors.activeGreen,
        ),
      'COMPLETED' => const _TelemedPresentation(
          label: 'Консультация завершена',
          cupertinoIcon: CupertinoIcons.check_mark_circled,
          color: CupertinoColors.activeBlue,
        ),
      'DOCTOR_TIMEOUT' => const _TelemedPresentation(
          label: 'Врач не подключился',
          cupertinoIcon: CupertinoIcons.clock,
          color: CupertinoColors.systemRed,
          description:
              'Консультация не состоялась. Статус авторизации оплаты проверяется автоматически.',
        ),
      'CANCELLED' => const _TelemedPresentation(
          label: 'Консультация отменена',
          cupertinoIcon: CupertinoIcons.xmark_circle,
          color: CupertinoColors.secondaryLabel,
        ),
      _ => const _TelemedPresentation(
          label: 'Статус обновляется',
          cupertinoIcon: CupertinoIcons.arrow_2_circlepath,
          color: CupertinoColors.activeBlue,
        ),
    };

String _paymentActionLabel(String value) => switch (value) {
      'VOID_REQUESTED' => 'Отменяем авторизацию оплаты.',
      'VOIDED' => 'Авторизация оплаты отменена, списания не будет.',
      'REFUND_PENDING' => 'Возврат поставлен в очередь.',
      'REFUNDED' => 'Возврат выполнен.',
      'NOT_REQUIRED' => 'Дополнительных действий по оплате не требуется.',
      _ => 'Статус оплаты обновляется.',
    };

String? _paymentActionCopy(String? value) {
  if (value == null || value.isEmpty) return null;
  return _paymentActionLabel(value);
}

String _dateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(local);
  final time = TimeOfDay.fromDateTime(local).format(context);
  return '$date, $time';
}

String _cupertinoDateTime(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final year = local.year.toString();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day.$month.$year, $hour:$minute';
}

String _range(BuildContext context, DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(first);
  final start = TimeOfDay.fromDateTime(first).format(context);
  final end = TimeOfDay.fromDateTime(last).format(context);
  return '$date · $start-$end';
}

String _cupertinoRange(DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final day = first.day.toString().padLeft(2, '0');
  final month = first.month.toString().padLeft(2, '0');
  final startHour = first.hour.toString().padLeft(2, '0');
  final startMinute = first.minute.toString().padLeft(2, '0');
  final endHour = last.hour.toString().padLeft(2, '0');
  final endMinute = last.minute.toString().padLeft(2, '0');
  return '$day.$month · $startHour:$startMinute-$endHour:$endMinute';
}

String _safeTelemedText(String value) {
  final hasTechnicalToken =
      RegExp(r'\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b').hasMatch(value);
  final hasHttpStatus = RegExp(r'\b[45]\d\d\b').hasMatch(value);
  if (hasTechnicalToken || hasHttpStatus) {
    return 'Статус обновляется. Если состояние ухудшается, выберите клинику.';
  }
  return value;
}

TelemedPet? _selectedPet(List<TelemedPet> pets, String? selectedPetId) {
  if (selectedPetId == null) return null;
  for (final pet in pets) {
    if (pet.id == selectedPetId) return pet;
  }
  return null;
}

String _optionLabel(List<_TelemedOption> options, String code) {
  for (final option in options) {
    if (option.code == code) return option.label;
  }
  return 'Другое';
}

const Map<String, String> _durationOptions = {
  'NO_SYMPTOMS': 'Нет симптомов',
  'LESS_THAN_24H': 'Меньше 24 часов',
  'ONE_TO_THREE_DAYS': '1-3 дня',
  'MORE_THAN_THREE_DAYS': 'Больше 3 дней',
};

String _durationLabel(String code) {
  return _durationOptions[code] ?? '1-3 дня';
}

_CupertinoEligibilityView _cupertinoEligibilityView(
  BuildContext context,
  String outcome,
) {
  return switch (outcome) {
    'EMERGENCY' => _CupertinoEligibilityView(
        title: 'Нужна срочная помощь',
        description:
            'Онлайн-консультация не подходит. Откройте срочные клиники и звоните в проверенную клинику.',
        icon: CupertinoIcons.exclamationmark_triangle_fill,
        foreground:
            CupertinoDynamicColor.resolve(CupertinoColors.systemRed, context),
      ),
    'SAME_DAY_CLINIC' => _CupertinoEligibilityView(
        title: 'Лучше очный визит сегодня',
        description:
            'По этим симптомам безопаснее выбрать клинику, а не ждать онлайн-очередь.',
        icon: CupertinoIcons.building_2_fill,
        foreground: CupertinoDynamicColor.resolve(
          CupertinoColors.systemOrange,
          context,
        ),
      ),
    'TELEMED_ELIGIBLE' => _CupertinoEligibilityView(
        title: 'Онлайн-консультация подходит',
        description:
            'Можно перейти к следующему шагу, если backend подтвердит доступность консультации.',
        icon: CupertinoIcons.videocam_circle,
        foreground:
            CupertinoDynamicColor.resolve(CupertinoColors.activeBlue, context),
      ),
    _ => _CupertinoEligibilityView(
        title: 'Нужны уточнения',
        description:
            'Ответов недостаточно для безопасного онлайн-маршрута. Уточните симптомы или выберите клинику.',
        icon: CupertinoIcons.info_circle,
        foreground: CupertinoDynamicColor.resolve(
          CupertinoColors.secondaryLabel,
          context,
        ),
      ),
  };
}
