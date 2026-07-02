import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../presentation/platform/owner_platform.dart';
import 'telemed_live_call_view.dart';
import 'telemed_room_access_repository.dart';
import 'telemed_waiting_room_bloc.dart';

typedef TelemedLiveCallBuilder = Widget Function(
  BuildContext context,
  TelemedRoomAccess access,
);

class TelemedWaitingRoomPage extends StatelessWidget {
  const TelemedWaitingRoomPage({
    super.key,
    required this.sessionId,
    required this.repository,
    required this.roomAccessRepository,
    this.onBrowseClinics,
    this.liveCallBuilder,
    this.platformOverride,
  });

  final String sessionId;
  final TelemedWaitingRepository repository;
  final TelemedRoomAccessRepository roomAccessRepository;
  final VoidCallback? onBrowseClinics;
  final TelemedLiveCallBuilder? liveCallBuilder;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => TelemedWaitingBloc(
        repository: repository,
        roomAccessRepository: roomAccessRepository,
      )..add(TelemedWaitingOpened(sessionId)),
      child: _TelemedWaitingRoomView(
        onBrowseClinics: onBrowseClinics,
        liveCallBuilder: liveCallBuilder,
        platformOverride: platformOverride,
      ),
    );
  }
}

class _TelemedWaitingRoomView extends StatelessWidget {
  const _TelemedWaitingRoomView({
    this.onBrowseClinics,
    this.liveCallBuilder,
    this.platformOverride,
  });

  final VoidCallback? onBrowseClinics;
  final TelemedLiveCallBuilder? liveCallBuilder;
  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    if (_usesCupertino(context)) {
      return CupertinoPageScaffold(
        navigationBar: const CupertinoNavigationBar(
          middle: Text('Консультация VetHelp'),
        ),
        child: SafeArea(
          bottom: false,
          child: BlocBuilder<TelemedWaitingBloc, TelemedWaitingState>(
            builder: (context, state) {
              return switch (state) {
                TelemedWaitingLoading() => const _CupertinoWaitingSkeleton(),
                TelemedWaitingForDoctor(
                  snapshot: final snapshot,
                  cancelError: final cancelError,
                ) =>
                  _CupertinoWaitingForDoctor(
                    snapshot: snapshot,
                    cancelError: cancelError,
                    onBrowseClinics: onBrowseClinics,
                  ),
                TelemedWaitingCancelling(snapshot: final snapshot) =>
                  _CupertinoWaitingForDoctor(
                    snapshot: snapshot,
                    isCancelling: true,
                    onBrowseClinics: onBrowseClinics,
                  ),
                TelemedConnectingRoom() => const _CupertinoConnectingRoom(),
                TelemedRoomReady(access: final access) => _RoomReady(
                    access: access,
                    liveCallBuilder: liveCallBuilder,
                  ),
                TelemedDoctorTimeout(snapshot: final snapshot) =>
                  _CupertinoDoctorTimeout(
                    snapshot: snapshot,
                    onBrowseClinics: onBrowseClinics,
                  ),
                TelemedCompleted() => const _CupertinoCompleted(),
                TelemedCancelled(snapshot: final snapshot) =>
                  _CupertinoCancelled(
                    snapshot: snapshot,
                    onBrowseClinics: onBrowseClinics,
                  ),
                TelemedWaitingError(message: final message) =>
                  _CupertinoWaitingError(message: message),
              };
            },
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Консультация VetHelp')),
      body: BlocBuilder<TelemedWaitingBloc, TelemedWaitingState>(
        builder: (context, state) {
          return switch (state) {
            TelemedWaitingLoading() => const _WaitingSkeleton(),
            TelemedWaitingForDoctor(
              snapshot: final snapshot,
              cancelError: final cancelError,
            ) =>
              _WaitingForDoctor(
                snapshot: snapshot,
                cancelError: cancelError,
              ),
            TelemedWaitingCancelling(snapshot: final snapshot) =>
              _WaitingForDoctor(snapshot: snapshot, isCancelling: true),
            TelemedConnectingRoom() => const _ConnectingRoom(),
            TelemedRoomReady(access: final access) =>
              _RoomReady(access: access, liveCallBuilder: liveCallBuilder),
            TelemedDoctorTimeout(snapshot: final snapshot) => _DoctorTimeout(
                snapshot: snapshot,
                onBrowseClinics: onBrowseClinics,
              ),
            TelemedCompleted() => const _Completed(),
            TelemedCancelled(snapshot: final snapshot) => _Cancelled(
                snapshot: snapshot,
                onBrowseClinics: onBrowseClinics,
              ),
            TelemedWaitingError(message: final message) =>
              _Error(message: message),
          };
        },
      ),
    );
  }

  bool _usesCupertino(BuildContext context) {
    final themedPlatform =
        context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
    return ownerUsesCupertino(platform: platformOverride ?? themedPlatform);
  }
}

class _WaitingSkeleton extends StatelessWidget {
  const _WaitingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _PlaceholderCard(height: 160),
        SizedBox(height: 16),
        _PlaceholderCard(height: 88),
        SizedBox(height: 16),
        _PlaceholderCard(height: 72),
      ],
    );
  }
}

