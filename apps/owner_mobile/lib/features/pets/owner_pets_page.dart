import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'owner_pet.dart';
import 'owner_pet_repository.dart';

class OwnerPetsPage extends StatefulWidget {
  const OwnerPetsPage({
    super.key,
    required this.repository,
    required this.onPetSelected,
  });

  final OwnerPetRepository repository;
  final ValueChanged<OwnerPet> onPetSelected;

  @override
  State<OwnerPetsPage> createState() => _OwnerPetsPageState();
}

class _OwnerPetsPageState extends State<OwnerPetsPage> {
  Future<List<OwnerPet>>? _request;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    final request = widget.repository.list();
    setState(() {
      _request = request;
    });
  }

  Future<void> _createPet() async {
    if (_busy) return;
    final pet = await showModalBottomSheet<OwnerPet>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PetForm(
        onSubmit: widget.repository.create,
      ),
    );
    if (pet == null || !mounted) return;
    widget.onPetSelected(pet);
    _reload();
    _message('${pet.name} добавлен и выбран для записи.');
  }

  Future<void> _editPet(OwnerPet summary) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final fresh = await widget.repository.read(summary.id);
      if (!mounted) return;
      setState(() => _busy = false);
      final updated = await showModalBottomSheet<OwnerPet>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _PetForm(
          initial: fresh,
          onSubmit: (input) => widget.repository.update(
            petId: fresh.id,
            profileVersion: fresh.profileVersion,
            input: input,
          ),
        ),
      );
      if (updated == null || !mounted) return;
      widget.onPetSelected(updated);
      _reload();
      _message('Профиль ${updated.name} обновлён.');
    } on OwnerPetApiException catch (error) {
      if (!mounted) return;
      _message(error.statusCode == 412
          ? 'Профиль изменился. Откройте его заново.'
          : 'Не удалось сохранить профиль. Повторите попытку.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _message(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<OwnerPet>>(
      future: _request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: FilledButton.icon(
              onPressed: _reload,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить загрузку'),
            ),
          );
        }
        final pets = snapshot.data ?? const <OwnerPet>[];
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: _busy ? null : _createPet,
            icon: const Icon(Icons.add),
            label: const Text('Добавить питомца'),
          ),
          body: pets.isEmpty
              ? const _PetsEmpty()
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 96),
                  itemCount: pets.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) => _PetCard(
                    pet: pets[index],
                    onSelect:
                        _busy ? null : () => widget.onPetSelected(pets[index]),
                    onEdit: _busy ? null : () => _editPet(pets[index]),
                  ),
                ),
        );
      },
    );
  }
}

class _PetCard extends StatelessWidget {
  const _PetCard({
    required this.pet,
    required this.onSelect,
    required this.onEdit,
  });

  final OwnerPet pet;
  final VoidCallback? onSelect;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final details = <String>[
      _speciesTitle(pet.species),
      if (pet.breed != null) pet.breed!,
      if (pet.weightKg != null) '${pet.weightKg} кг',
    ];
    final health = <String>[
      if (pet.allergies.isNotEmpty)
        'Аллергии: ${pet.allergies.take(2).join(', ')}',
      if (pet.chronicConditions.isNotEmpty)
        'Хроника: ${pet.chronicConditions.take(2).join(', ')}',
      if (pet.sterilized != null)
        pet.sterilized! ? 'Стерилизован(а)' : 'Не стерилизован(а)',
    ];
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 8, 8),
        child: Row(
          children: [
            Expanded(
              child: ListTile(
                onTap: onSelect,
                leading: const CircleAvatar(child: Icon(Icons.pets)),
                title: Text(pet.name),
                subtitle: Text([
                  details.join(' · '),
                  if (health.isNotEmpty) health.join('\n'),
                ].join('\n')),
                isThreeLine: health.isNotEmpty,
              ),
            ),
            IconButton(
              tooltip: 'Профиль',
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined),
            ),
          ],
        ),
      ),
    );
  }
}

class _PetsEmpty extends StatelessWidget {
  const _PetsEmpty();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('Добавьте питомца, чтобы продолжить запись в клинику.'),
        ),
      );
}

