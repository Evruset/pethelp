class OwnerPet {
  const OwnerPet({
    required this.id,
    required this.name,
    required this.species,
    this.breed,
    this.birthDate,
    this.ageMonths,
    this.sex,
    this.gender,
    this.weightKg,
    this.sterilized,
    this.isSterilized,
    this.chipNumber,
    this.allergies = const <String>[],
    this.chronicConditions = const <String>[],
    this.vaccinationNotes,
    this.photoUrl,
    this.insurancePolicyLinks = const <String>[],
    this.profileVersion = 1,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String species;
  final String? breed;
  final DateTime? birthDate;
  final int? ageMonths;
  final String? sex;
  final String? gender;
  final String? weightKg;
  final bool? sterilized;
  final bool? isSterilized;
  final String? chipNumber;
  final List<String> allergies;
  final List<String> chronicConditions;
  final String? vaccinationNotes;
  final String? photoUrl;
  final List<String> insurancePolicyLinks;
  final int profileVersion;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}