class _CupertinoWaitingSkeleton extends StatelessWidget {
  const _CupertinoWaitingSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Center(child: CupertinoActivityIndicator());
  }
}

class _WaitingForDoctor extends StatelessWidget {
  const _WaitingForDoctor({
    required this.snapshot,
    this.isCancelling = false,
    this.cancelError,
  });

  final TelemedWaitingSnapshot snapshot;
  final bool isCancelling;
  final String? cancelError;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      const Icon(Icons.medical_services_outlined, size: 52),
                      const SizedBox(height: 12),
                      Text(
                        'Ожидаем подключения врача',
                        style: theme.textTheme.titleLarge,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                          'Не закрывайте экран. Мы покажем актуальный статус, как только он изменится.',
                          textAlign: TextAlign.center),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                  child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: _ServerCountdown(snapshot: snapshot))),
              const SizedBox(height: 16),
              const Card(
                child: ListTile(
                  leading: Icon(Icons.health_and_safety_outlined),
                  title: Text('Важно'),
                  subtitle: Text(
                      'При ухудшении состояния питомца не ждите консультацию: используйте экстренный маршрут.'),
                ),
              ),
              if (cancelError != null) ...[
                const SizedBox(height: 16),
                Card(
                  color: theme.colorScheme.errorContainer,
                  child: ListTile(
                    leading: Icon(
                      Icons.error_outline,
                      color: theme.colorScheme.onErrorContainer,
                    ),
                    title: Text(
                      'Не удалось отменить',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: theme.colorScheme.onErrorContainer,
                      ),
                    ),
                    subtitle: Text(
                      cancelError!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: isCancelling
                      ? null
                      : () => context
                          .read<TelemedWaitingBloc>()
                          .add(const TelemedWaitingRefreshRequested()),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Проверить статус'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed:
                      isCancelling ? null : () => _confirmCancel(context),
                  icon: isCancelling
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.close),
                  label: Text(isCancelling
                      ? 'Отменяем консультацию'
                      : 'Отменить консультацию'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmCancel(BuildContext context) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => const _CancelConfirmationSheet(),
    );
    if (confirmed == true && context.mounted) {
      context
          .read<TelemedWaitingBloc>()
          .add(const TelemedWaitingCancelRequested());
    }
  }
}

class _CupertinoWaitingForDoctor extends StatelessWidget {
  const _CupertinoWaitingForDoctor({
    required this.snapshot,
    this.isCancelling = false,
    this.cancelError,
    this.onBrowseClinics,
  });

