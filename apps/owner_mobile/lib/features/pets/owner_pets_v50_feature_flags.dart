import 'package:flutter/foundation.dart';

const ownerV50PetsFlagName = 'OWNER_V50_PETS';
const ownerV50PetProfileFlagName = 'OWNER_V50_PET_PROFILE';
const ownerV50PetDiaryFlagName = 'OWNER_V50_PET_DIARY';

bool resolveOwnerV50PetsFlag({String? value, required bool shellEnabled}) =>
    value == 'true' && shellEnabled;

bool resolveOwnerV50PetProfileFlag({
  String? value,
  required bool shellEnabled,
  required bool petsEnabled,
}) =>
    value == 'true' && shellEnabled && petsEnabled;

bool resolveOwnerV50PetDiaryFlag({
  String? value,
  required bool shellEnabled,
  required bool petsEnabled,
  required bool profileEnabled,
}) =>
    value == 'true' && shellEnabled && petsEnabled && profileEnabled;

bool _reportedInvalidFlags = false;

OwnerPetsV50Flags ownerPetsV50Flags({required bool shellEnabled}) {
  const petsRequested = String.fromEnvironment(ownerV50PetsFlagName);
  const profileRequested = String.fromEnvironment(ownerV50PetProfileFlagName);
  const diaryRequested = String.fromEnvironment(ownerV50PetDiaryFlagName);
  final pets = resolveOwnerV50PetsFlag(
    value: petsRequested,
    shellEnabled: shellEnabled,
  );
  final profile = resolveOwnerV50PetProfileFlag(
    value: profileRequested,
    shellEnabled: shellEnabled,
    petsEnabled: pets,
  );
  final diary = resolveOwnerV50PetDiaryFlag(
    value: diaryRequested,
    shellEnabled: shellEnabled,
    petsEnabled: pets,
    profileEnabled: profile,
  );
  if (!_reportedInvalidFlags &&
      ((petsRequested == 'true' && !pets) ||
          (profileRequested == 'true' && !profile) ||
          (diaryRequested == 'true' && !diary))) {
    _reportedInvalidFlags = true;
    debugPrint(
      'Owner V50 pets flags require the V50 shell and their parent flags; using legacy flow.',
    );
  }
  return OwnerPetsV50Flags(pets: pets, profile: profile, diary: diary);
}

class OwnerPetsV50Flags {
  const OwnerPetsV50Flags({
    required this.pets,
    required this.profile,
    required this.diary,
  });

  final bool pets;
  final bool profile;
  final bool diary;
}
