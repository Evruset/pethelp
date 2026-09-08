import 'package:flutter/material.dart';

import 'owner_pet.dart';
import 'owner_pet_repository.dart';
import 'owner_pets_page.dart';
import 'owner_v50_pet_visuals.dart';

class OwnerPetProfileV50Page extends StatefulWidget {
  const OwnerPetProfileV50Page({
    super.key,
    required this.pet,
    required this.repository,
    required this.onPetChanged,
    required this.onOpenDiary,
    required this.onArchiveResolved,
    this.initialStatusMessage,
    this.readOnly = false,
  });

  final OwnerPet pet;
  final OwnerPetRepository repository;
  final ValueChanged<OwnerPet> onPetChanged;
  final VoidCallback? onOpenDiary;
  final ValueChanged<OwnerPet> onArchiveResolved;
  final String? initialStatusMessage;
  final bool readOnly;

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
    final facts = <_ProfileFact>[
      if (_pet.weightKg != null)
        _ProfileFact(
            'Вес', '${_pet.weightKg} кг', Icons.monitor_weight_outlined),
      if (_pet.sex != null || _pet.gender != null)
        _ProfileFact('Пол', _pet.sex ?? _pet.gender!, Icons.wc_outlined),
      if (_pet.sterilized != null || _pet.isSterilized != null)
        _ProfileFact(
          'Стерилизация',
          (_pet.sterilized ?? _pet.isSterilized!) ? 'Да' : 'Нет',
          Icons.health_and_safety_outlined,
        ),
      if (_pet.breed != null)
        _ProfileFact('Порода', _pet.breed!, Icons.pets_outlined),
      if (_pet.birthDate != null)
        _ProfileFact(
          'Дата рождения',
          _profileDate(_pet.birthDate!),
          Icons.cake_outlined,
        ),
      if (_pet.chipNumber != null)
        _ProfileFact('Чип', _pet.chipNumber!, Icons.memory_outlined),
    ];
    final effectiveError = _error ?? widget.initialStatusMessage;
    final status = _pet.isArchived
        ? const OwnerV50StatusBanner(
            key: ValueKey('profile-archived-banner'),
            icon: Icons.archive_outlined,
            title: 'Питомец в архиве',
            message:
                'Профиль и история доступны только для просмотра. Изменения отключены.',
          )
        : effectiveError == null
            ? null
            : OwnerV50StatusBanner(
                key: const ValueKey('profile-error-banner'),
                icon: Icons.info_outline,
                title: effectiveError.startsWith('Сессия')
                    ? 'Сессия завершена'
                    : widget.readOnly
                        ? 'Показаны последние данные'
                        : 'Профиль обновлён',
                message: effectiveError,
                warning: effectiveError.startsWith('Сессия'),
              );
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      child: OwnerV50PetPageFrame(
        title: 'Карточка питомца',
        supportingText: [
          _pet.name,
          ownerPetSpeciesLabel(_pet.species),
          _pet.breed,
        ].whereType<String>().join(' · '),
        leading: TextButton(
          key: const ValueKey('profile-back-action'),
          onPressed: () => Navigator.of(context).maybePop(),
          child: const Text('← К списку питомцев'),
        ),
        status: status,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final hero = _ProfileHero(
              pet: _pet,
              onEdit:
                  _busy || _pet.isArchived || widget.readOnly ? null : _edit,
            );
            final details = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (warnings.isNotEmpty) ...[
                  _ProfileWarnings(warnings: warnings),
                  const SizedBox(height: 18),
                ],
                OwnerV50InsetSection(
                  title: 'Основная информация',
                  child: facts.isEmpty
                      ? const Text('Дополнительные сведения пока не указаны.')
                      : _ProfileFacts(facts: facts),
                ),
                const SizedBox(height: 18),
                OwnerV50InsetSection(
                  title: 'Документы и здоровье',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'В дневнике собраны только доступные владельцу визиты, телемедицинские события и документы.',
                      ),
                      const SizedBox(height: 14),
                      FilledButton.icon(
                        key: const ValueKey('profile-diary-action'),
                        onPressed: widget.onOpenDiary,
                        icon: const Icon(Icons.menu_book_outlined),
                        label: const Text('Открыть медкарту и дневник'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  key: const ValueKey('profile-archive-action'),
                  onPressed: _busy || widget.readOnly ? null : _toggleArchive,
                  icon: Icon(_pet.isArchived
                      ? Icons.unarchive_outlined
                      : Icons.archive_outlined),
                  label:
                      Text(_pet.isArchived ? 'Вернуть из архива' : 'В архив'),
                ),
              ],
            );
            if (constraints.maxWidth < 760) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [hero, const SizedBox(height: 18), details],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 360, child: hero),
                const SizedBox(width: 22),
                Expanded(child: details),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.pet, required this.onEdit});

  final OwnerPet pet;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: OwnerV50PetAvatar(pet: pet, size: 220)),
            const SizedBox(height: 18),
            Text(
              pet.name,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              [ownerPetSpeciesLabel(pet.species), pet.breed]
                  .whereType<String>()
                  .join(' · '),
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              key: const ValueKey('profile-edit-action'),
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Редактировать'),
            ),
          ],
        ),
      );
}

class _ProfileWarnings extends StatelessWidget {
  const _ProfileWarnings({required this.warnings});

  final List<String> warnings;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return OwnerV50InsetSection(
      title: 'Особые отметки',
      tone: colors.errorContainer.withValues(alpha: .55),
      child: Column(
        children: [
          for (final warning in warnings)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded,
                      color: colors.onErrorContainer),
                  const SizedBox(width: 10),
                  Expanded(child: Text(warning)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ProfileFact {
  const _ProfileFact(this.label, this.value, this.icon);
  final String label;
  final String value;
  final IconData icon;
}

class _ProfileFacts extends StatelessWidget {
  const _ProfileFacts({required this.facts});
  final List<_ProfileFact> facts;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final fact in facts)
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 150, maxWidth: 260),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Icon(fact.icon,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(fact.label,
                                style: Theme.of(context).textTheme.labelMedium),
                            Text(fact.value,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      );
}

String _profileDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