  final TelemedWaitingSnapshot snapshot;
  final bool isCancelling;
  final String? cancelError;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(0, 12, 0, 24),
            children: [
              CupertinoListSection.insetGrouped(
                header: const Text('Статус'),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Semantics(
                      liveRegion: true,
                      label:
                          'Ожидаем врача. Следующее действие: оставайтесь на экране и проверяйте статус.',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Icon(CupertinoIcons.hourglass, size: 48),
                          const SizedBox(height: 12),
                          Text(
                            'Ожидаем подключения врача',
                            style: CupertinoTheme.of(context)
                                .textTheme
                                .navTitleTextStyle
                                .copyWith(fontSize: 22),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Мы не обещаем подключение до подтверждённого backend state. Обновите статус, если экран долго не меняется.',
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: _CupertinoServerCountdown(snapshot: snapshot),
                  ),
                ],
              ),
              CupertinoListSection.insetGrouped(
                header: const Text('Безопасность'),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'При ухудшении состояния питомца не ждите консультацию.',
                        ),
                        if (onBrowseClinics != null) ...[
                          const SizedBox(height: 10),
                          CupertinoButton(
                            minSize: 44,
                            color: CupertinoDynamicColor.resolve(
                              CupertinoColors.tertiarySystemFill,
                              context,
                            ),
                            borderRadius: BorderRadius.circular(14),
                            onPressed: onBrowseClinics,
                            child: const Text('Выбрать клинику'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (cancelError != null)
                CupertinoListSection.insetGrouped(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          _safeWaitingText(cancelError!),
                          style: TextStyle(
                            color: CupertinoDynamicColor.resolve(
                              CupertinoColors.systemRed,
                              context,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CupertinoButton.filled(
                minSize: 52,
                onPressed: isCancelling
                    ? null
                    : () => context
                        .read<TelemedWaitingBloc>()
                        .add(const TelemedWaitingRefreshRequested()),
                child: const Text('Проверить статус'),
              ),
              const SizedBox(height: 8),
              CupertinoButton(
                minSize: 52,
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.tertiarySystemFill,
                  context,
                ),
                borderRadius: BorderRadius.circular(14),
                onPressed: isCancelling ? null : () => _confirmCancel(context),
                child: isCancelling
                    ? const CupertinoActivityIndicator()
                    : Text(
                        'Отменить консультацию',
                        style: TextStyle(
                          color: CupertinoDynamicColor.resolve(
                            CupertinoColors.systemRed,
                            context,
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmCancel(BuildContext context) async {
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder: (dialogContext) => CupertinoAlertDialog(
        title: const Text('Отменить онлайн-консультацию?'),
        content: const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text(
            'Если врач ещё не подключился, VetHelp отменит ожидание и поставит отмену авторизации оплаты в очередь.',
          ),
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Продолжить ожидание'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Да, отменить'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      context
          .read<TelemedWaitingBloc>()
          .add(const TelemedWaitingCancelRequested());
    }
  }
}

class _CancelConfirmationSheet extends StatelessWidget {
  const _CancelConfirmationSheet();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Отменить онлайн-консультацию?',
                style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Если врач ещё не подключился, VetHelp отменит ожидание и поставит отмену авторизации оплаты в очередь.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => Navigator.of(context).pop(true),
                icon: const Icon(Icons.check),
                label: const Text('Да, отменить'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Продолжить ожидание'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoServerCountdown extends StatefulWidget {
  const _CupertinoServerCountdown({required this.snapshot});

  final TelemedWaitingSnapshot snapshot;

  @override
  State<_CupertinoServerCountdown> createState() =>
      _CupertinoServerCountdownState();
}

class _CupertinoServerCountdownState extends State<_CupertinoServerCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.snapshot.remainingAt(DateTime.now().toUtc());
    final totalSeconds = remaining.inSeconds.clamp(0, 3600);
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    final critical = totalSeconds <= 30;
    return Semantics(
      liveRegion: critical,
      label: critical
          ? 'Проверяем статус подключения врача.'
          : 'Ожидаем врача. Осталось $minutes минут $seconds секунд.',
      child: Row(
        children: [
          Icon(
            critical
                ? CupertinoIcons.exclamationmark_triangle
                : CupertinoIcons.clock,
            color: critical
                ? CupertinoDynamicColor.resolve(
                    CupertinoColors.systemRed,
                    context,
                  )
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              critical
                  ? 'Проверяем статус подключения'
                  : 'Ожидаем врача: $minutes:$seconds',
            ),
          ),
        ],
      ),
    );
  }
}

class _ServerCountdown extends StatefulWidget {
  const _ServerCountdown({required this.snapshot});

  final TelemedWaitingSnapshot snapshot;

  @override
  State<_ServerCountdown> createState() => _ServerCountdownState();
}

class _ServerCountdownState extends State<_ServerCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.snapshot.remainingAt(DateTime.now().toUtc());
    final totalSeconds = remaining.inSeconds.clamp(0, 3600);
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    final critical = totalSeconds <= 30;
    return Row(
      children: [
        Icon(critical ? Icons.warning_amber_rounded : Icons.timer_outlined,
            color: critical ? Theme.of(context).colorScheme.error : null),
        const SizedBox(width: 12),
        Expanded(
            child: Text(critical
                ? 'Проверяем статус подключения'
                : 'Ожидаем врача: $minutes:$seconds')),
      ],
    );
  }
}

class _ConnectingRoom extends StatelessWidget {
  const _ConnectingRoom();

  @override
  Widget build(BuildContext context) {
    return const Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
      CircularProgressIndicator(),
      SizedBox(height: 16),
      Text('Врач подключился. Готовим консультацию...')
    ]));
  }
}

class _CupertinoConnectingRoom extends StatelessWidget {
  const _CupertinoConnectingRoom();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CupertinoActivityIndicator(),
          SizedBox(height: 16),
          Text('Врач подключился. Готовим консультацию...'),
        ],
      ),
    );
  }
}

