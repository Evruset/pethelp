import 'dart:async';

import 'package:livekit_client/livekit_client.dart' as livekit;

import 'telemed_models.dart';

enum MediaConnectionStatus { idle, connecting, connected, reconnecting, disconnected, unstable }

class MediaViewState {
  const MediaViewState({
    required this.connection,
    required this.microphoneEnabled,
    required this.cameraEnabled,
    this.remoteVideoTrack,
    this.localVideoTrack,
  });

  final MediaConnectionStatus connection;
  final bool microphoneEnabled;
  final bool cameraEnabled;
  final dynamic remoteVideoTrack;
  final dynamic localVideoTrack;

  MediaViewState copyWith({
    MediaConnectionStatus? connection,
    bool? microphoneEnabled,
    bool? cameraEnabled,
    dynamic remoteVideoTrack,
    dynamic localVideoTrack,
  }) =>
      MediaViewState(
        connection: connection ?? this.connection,
        microphoneEnabled: microphoneEnabled ?? this.microphoneEnabled,
        cameraEnabled: cameraEnabled ?? this.cameraEnabled,
        remoteVideoTrack: remoteVideoTrack ?? this.remoteVideoTrack,
        localVideoTrack: localVideoTrack ?? this.localVideoTrack,
      );

  static const initial = MediaViewState(
    connection: MediaConnectionStatus.idle,
    microphoneEnabled: true,
    cameraEnabled: true,
  );
}

abstract interface class TelemedMediaGateway {
  Stream<MediaViewState> get states;
  MediaViewState get current;
  Future<void> connect(TelemedRoomToken token);
  Future<void> setMicrophoneEnabled(bool enabled);
  Future<void> setCameraEnabled(bool enabled);
  Future<void> disconnect();
  void dispose();
}

class LiveKitMediaGateway implements TelemedMediaGateway {
  final _controller = StreamController<MediaViewState>.broadcast();
  dynamic _room;
  MediaViewState _current = MediaViewState.initial;

  @override
  Stream<MediaViewState> get states => _controller.stream;

  @override
  MediaViewState get current => _current;

  @override
  Future<void> connect(TelemedRoomToken token) async {
    _emit(_current.copyWith(connection: MediaConnectionStatus.connecting));
    final room = livekit.Room();
    _room = room;
    room.addListener(_onRoomChanged);
    await room.connect(token.livekitUrl, token.accessToken);
    _emit(_current.copyWith(connection: MediaConnectionStatus.connected));
    _onRoomChanged();
  }

  @override
  Future<void> setMicrophoneEnabled(bool enabled) async {
    await _room?.localParticipant?.setMicrophoneEnabled(enabled);
    _emit(_current.copyWith(microphoneEnabled: enabled));
  }

  @override
  Future<void> setCameraEnabled(bool enabled) async {
    await _room?.localParticipant?.setCameraEnabled(enabled);
    _emit(_current.copyWith(cameraEnabled: enabled));
    _onRoomChanged();
  }

  @override
  Future<void> disconnect() async {
    await _room?.disconnect();
    _emit(_current.copyWith(connection: MediaConnectionStatus.disconnected));
  }

  void _onRoomChanged() {
    final room = _room;
    if (room == null) return;
    final connection = _connection(room.connectionState?.toString() ?? '');
    _emit(MediaViewState(
      connection: connection,
      microphoneEnabled: _current.microphoneEnabled,
      cameraEnabled: _current.cameraEnabled,
      remoteVideoTrack: _firstVideoTrack(_firstRemoteParticipant(room.remoteParticipants)),
      localVideoTrack: _firstVideoTrack(room.localParticipant),
    ));
  }

  dynamic _firstRemoteParticipant(dynamic participants) {
    if (participants is Map && participants.values.isNotEmpty) return participants.values.first;
    if (participants is Iterable && participants.isNotEmpty) return participants.first;
    return null;
  }

  dynamic _firstVideoTrack(dynamic participant) {
    final publications = participant?.videoTrackPublications;
    if (publications is Map && publications.values.isNotEmpty) {
      return publications.values.first.track;
    }
    if (publications is Iterable && publications.isNotEmpty) {
      return publications.first.track;
    }
    return null;
  }

  MediaConnectionStatus _connection(String value) {
    final lower = value.toLowerCase();
    if (lower.contains('reconnecting')) return MediaConnectionStatus.reconnecting;
    if (lower.contains('connected')) return MediaConnectionStatus.connected;
    if (lower.contains('connecting')) return MediaConnectionStatus.connecting;
    if (lower.contains('disconnected')) return MediaConnectionStatus.disconnected;
    return MediaConnectionStatus.idle;
  }

  void _emit(MediaViewState state) {
    _current = state;
    if (!_controller.isClosed) _controller.add(state);
  }

  @override
  void dispose() {
    _room?.removeListener(_onRoomChanged);
    _room = null;
    _controller.close();
  }
}
