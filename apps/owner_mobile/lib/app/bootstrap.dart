import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/auth/secure_token_store.dart';
import '../core/config/app_config.dart';
import '../core/offline/cipher_material.dart';
import '../core/offline/local_hive_store.dart';
import 'owner_app.dart';
import 'providers.dart';

Future<Widget> bootstrap() async {
  const platformStore = FlutterSecureStorage();
  final config = AppConfig.fromEnvironment();
  final localStore = LocalHiveStore(await CipherMaterial(platformStore).load());
  await localStore.initialize();
  final credentialStore = SecureTokenStore(platformStore);

  return ProviderScope(
    overrides: <Override>[
      appConfigProvider.overrideWithValue(config),
      localHiveStoreProvider.overrideWithValue(localStore),
      secureTokenStoreProvider.overrideWithValue(credentialStore),
    ],
    child: const VetHelpOwnerApp(),
  );
}