class _RoomReady extends StatelessWidget {
  const _RoomReady({required this.access, this.liveCallBuilder});

  final TelemedRoomAccess access;
  final TelemedLiveCallBuilder? liveCallBuilder;

  @override
  Widget build(BuildContext context) {
    final builder = liveCallBuilder;
    if (builder != null) return builder(context, access);
    return TelemedLiveCallView(
      access: access,
      onRefreshStatus: () => context
          .read<TelemedWaitingBloc>()
          .add(const TelemedWaitingRefreshRequested()),
    );
  }
}

class _DoctorTimeout extends StatelessWidget {
  const _DoctorTimeout({required this.snapshot, this.onBrowseClinics});

  final TelemedWaitingSnapshot snapshot;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.schedule_outlined,
              size: 56,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Врач не вышел на связь',
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _doctorTimeoutMessage(snapshot.refundState),
              textAlign: TextAlign.center,
            ),
            if (onBrowseClinics != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () {
                  final navigator = Navigator.of(context);
                  if (navigator.canPop()) navigator.pop();
                  onBrowseClinics?.call();
                },
                icon: const Icon(Icons.local_hospital_outlined),
                label: const Text('Выбрать клинику'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CupertinoDoctorTimeout extends StatelessWidget {
  const _CupertinoDoctorTimeout({required this.snapshot, this.onBrowseClinics});

  final TelemedWaitingSnapshot snapshot;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    return _CupertinoTerminalState(
      icon: CupertinoIcons.clock,
      title: 'Врач не вышел на связь',
      message: _doctorTimeoutMessage(snapshot.refundState),
      onBrowseClinics: onBrowseClinics,
      primaryLabel: 'Выбрать клинику',
      primaryAction: onBrowseClinics == null
          ? null
          : () {
              final navigator = Navigator.of(context);
              if (navigator.canPop()) navigator.pop();
              onBrowseClinics?.call();
            },
    );
  }
}

class _Completed extends StatelessWidget {
  const _Completed();

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Консультация завершена'));
  }
}

class _CupertinoCompleted extends StatelessWidget {
  const _CupertinoCompleted();

  @override
  Widget build(BuildContext context) {
    return const _CupertinoTerminalState(
      icon: CupertinoIcons.check_mark_circled,
      title: 'Консультация завершена',
      message: 'Рекомендации врача появятся в истории консультаций.',
    );
  }
}

class _Cancelled extends StatelessWidget {
  const _Cancelled({required this.snapshot, this.onBrowseClinics});

