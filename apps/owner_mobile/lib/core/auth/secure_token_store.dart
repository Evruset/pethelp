import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureTokenStore {
  SecureTokenStore(this._storage);

  static const _key = 'vethelp.session.credential';
  final FlutterSecureStorage _storage;

  Future<String?> read() => _storage.read(key: _key);

  Future<void> write(String value) => _storage.write(key: _key, value: value);

  Future<void> clear() => _storage.delete(key: _key);
}
