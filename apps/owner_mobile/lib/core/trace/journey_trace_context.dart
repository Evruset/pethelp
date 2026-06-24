import 'package:uuid/uuid.dart';

class JourneyTraceContext {
  JourneyTraceContext(this._uuid);

  final Uuid _uuid;
  String? _currentId;

  String get currentId => _currentId ??= _uuid.v4();

  void beginNewJourney() {
    _currentId = _uuid.v4();
  }
}