class _PetForm extends StatefulWidget {
  const _PetForm({this.initial, required this.onSubmit});

  final OwnerPet? initial;
  final Future<OwnerPet> Function(OwnerPetProfileInput input) onSubmit;

  @override
  State<_PetForm> createState() => _PetFormState();
}

class _PetFormState extends State<_PetForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _breed;
  late final TextEditingController _birthDate;
  late final TextEditingController _weight;
  late final TextEditingController _allergies;
  late final TextEditingController _chronicConditions;
  late final TextEditingController _vaccinationNotes;
  late final TextEditingController _photoUrl;
  late final TextEditingController _insuranceLinks;
  late String _species;
  String? _sex;
  bool? _sterilized;
  bool _submittedOnce = false;
  _PetSubmitState _submitState = _PetSubmitState.idle;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _name = TextEditingController(text: initial?.name);
    _breed = TextEditingController(text: initial?.breed);
    _birthDate = TextEditingController(
        text: initial?.birthDate == null ? '' : _dateOnly(initial!.birthDate!));
    _weight = TextEditingController(text: initial?.weightKg);
    _allergies = TextEditingController(text: initial?.allergies.join(', '));
    _chronicConditions =
        TextEditingController(text: initial?.chronicConditions.join(', '));
    _vaccinationNotes = TextEditingController(text: initial?.vaccinationNotes);
    _photoUrl = TextEditingController(text: initial?.photoUrl);
    _insuranceLinks =
        TextEditingController(text: initial?.insurancePolicyLinks.join(', '));
    _species = initial?.species ?? 'DOG';
    _sex = initial?.sex;
    _sterilized = initial?.sterilized;
  }

  @override
  void dispose() {
    _name.dispose();
    _breed.dispose();
    _birthDate.dispose();
    _weight.dispose();
    _allergies.dispose();
    _chronicConditions.dispose();
    _vaccinationNotes.dispose();
    _photoUrl.dispose();
    _insuranceLinks.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottom),
        child: Form(
          key: _formKey,
          autovalidateMode: _submittedOnce
              ? AutovalidateMode.onUserInteraction
              : AutovalidateMode.disabled,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(widget.initial == null ? 'Новый питомец' : 'Профиль питомца',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                autofocus: widget.initial == null,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Имя питомца',
                ),
                validator: _validateName,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'DOG', label: Text('Собака')),
                  ButtonSegment(value: 'CAT', label: Text('Кошка')),
                  ButtonSegment(value: 'OTHER', label: Text('Другое')),
                ],
                selected: {_species},
                onSelectionChanged: (value) =>
                    setState(() => _species = value.single),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _breed,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Порода',
                ),
                validator: _validateOptionalShortText,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _birthDate,
                      keyboardType: TextInputType.datetime,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Дата рождения',
                        hintText: 'ГГГГ-ММ-ДД',
                      ),
                      validator: _validateBirthDate,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _weight,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Вес, кг',
                      ),
                      validator: _validateWeight,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                emptySelectionAllowed: true,
                segments: const [
                  ButtonSegment(value: 'MALE', label: Text('М')),
                  ButtonSegment(value: 'FEMALE', label: Text('Ж')),
                  ButtonSegment(value: 'UNKNOWN', label: Text('?')),
                ],
                selected: _sex == null ? const <String>{} : {_sex!},
                onSelectionChanged: (value) =>
                    setState(() => _sex = value.isEmpty ? null : value.single),
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _sterilized ?? false,
                onChanged: (value) => setState(() => _sterilized = value),
                title: const Text('Стерилизация'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _allergies,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Аллергии',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _chronicConditions,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Хронические состояния',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _vaccinationNotes,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Вакцинация',
                ),
                validator: _validateLongText,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _photoUrl,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Фото',
                ),
                validator: _validateUrl,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _insuranceLinks,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Полисы',
                ),
                validator: _validateLinks,
              ),
              if (_submitError != null) ...[
                const SizedBox(height: 12),
                Text(_submitError!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 16),
              AnimatedScale(
                scale: _submitState == _PetSubmitState.success ? 1.02 : 1,
                duration: const Duration(milliseconds: 160),
                child: FilledButton(
                  onPressed:
                      _submitState == _PetSubmitState.loading ? null : _submit,
                  child: _submitState == _PetSubmitState.loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : _submitState == _PetSubmitState.success
                          ? const Icon(Icons.check)
                          : const Text('Сохранить'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _submittedOnce = true;
      _submitError = null;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitState = _PetSubmitState.loading);
    try {
      final pet = await widget.onSubmit(OwnerPetProfileInput(
        name: _name.text.trim(),
        species: _species,
        breed: _emptyToNull(_breed.text),
        birthDate: _birthDate.text.trim().isEmpty
            ? null
            : DateTime.parse(_birthDate.text.trim()),
        sex: _sex,
        weightKg: _weight.text.trim().isEmpty
            ? null
            : double.parse(_weight.text.trim().replaceAll(',', '.')),
        sterilized: _sterilized,
        allergies: _split(_allergies.text),
        chronicConditions: _split(_chronicConditions.text),
        vaccinationNotes: _emptyToNull(_vaccinationNotes.text),
        photoUrl: _emptyToNull(_photoUrl.text),
        insurancePolicyLinks: _split(_insuranceLinks.text),
        mutationId: 'owner-mobile-${DateTime.now().microsecondsSinceEpoch}',
      ));
      if (!mounted) return;
      setState(() => _submitState = _PetSubmitState.success);
      await HapticFeedback.mediumImpact();
      if (!mounted) return;
      Navigator.of(context).pop(pet);
    } on OwnerPetApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitState = _PetSubmitState.failure;
        _submitError = _petError(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitState = _PetSubmitState.failure;
        _submitError =
            'Не удалось сохранить профиль. Проверьте соединение и повторите попытку.';
      });
    }
  }
}

