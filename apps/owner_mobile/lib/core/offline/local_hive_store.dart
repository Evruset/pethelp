import 'package:hive_flutter/hive_flutter.dart';

class LocalHiveStore {
  LocalHiveStore(this._cipherKey);

  static const outboxBoxName = 'vethelp.outbox';
  static const metadataBoxName = 'vethelp.metadata';
  final List<int> _cipherKey;

  Future<void> initialize() async {
    await Hive.initFlutter();
    final cipher = HiveAesCipher(_cipherKey);
    await Future.wait<void>(<Future<void>>[
      Hive.openBox<dynamic>(outboxBoxName, encryptionCipher: cipher),
      Hive.openBox<dynamic>(metadataBoxName, encryptionCipher: cipher),
    ]);
  }

  Box<dynamic> outboxBox() => Hive.box<dynamic>(outboxBoxName);
  Box<dynamic> metadataBox() => Hive.box<dynamic>(metadataBoxName);
}
