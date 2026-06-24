import 'package:uuid/uuid.dart';

import '../offline/local_hive_store.dart';

class OperationIdStore {
  OperationIdStore(this._store, this._uuid);

  final LocalHiveStore _store;
  final Uuid _uuid;

  Future<String> getOrCreate({
    required String operation,
    required String aggregateId,
  }) async {
    final key = 'operation:$operation:$aggregateId';
    final existing = _store.metadataBox().get(key) as String?;
    if (existing != null && existing.isNotEmpty) return existing;
    final created = _uuid.v4();
    await _store.metadataBox().put(key, created);
    return created;
  }

  Future<void> clear({required String operation, required String aggregateId}) {
    return _store.metadataBox().delete('operation:$operation:$aggregateId');
  }
}