enum _PetSubmitState { idle, loading, success, failure }

String? _validateName(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.length < 2) return 'Введите имя питомца';
  if (normalized.length > 64) return 'Имя должно быть не длиннее 64 символов';
  if (RegExp(r'[<>{}\[\]\\/@#$%^&*_+=|~`]').hasMatch(normalized)) {
    return 'Введите имя без технических символов';
  }
  return null;
}

String? _validateOptionalShortText(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.length > 120) return 'Слишком длинное значение';
  return null;
}

String? _validateBirthDate(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.isEmpty) return null;
  final parsed = DateTime.tryParse(normalized);
  if (parsed == null || _dateOnly(parsed) != normalized) {
    return 'Укажите дату в формате ГГГГ-ММ-ДД';
  }
  final today = DateTime.now();
  final todayStart = DateTime(today.year, today.month, today.day);
  if (parsed.isAfter(todayStart)) {
    return 'Дата рождения не может быть в будущем';
  }
  return null;
}

String? _validateWeight(String? value) {
  final normalized = value?.trim().replaceAll(',', '.') ?? '';
  if (normalized.isEmpty) return null;
  final parsed = double.tryParse(normalized);
  if (parsed == null || parsed < 0.1 || parsed > 200) {
    return 'Укажите вес от 0,1 до 200 кг';
  }
  return null;
}

String? _validateLongText(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.length > 2000) return 'Слишком длинное описание';
  return null;
}

String? _validateUrl(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.isEmpty) return null;
  final uri = Uri.tryParse(normalized);
  if (uri == null || !uri.hasScheme) return 'Укажите ссылку на фото';
  return null;
}

String? _validateLinks(String? value) {
  final links = _split(value ?? '');
  for (final link in links) {
    final uri = Uri.tryParse(link);
    if (uri == null || !uri.hasScheme) return 'Укажите ссылки через запятую';
  }
  return null;
}

String _petError(OwnerPetApiException error) {
  return switch (error.code) {
    'INVALID_PET_NAME' => 'Введите имя питомца',
    'PET_PROFILE_VERSION_MISMATCH' => 'Профиль изменился. Откройте его заново.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось сохранить профиль. Повторите попытку.',
  };
}

String? _emptyToNull(String value) {
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}

List<String> _split(String value) {
  return value
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

String _dateOnly(DateTime value) {
  return '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
}

String _speciesTitle(String value) => switch (value) {
      'DOG' => 'Собака',
      'CAT' => 'Кошка',
      _ => 'Другой вид',
    };
