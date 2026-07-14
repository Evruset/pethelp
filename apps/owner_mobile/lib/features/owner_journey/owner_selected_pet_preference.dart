import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

abstract class OwnerSelectedPetPreference {
  Future<String?> read(String ownerId);
  Future<void> write(String ownerId, String petId);
  Future<void> clear(String ownerId);
}

class SharedPreferencesOwnerSelectedPetPreference
    implements OwnerSelectedPetPreference {
  static const _prefix = 'owner.selectedPet.v50.';

  @override
  Future<String?> read(String ownerId) async =>
      (await SharedPreferences.getInstance()).getString('$_prefix$ownerId');

  @override
  Future<void> write(String ownerId, String petId) async {
    await (await SharedPreferences.getInstance())
        .setString('$_prefix$ownerId', petId);
  }

  @override
  Future<void> clear(String ownerId) async {
    await (await SharedPreferences.getInstance()).remove('$_prefix$ownerId');
  }
}

String? safeOwnerSubjectFromJwt(String token) {
  final parts = token.split('.');
  if (parts.length != 3) return null;
  try {
    final payload =
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
    final json = jsonDecode(payload);
    final subject = json is Map<String, dynamic> ? json['sub'] : null;
    return subject is String && subject.isNotEmpty ? subject : null;
  } on Object {
    return null;
  }
}
