import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

final Map<String, FutureOr<void> Function()> _callbacks =
    <String, FutureOr<void> Function()>{};
final Map<String, String> _markers = <String, String>{};
const bool _enabled =
    bool.fromEnvironment('VETHELP_ENABLE_E2E_HOOKS', defaultValue: false);

void registerOwnerE2EHook(
  String name,
  FutureOr<void> Function() callback,
) {
  if (!_enabled) return;
  _callbacks[name] = callback;
  _syncWindowObject();
}

void unregisterOwnerE2EHook(String name) {
  if (!_enabled) return;
  _callbacks.remove(name);
  _syncWindowObject();
}

void setOwnerE2EMarker(String name, String value) {
  if (!_enabled) return;
  _markers[name] = value;
  _syncWindowObject();
}

void _syncWindowObject() {
  final api = <String, Object?>{}.jsify() as JSObject;
  for (final entry in _callbacks.entries) {
    api[entry.key] = (() {
      globalContext['vethelpOwnerE2ELastAction'] = entry.key.toJS;
      globalContext['vethelpOwnerE2ELastError'] = null;
      try {
        final result = entry.value();
        if (result is Future<void>) {
          result.catchError((Object error) {
            globalContext['vethelpOwnerE2ELastError'] = error.toString().toJS;
          });
        }
      } catch (error) {
        globalContext['vethelpOwnerE2ELastError'] = error.toString().toJS;
      }
    }).toJS;
  }
  api['markers'] = _markers.jsify();
  globalContext['vethelpOwnerE2E'] = api;
  globalContext['vethelpOwnerE2EReady'] = true.toJS;
}