  final TelemedWaitingSnapshot snapshot;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 56,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              'Консультация отменена',
              style: theme.textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _cancelledMessage(snapshot.refundState),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.history),
              label: const Text('Вернуться к истории'),
            ),
            if (onBrowseClinics != null) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () {
                  final navigator = Navigator.of(context);
                  if (navigator.canPop()) navigator.pop();
                  onBrowseClinics?.call();
                },
                icon: const Icon(Icons.local_hospital_outlined),
                label: const Text('Выбрать клинику'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CupertinoCancelled extends StatelessWidget {
  const _CupertinoCancelled({required this.snapshot, this.onBrowseClinics});

  final TelemedWaitingSnapshot snapshot;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    return _CupertinoTerminalState(
      icon: CupertinoIcons.check_mark_circled,
      title: 'Консультация отменена',
      message: _cancelledMessage(snapshot.refundState),
      primaryLabel: 'Вернуться к истории',
      primaryAction: () => Navigator.of(context).pop(),
      secondaryLabel: onBrowseClinics == null ? null : 'Выбрать клинику',
      secondaryAction: onBrowseClinics == null
          ? null
          : () {
              final navigator = Navigator.of(context);
              if (navigator.canPop()) navigator.pop();
              onBrowseClinics?.call();
            },
    );
  }
}

class _CupertinoTerminalState extends StatelessWidget {
  const _CupertinoTerminalState({
    required this.icon,
    required this.title,
    required this.message,
    this.primaryLabel,
    this.primaryAction,
    this.secondaryLabel,
    this.secondaryAction,
    this.onBrowseClinics,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? primaryLabel;
  final VoidCallback? primaryAction;
  final String? secondaryLabel;
  final VoidCallback? secondaryAction;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(icon, size: 56),
            const SizedBox(height: 16),
            Text(
              title,
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 22),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            if (primaryLabel != null && primaryAction != null) ...[
              const SizedBox(height: 20),
              CupertinoButton.filled(
                minSize: 44,
                onPressed: primaryAction,
                child: Text(primaryLabel!),
              ),
            ],
            if (secondaryLabel != null && secondaryAction != null) ...[
              const SizedBox(height: 8),
              CupertinoButton(
                minSize: 44,
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.tertiarySystemFill,
                  context,
                ),
                borderRadius: BorderRadius.circular(14),
                onPressed: secondaryAction,
                child: Text(secondaryLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
        child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(message, textAlign: TextAlign.center)));
  }
}

class _CupertinoWaitingError extends StatelessWidget {
  const _CupertinoWaitingError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          _safeWaitingText(message),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

String _cancelledMessage(String? refundState) => switch (refundState) {
      'VOID_REQUESTED' =>
        'Отменяем авторизацию оплаты. Списания по этой консультации не будет.',
      'VOIDED' => 'Авторизация оплаты отменена. Списания не будет.',
      'REFUND_PENDING' => 'Возврат поставлен в очередь.',
      'REFUNDED' => 'Возврат выполнен.',
      'NOT_REQUIRED' => 'Дополнительных действий по оплате не требуется.',
      _ => 'Статус оплаты обновляется автоматически.',
    };

String _doctorTimeoutMessage(String? refundState) => switch (refundState) {
      'VOID_REQUESTED' =>
        'Отменяем авторизацию оплаты. Списания по этой консультации не будет.',
      'VOIDED' => 'Авторизация оплаты отменена. Списания не будет.',
      'REFUND_PENDING' => 'Возврат поставлен в очередь.',
      'REFUNDED' => 'Возврат выполнен.',
      'NOT_REQUIRED' => 'Оплата не требовала дополнительных действий.',
      _ => 'Проверяем автоматическую отмену авторизации оплаты.',
    };

String _safeWaitingText(String value) {
  final hasTechnicalToken =
      RegExp(r'\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b').hasMatch(value);
  final hasHttpStatus = RegExp(r'\b[45]\d\d\b').hasMatch(value);
  if (hasTechnicalToken || hasHttpStatus) {
    return 'Статус консультации обновляется. Попробуйте проверить ещё раз.';
  }
  return value;
}

class _PlaceholderCard extends StatelessWidget {
  const _PlaceholderCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16)),
    );
  }
}
