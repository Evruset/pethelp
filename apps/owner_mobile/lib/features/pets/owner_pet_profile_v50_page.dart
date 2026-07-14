import 'package:flutter/material.dart';

import 'owner_pet.dart';
import 'owner_pet_repository.dart';
import 'owner_pets_page.dart';

class OwnerPetProfileV50Page extends StatefulWidget {
  const OwnerPetProfileV50Page({
    super.key,
    required this.pet,
    required this.repository,
    required this.onPetChanged,
    required this.onOpenDiary,
    required this.onArchiveResolved,
  });

  final OwnerPet pet;
  final OwnerPetRepository repository;
  final ValueChanged<OwnerPet> onPetChanged;
  final VoidCallback? onOpenDiary;
  final ValueChanged<OwnerPet> onArchiveResolved;

  @override
  State<OwnerPetProfileV50Page> createState() => _OwnerPetProfileV50PageState();
}

class _OwnerPetProfileV50PageState extends State<OwnerPetProfileV50Page> {
  late OwnerPet _pet = widget.pet;
  bool _busy = false;
  String? _error;

  Future<void> _edit() async {
    final result = await showOwnerPetEditorBottomSheet(
      context: context,
      repository: widget.repository,
      pet: _pet,
    );
    if (!mounted || result is! OwnerPetSaved) return;
    setState(() => _pet = result.pet);
    widget.onPetChanged(result.pet);
  }

  Future<void> _toggleArchive() async {
    final repository = widget.repository;
    if (repository is! OwnerPetLifecycleRepository || _busy) {
      setState(() => _error = 'Изменение статуса сейчас недоступно.');
      return;
    }
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(_pet.isArchived
                ? 'Вернуть питомца?'
                : 'Перенести питомца в архив?'),
            content: Text(_pet.isArchived
                ? 'Профиль снова появится среди активных питомцев.'
                : 'История сохранится. Для записей будет выбран другой активный питомец.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Отмена'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(_pet.isArchived ? 'Вернуть' : 'В архив'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final updated = _pet.isArchived
          ? await repository.restore(
              petId: _pet.id,
              profileVersion: _pet.profileVersion,
            )
          : await repository.archive(
              petId: _pet.id,
              profileVersion: _pet.profileVersion,
            );
      if (!mounted) return;
      setState(() => _pet = updated);
      widget.onArchiveResolved(updated);
    } on OwnerPetApiException catch (error) {
      if (!mounted) return;
      if (error.statusCode == 412) {
        try {
          final current = await repository.read(_pet.id);
          if (!mounted) return;
          setState(() {
            _pet = current;
            _error = 'Профиль изменился. Показаны актуальные данные.';
          });
          widget.onPetChanged(current);
        } on Object {
          if (mounted) {
            setState(() => _error = 'Профиль изменился. Повторите загрузку.');
          }
        }
      } else {
        setState(() => _error = error.statusCode == 401
            ? 'Сессия завершена. Войдите снова.'
            : 'Не удалось изменить статус питомца.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final warnings = <String>[
      if (_pet.allergies.isNotEmpty)
        'Аллергии: ${_pet.allergies.join(', ')} · источник: профиль владельца',
      if (_pet.chronicConditions.isNotEmpty)
        'Хронические состояния: ${_pet.chronicConditions.join(', ')} · источник: профиль владельца',
      if (_pet.vaccinationNotes?.isNotEmpty ?? false)
        'Вакцинация: ${_pet.vaccinationNotes} · источник: профиль владельца',
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(_pet.name),
        actions: [
          IconButton(
            tooltip: 'Редактировать профиль',
            onPressed: _busy || _pet.isArchived ? null : _edit,
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_pet.isArchived)
            const Card(
              child: ListTile(
                leading: Icon(Icons.archive_outlined),
                title: Text('Питомец в архиве'),
                subtitle: Text('История доступна только для просмотра.'),
              ),
            ),
          Text(_pet.name, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text([_pet.species, if (_pet.breed != null) _pet.breed].join(' · ')),
          const SizedBox(height: 20),
          if (warnings.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Важные сведения',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    for (final warning in warnings)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(warning),
                      ),
                  ],
                ),
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: widget.onOpenDiary,
            icon: const Icon(Icons.menu_book_outlined),
            label: const Text('Открыть дневник'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _busy ? null : _toggleArchive,
            icon: Icon(_pet.isArchived
                ? Icons.unarchive_outlined
                : Icons.archive_outlined),
            label: Text(_pet.isArchived ? 'Вернуть из архива' : 'В архив'),
          ),
        ],
      ),
    );
  }
}
