class OwnerHomeSnapshot {
  const OwnerHomeSnapshot({
    required this.schemaVersion,
    required this.serverNow,
    required this.pets,
    required this.selectedPet,
    required this.selectionSource,
    required this.nextAction,
    required this.activeCare,
  });

  final int schemaVersion;
  final DateTime serverNow;
  final List<OwnerHomePet> pets;
  final OwnerHomePet? selectedPet;
  final String selectionSource;
  final OwnerHomeAction nextAction;
  final OwnerHomeActiveCare? activeCare;

  factory OwnerHomeSnapshot.fromJson(Map<String, dynamic> json) {
    if (json['schemaVersion'] != 1) {
      throw const FormatException('Unsupported owner home schema.');
    }
    final serverNow = DateTime.tryParse(json['serverNow'] as String? ?? '');
    final petsJson = json['pets'];
    final selectionSource = json['selectionSource'];
    if (serverNow == null ||
        petsJson is! List ||
        selectionSource is! String ||
        !const {'REQUESTED', 'DEFAULT', 'NONE'}.contains(selectionSource) ||
        !json.containsKey('selectedPet') ||
        !json.containsKey('nextAction') ||
        !json.containsKey('activeCare')) {
      throw const FormatException('Malformed owner home response.');
    }
    final pets = petsJson
        .map((value) => OwnerHomePet.fromJson(_map(value)))
        .toList(growable: false);
    final selectedJson = json['selectedPet'];
    final selected =
        selectedJson == null ? null : OwnerHomePet.fromJson(_map(selectedJson));
    if (selected != null && !pets.any((pet) => pet.id == selected.id)) {
      throw const FormatException(
          'Selected pet is outside authoritative pets.');
    }
    final activeCareJson = json['activeCare'];
    return OwnerHomeSnapshot(
      schemaVersion: 1,
      serverNow: serverNow.toUtc(),
      pets: pets,
      selectedPet: selected,
      selectionSource: selectionSource,
      nextAction: OwnerHomeAction.safeFromJson(json['nextAction']),
      activeCare: activeCareJson == null
          ? null
          : OwnerHomeActiveCare.safeFromJson(activeCareJson),
    );
  }
}

class OwnerHomePet {
  const OwnerHomePet({
    required this.id,
    required this.name,
    required this.species,
    this.breed,
    this.photoUrl,
  });

  final String id;
  final String name;
  final String species;
  final String? breed;
  final String? photoUrl;

  factory OwnerHomePet.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final name = json['name'];
    final species = json['species'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        species is! String) {
      throw const FormatException('Malformed owner home pet.');
    }
    return OwnerHomePet(
      id: id,
      name: name,
      species: species,
      breed: json['breed'] as String?,
      photoUrl: json['photoUrl'] as String?,
    );
  }
}

class OwnerHomeAction {
  const OwnerHomeAction({
    required this.type,
    required this.priority,
    required this.sourceType,
    required this.sourceId,
    required this.title,
    required this.description,
    required this.deadlineAt,
    required this.actionCode,
    this.isSafeFallback = false,
  });

  static const fallbackTitle = 'Статус помощи обновился.';
  static const fallbackDescription =
      'Откройте раздел записей, чтобы посмотреть детали.';

  final String type;
  final String priority;
  final String sourceType;
  final String? sourceId;
  final String title;
  final String description;
  final DateTime? deadlineAt;
  final String actionCode;
  final bool isSafeFallback;

  static const actionCodes = {
    'OPEN_EMERGENCY',
    'OPEN_ALTERNATIVE_SLOT',
    'OPEN_TELEMED',
    'OPEN_APPOINTMENT',
    'OPEN_CATALOG',
    'ADD_PET',
    'NONE',
  };

  static OwnerHomeAction safeFromJson(dynamic value) {
    try {
      final json = _map(value);
      final type = _requiredString(json, 'type');
      final priority = _requiredString(json, 'priority');
      final sourceType = _requiredString(json, 'sourceType');
      final title = _requiredString(json, 'title');
      final description = _requiredString(json, 'description');
      final actionCode = _requiredString(json, 'actionCode');
      final deadline = _optionalDate(json['deadlineAt']);
      if (!actionCodes.contains(actionCode) ||
          !const {'CRITICAL', 'HIGH', 'NORMAL', 'LOW'}.contains(priority)) {
        return fallback();
      }
      return OwnerHomeAction(
        type: type,
        priority: priority,
        sourceType: sourceType,
        sourceId: json['sourceId'] as String?,
        title: title,
        description: description,
        deadlineAt: deadline,
        actionCode: actionCode,
      );
    } on Object {
      return fallback();
    }
  }

  static OwnerHomeAction fallback() => const OwnerHomeAction(
        type: 'UNKNOWN',
        priority: 'NORMAL',
        sourceType: 'NONE',
        sourceId: null,
        title: fallbackTitle,
        description: fallbackDescription,
        deadlineAt: null,
        actionCode: 'OPEN_APPOINTMENT',
        isSafeFallback: true,
      );
}

class OwnerHomeActiveCare {
  const OwnerHomeActiveCare({
    required this.sourceType,
    required this.sourceId,
    required this.statusCode,
    required this.title,
    required this.description,
    required this.startsAt,
    required this.deadlineAt,
    required this.clinicName,
    required this.petId,
    required this.actionCode,
  });

  final String sourceType;
  final String sourceId;
  final String statusCode;
  final String title;
  final String description;
  final DateTime? startsAt;
  final DateTime? deadlineAt;
  final String? clinicName;
  final String petId;
  final String actionCode;

  static OwnerHomeActiveCare? safeFromJson(dynamic value) {
    try {
      final json = _map(value);
      final actionCode = _requiredString(json, 'actionCode');
      if (!const {
        'OPEN_EMERGENCY',
        'OPEN_ALTERNATIVE_SLOT',
        'OPEN_TELEMED',
        'OPEN_APPOINTMENT',
        'NONE',
      }.contains(actionCode)) {
        return null;
      }
      return OwnerHomeActiveCare(
        sourceType: _requiredString(json, 'sourceType'),
        sourceId: _requiredString(json, 'sourceId'),
        statusCode: _requiredString(json, 'statusCode'),
        title: _requiredString(json, 'title'),
        description: _requiredString(json, 'description'),
        startsAt: _optionalDate(json['startsAt']),
        deadlineAt: _optionalDate(json['deadlineAt']),
        clinicName: json['clinicName'] as String?,
        petId: _requiredString(json, 'petId'),
        actionCode: actionCode,
      );
    } on Object {
      return null;
    }
  }
}

Map<String, dynamic> _map(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  throw const FormatException('Expected object.');
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) throw FormatException('Missing $key.');
  return value;
}

DateTime? _optionalDate(dynamic value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('Expected timestamp.');
  final parsed = DateTime.tryParse(value);
  if (parsed == null) throw const FormatException('Invalid timestamp.');
  return parsed.toUtc();
}
