import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as rtc;
import 'package:livekit_client/livekit_client.dart' as lk;

import 'telemed_room_access_repository.dart';

class TelemedLiveCallView extends StatefulWidget {
  const TelemedLiveCallView({
    super.key,
    required this.access,
    this.onRefreshStatus,
  });

  final TelemedRoomAccess access;
  final VoidCallback? onRefreshStatus;

  @override
  State<TelemedLiveCallView> createState() => _TelemedLiveCallViewState();
}

class _TelemedLiveCallViewState extends State<TelemedLiveCallView> {
  lk.Room? _room;
  lk.EventsListener<lk.RoomEvent>? _listener;
  lk.ConnectionState _connectionState = lk.ConnectionState.disconnected;
  Timer? _statusRefreshTimer;
  bool _cameraEnabled = true;
  bool _microphoneEnabled = true;
  bool _connecting = false;
  bool _leftLocally = false;
  String? _error;
  String? _mediaNotice;

  @override
  void initState() {
    super.initState();
    _statusRefreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => widget.onRefreshStatus?.call(),
    );
    unawaited(_connect());
  }

  @override
  void dispose() {
    _statusRefreshTimer?.cancel();
    final room = _room;
    final listener = _listener;
    room?.removeListener(_onRoomChanged);
    unawaited(listener?.dispose());
    unawaited(room?.dispose());
    super.dispose();
  }

  Future<void> _connect() async {
    if (_connecting) return;
    setState(() {
      _connecting = true;
      _leftLocally = false;
      _error = null;
      _mediaNotice = null;
      _connectionState = lk.ConnectionState.connecting;
    });

    final oldRoom = _room;
    final oldListener = _listener;
    oldRoom?.removeListener(_onRoomChanged);
    _room = null;
    _listener = null;
    unawaited(oldListener?.dispose());
    unawaited(oldRoom?.dispose());

    final room = lk.Room(
      roomOptions: const lk.RoomOptions(adaptiveStream: true, dynacast: true),
    );
    final listener = room.createListener();
    _room = room;
    _listener = listener;
    room.addListener(_onRoomChanged);
    _setupListeners(listener);

    try {
      await room.connect(
        widget.access.livekitUrl,
        widget.access.accessToken,
      );
      if (!mounted) return;
      setState(() {
        _connectionState = room.connectionState;
      });
      await _publishLocalTracks(room);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось подключиться к видеокомнате. Попробуйте ещё раз.';
        _connectionState = lk.ConnectionState.disconnected;
      });
    } finally {
      if (mounted) {
        setState(() => _connecting = false);
      }
    }
  }

  void _setupListeners(lk.EventsListener<lk.RoomEvent> listener) {
    listener
      ..on<lk.RoomReconnectingEvent>((_) {
        if (mounted) {
          setState(() => _connectionState = lk.ConnectionState.reconnecting);
        }
      })
      ..on<lk.RoomReconnectedEvent>((_) {
        if (mounted) {
          setState(() {
            _connectionState = lk.ConnectionState.connected;
            _error = null;
          });
        }
      })
      ..on<lk.RoomDisconnectedEvent>((event) {
        if (mounted) {
          setState(() {
            _connectionState = lk.ConnectionState.disconnected;
            if (!_leftLocally) {
              _error =
                  'Связь с комнатой потеряна. Статус консультации обновит VetHelp.';
            }
          });
        }
      })
      ..on<lk.ParticipantEvent>((_) => _refresh())
      ..on<lk.TrackSubscribedEvent>((_) => _refresh())
      ..on<lk.TrackUnsubscribedEvent>((_) => _refresh())
      ..on<lk.LocalTrackPublishedEvent>((_) => _refresh())
      ..on<lk.LocalTrackUnpublishedEvent>((_) => _refresh());
  }

  Future<void> _publishLocalTracks(lk.Room room) async {
    final participant = room.localParticipant;
    if (participant == null) return;

    try {
      await participant.setCameraEnabled(_cameraEnabled);
    } catch (_) {
      if (mounted) {
        setState(() {
          _cameraEnabled = false;
          _mediaNotice =
              'Камера недоступна. Проверьте разрешение и включите её снова.';
        });
      }
    }

    try {
      await participant.setMicrophoneEnabled(_microphoneEnabled);
    } catch (_) {
      if (mounted) {
        setState(() {
          _microphoneEnabled = false;
          _mediaNotice =
              'Микрофон недоступен. Проверьте разрешение и включите его снова.';
        });
      }
    }
  }

  Future<void> _toggleCamera() async {
    final participant = _room?.localParticipant;
    if (participant == null) return;
    final next = !_cameraEnabled;
    setState(() {
      _cameraEnabled = next;
      _mediaNotice = null;
    });
    try {
      await participant.setCameraEnabled(next);
    } catch (_) {
      if (mounted) {
        setState(() {
          _cameraEnabled = !next;
          _mediaNotice = 'Не удалось изменить состояние камеры.';
        });
      }
    }
  }

  Future<void> _toggleMicrophone() async {
    final participant = _room?.localParticipant;
    if (participant == null) return;
    final next = !_microphoneEnabled;
    setState(() {
      _microphoneEnabled = next;
      _mediaNotice = null;
    });
    try {
      await participant.setMicrophoneEnabled(next);
    } catch (_) {
      if (mounted) {
        setState(() {
          _microphoneEnabled = !next;
          _mediaNotice = 'Не удалось изменить состояние микрофона.';
        });
      }
    }
  }

  Future<void> _leaveDeviceRoom() async {
    setState(() {
      _leftLocally = true;
      _connectionState = lk.ConnectionState.disconnected;
      _error = null;
    });
    await _room?.disconnect();
  }

  void _onRoomChanged() {
    if (!mounted) return;
    final room = _room;
    setState(() {
      _connectionState =
          room?.connectionState ?? lk.ConnectionState.disconnected;
    });
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final room = _room;
    final remoteTrack = room == null ? null : _remoteVideoTrack(room);
    final localTrack = room == null ? null : _localVideoTrack(room);
    final showPoorConnection =
        room != null && (_hasPoorConnection(room) || _isReconnecting);
    final theme = Theme.of(context);

    return ColoredBox(
      color: theme.colorScheme.surface,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _RemoteVideoStage(
            track: remoteTrack,
            doctorName: room == null ? null : _remoteParticipantName(room),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _CallStatusBar(
                    connectionState: _connectionState,
                    tokenExpiresAt: widget.access.tokenExpiresAt,
                  ),
                  const SizedBox(height: 8),
                  if (showPoorConnection)
                    const _CallNotice(
                      icon: Icons.network_check,
                      text:
                          'Нестабильная связь. Если видео прерывается, не закрывайте экран.',
                    ),
                  if (_mediaNotice != null) ...[
                    const SizedBox(height: 8),
                    _CallNotice(
                      icon: Icons.info_outline,
                      text: _mediaNotice!,
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    _CallNotice(
                      icon: Icons.error_outline,
                      text: _error!,
                      isError: true,
                    ),
                  ],
                  const Spacer(),
                  if (localTrack != null && _cameraEnabled)
                    Align(
                      alignment: Alignment.centerRight,
                      child: _LocalPreview(track: localTrack),
                    ),
                  const SizedBox(height: 16),
                  _CallControls(
                    cameraEnabled: _cameraEnabled,
                    microphoneEnabled: _microphoneEnabled,
                    connecting: _connecting,
                    leftLocally: _leftLocally,
                    onToggleCamera: _toggleCamera,
                    onToggleMicrophone: _toggleMicrophone,
                    onReconnect: _connect,
                    onLeave: _leaveDeviceRoom,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _leftLocally
                        ? 'Вы отключились от комнаты на этом устройстве. Завершение консультации подтверждается сервером.'
                        : 'Не завершайте консультацию локально: итоговый статус придёт от VetHelp после события врача.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool get _isReconnecting =>
      _connectionState == lk.ConnectionState.reconnecting ||
      _connectionState == lk.ConnectionState.connecting;

  lk.VideoTrack? _remoteVideoTrack(lk.Room room) {
    for (final participant in room.remoteParticipants.values) {
      for (final publication in participant.videoTrackPublications) {
        final track = publication.track;
        if (!publication.isScreenShare &&
            publication.subscribed &&
            !publication.muted &&
            track != null) {
          return track;
        }
      }
    }
    return null;
  }

  String? _remoteParticipantName(lk.Room room) {
    for (final participant in room.remoteParticipants.values) {
      if (participant.name.isNotEmpty) return participant.name;
      if (participant.identity.isNotEmpty) return participant.identity;
    }
    return null;
  }

  lk.VideoTrack? _localVideoTrack(lk.Room room) {
    final participant = room.localParticipant;
    if (participant == null) return null;
    for (final publication in participant.videoTrackPublications) {
      final track = publication.track;
      if (publication.source == lk.TrackSource.camera &&
          !publication.muted &&
          track != null) {
        return track;
      }
    }
    return null;
  }

  bool _hasPoorConnection(lk.Room room) {
    final localQuality = room.localParticipant?.connectionQuality;
    if (_isPoor(localQuality)) return true;
    for (final participant in room.remoteParticipants.values) {
      if (_isPoor(participant.connectionQuality)) return true;
    }
    return false;
  }

  bool _isPoor(lk.ConnectionQuality? quality) {
    return quality == lk.ConnectionQuality.poor ||
        quality == lk.ConnectionQuality.lost;
  }
}

class _RemoteVideoStage extends StatelessWidget {
  const _RemoteVideoStage({required this.track, this.doctorName});

  final lk.VideoTrack? track;
  final String? doctorName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (track != null) {
      return lk.VideoTrackRenderer(
        track!,
        fit: rtc.RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
      );
    }
    return ColoredBox(
      color: theme.colorScheme.surfaceContainerHighest,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.videocam_outlined,
                size: 64,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                doctorName == null
                    ? 'Подключаем видео врача'
                    : '$doctorName подключает видео',
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                'Аудиоканал уже может быть активен. Статус консультации обновляется сервером.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocalPreview extends StatelessWidget {
  const _LocalPreview({required this.track});

  final lk.VideoTrack track;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 128,
          height: 176,
          child: lk.VideoTrackRenderer(
            track,
            fit: rtc.RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
          ),
        ),
      ),
    );
  }
}

class _CallStatusBar extends StatelessWidget {
  const _CallStatusBar({
    required this.connectionState,
    required this.tokenExpiresAt,
  });

  final lk.ConnectionState connectionState;
  final DateTime tokenExpiresAt;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _StatusChip(
          icon: _connectionIcon,
          label: _connectionLabel,
        ),
        _StatusChip(
          icon: Icons.lock_clock_outlined,
          label: 'Доступ до ${_time(context, tokenExpiresAt)}',
        ),
      ],
    );
  }

  IconData get _connectionIcon {
    return switch (connectionState) {
      lk.ConnectionState.connected => Icons.check_circle_outline,
      lk.ConnectionState.connecting => Icons.sync,
      lk.ConnectionState.reconnecting => Icons.sync_problem_outlined,
      lk.ConnectionState.disconnected => Icons.cloud_off_outlined,
    };
  }

  String get _connectionLabel {
    return switch (connectionState) {
      lk.ConnectionState.connected => 'Связь активна',
      lk.ConnectionState.connecting => 'Подключаемся',
      lk.ConnectionState.reconnecting => 'Восстанавливаем связь',
      lk.ConnectionState.disconnected => 'Связь отключена',
    };
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18),
            const SizedBox(width: 6),
            Text(label, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _CallNotice extends StatelessWidget {
  const _CallNotice({
    required this.icon,
    required this.text,
    this.isError = false,
  });

  final IconData icon;
  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final background = isError
        ? theme.colorScheme.errorContainer
        : theme.colorScheme.secondaryContainer;
    final foreground = isError
        ? theme.colorScheme.onErrorContainer
        : theme.colorScheme.onSecondaryContainer;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon, color: foreground),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: foreground,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallControls extends StatelessWidget {
  const _CallControls({
    required this.cameraEnabled,
    required this.microphoneEnabled,
    required this.connecting,
    required this.leftLocally,
    required this.onToggleCamera,
    required this.onToggleMicrophone,
    required this.onReconnect,
    required this.onLeave,
  });

  final bool cameraEnabled;
  final bool microphoneEnabled;
  final bool connecting;
  final bool leftLocally;
  final VoidCallback onToggleCamera;
  final VoidCallback onToggleMicrophone;
  final VoidCallback onReconnect;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _CallIconButton(
              tooltip: microphoneEnabled
                  ? 'Выключить микрофон'
                  : 'Включить микрофон',
              icon: microphoneEnabled ? Icons.mic : Icons.mic_off,
              onPressed: leftLocally ? null : onToggleMicrophone,
            ),
            _CallIconButton(
              tooltip: cameraEnabled ? 'Выключить камеру' : 'Включить камеру',
              icon: cameraEnabled ? Icons.videocam : Icons.videocam_off,
              onPressed: leftLocally ? null : onToggleCamera,
            ),
            _CallIconButton(
              tooltip: 'Переподключиться',
              icon: connecting ? Icons.sync : Icons.refresh,
              onPressed: connecting ? null : onReconnect,
            ),
            _CallIconButton(
              tooltip: 'Отключиться на устройстве',
              icon: Icons.call_end,
              isDestructive: true,
              onPressed: leftLocally ? null : onLeave,
            ),
          ],
        ),
      ),
    );
  }
}

class _CallIconButton extends StatelessWidget {
  const _CallIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.isDestructive = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final foreground = isDestructive
        ? colorScheme.onErrorContainer
        : colorScheme.onSecondaryContainer;
    final background = isDestructive
        ? colorScheme.errorContainer
        : colorScheme.secondaryContainer;
    return Tooltip(
      message: tooltip,
      child: SizedBox.square(
        dimension: 52,
        child: IconButton.filled(
          onPressed: onPressed,
          style: IconButton.styleFrom(
            backgroundColor: background,
            foregroundColor: foreground,
            disabledBackgroundColor: colorScheme.surfaceContainerHighest,
            disabledForegroundColor: colorScheme.onSurfaceVariant,
          ),
          icon: Icon(icon),
        ),
      ),
    );
  }
}

String _time(BuildContext context, DateTime value) {
  return TimeOfDay.fromDateTime(value.toLocal()).format(context);
}
