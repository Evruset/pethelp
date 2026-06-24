import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class CipherMaterial {
  CipherMaterial(this._store);

  final FlutterSecureStorage _store;

  Future<List<int>> load() async {
    const name = 'vethelp.hive.key';
    final saved = await _store.read(key: name);
    if (saved != null && saved.isNotEmpty) return base64Url.decode(saved);

    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    await _store.write(key: name, value: base64UrlEncode(bytes));
    return bytes;
  }
}
