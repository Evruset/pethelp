class ServerClock {
  Duration _offset = Duration.zero;

  DateTime now() => DateTime.now().toUtc().add(_offset);

  void synchronize(String serverNowIso8601) {
    final serverNow = DateTime.parse(serverNowIso8601).toUtc();
    _offset = serverNow.difference(DateTime.now().toUtc());
  }

  Duration remainingUntil(String expiresAtIso8601) {
    return DateTime.parse(expiresAtIso8601).toUtc().difference(now());
  }
}
