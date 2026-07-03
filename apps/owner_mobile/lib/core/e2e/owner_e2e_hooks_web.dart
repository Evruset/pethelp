// ignore_for_file: avoid_web_libraries_in_flutter

import 'dart:async';
import 'dart:js' as js;

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
  final api = js.JsObject.jsify(<String, Object?>{});
  for (final entry in _callbacks.entries) {
    api[entry.key] = js.allowInterop(() {
      js.context['vethelpOwnerE2ELastAction'] = entry.key;
      js.context['vethelpOwnerE2ELastError'] = null;
      try {
        final result = entry.value();
        if (result is Future<void>) {
          result.catchError((Object error) {
            js.context['vethelpOwnerE2ELastError'] = error.toString();
          });
        }
      } catch (error) {
        js.context['vethelpOwnerE2ELastError'] = error.toString();
      }
    });
  }
  api['markers'] = js.JsObject.jsify(_markers);
  js.context['vethelpOwnerE2E'] = api;
  js.context['vethelpOwnerE2EReady'] = true;
}
