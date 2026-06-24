import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:livekit_client/livekit_client.dart' as livekit;

import 'livekit_media_gateway.dart';
import 'telemed_bloc.dart';
import 'telemed_models.dart';

class TelemedCallView extends StatefulWidget {
  const TelemedCallView({required this.snapshot, required this.media, super.key});
  final TelemedSnapshot snapshot;
  final MediaViewState media;

  @override
  State<TelemedCallView> createState() => _TelemedCallViewState();
}

class _TelemedCallViewState extends State<TelemedCallView> {
  Offset _pip = const Offset(16, 16);

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<TelemedBloc>();
    final warning = widget.media.connection == MediaConnectionStatus.reconnecting || widget.media.connection == MediaConnectionStatus.unstable;
    return Stack(
      children: <Widget>[
        Positioned.fill(child: VideoSurface(track: widget.media.remoteVideoTrack, title: 'Видео врача')),
        if (warning) Positioned(top: 12, left: 16, right: 16, child: ConnectionWarning(connection: widget.media.connection)),
        Positioned(
          right: _pip.dx,
          top: _pip.dy,
          child: GestureDetector(
            onPanUpdate: (details) => setState(() {
              _pip = Offset((_pip.dx - details.delta.dx).clamp(8, 160), (_pip.dy + details.delta.dy).clamp(8, 360));
            }),
            child: SizedBox(width: 112, height: 150, child: VideoSurface(track: widget.media.localVideoTrack, title: 'Вы')),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 20,
          child: SafeArea(
            top: false,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: <Widget>[
                CallControl(icon: widget.media.microphoneEnabled ? Icons.mic : Icons.mic_off, label: widget.media.microphoneEnabled ? 'Микрофон включён' : 'Микрофон выключен', onTap: () => bloc.add(TelemedMicrophoneToggled(!widget.media.microphoneEnabled))),
                CallControl(icon: widget.media.cameraEnabled ? Icons.videocam : Icons.videocam_off, label: widget.media.cameraEnabled ? 'Камера включена' : 'Камера выключена', onTap: () => bloc.add(TelemedCameraToggled(!widget.media.cameraEnabled))),
                CallControl(icon: Icons.call_end, label: 'Завершить консультацию', destructive: true, onTap: () => bloc.add(const TelemedHangupPressed())),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class VideoSurface extends StatelessWidget {
  const VideoSurface({required this.track, required this.title, super.key});
  final dynamic track;
  final String title;

  @override
  Widget build(BuildContext context) {
    if (track != null) {
      return ClipRRect(borderRadius: BorderRadius.circular(14), child: livekit.VideoTrackRenderer(track));
    }
    return DecoratedBox(
      decoration: BoxDecoration(color: const Color(0xFF101828), borderRadius: BorderRadius.circular(14)),
      child: Center(child: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
    );
  }
}

class ConnectionWarning extends StatelessWidget {
  const ConnectionWarning({required this.connection, super.key});
  final MediaConnectionStatus connection;

  @override
  Widget build(BuildContext context) {
    final text = connection == MediaConnectionStatus.reconnecting ? 'Восстанавливаем соединение' : 'Соединение нестабильно';
    return DecoratedBox(
      decoration: BoxDecoration(color: const Color(0xFFFFFAEB), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFEC84B))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: <Widget>[const Icon(Icons.network_check, color: Color(0xFF9E4A03)), const SizedBox(width: 8), Text(text)]),
      ),
    );
  }
}

class CallControl extends StatelessWidget {
  const CallControl({required this.icon, required this.label, required this.onTap, this.destructive = false, super.key});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: InkResponse(
        onTap: onTap,
        radius: 34,
        child: CircleAvatar(
          radius: 28,
          backgroundColor: destructive ? const Color(0xFFB42318) : Colors.white,
          child: Icon(icon, color: destructive ? Colors.white : const Color(0xFF101828)),
        ),
      ),
    );
  }
}
