import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/offline/offline_command.dart';
import '../../presentation/platform/owner_platform.dart';
import '../../presentation/widgets/owner_cupertino_feedback.dart';
import 'owner_pet.dart';
import 'owner_pet_files.dart';
import 'owner_pet_repository.dart';

Future<OwnerPetSaveResult?> showOwnerPetEditorBottomSheet({
  required BuildContext context,
  required OwnerPetRepository repository,
  required OwnerPet pet,
  VoidCallback? onFallbackSnapshot,
  ValueChanged<OwnerPet>? onPetChanged,
  Future<OwnerPickedPetFile?> Function(BuildContext context)? pickPhoto,
}) async {
  OwnerPet fresh;
  try {
    fresh = await repository.read(pet.id);
  } catch (_) {
    fresh = pet;
    onFallbackSnapshot?.call();
  }
  if (!context.mounted) return null;
  return showModalBottomSheet<OwnerPetSaveResult>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _PetForm(
      initial: fresh,
      onPetChanged: onPetChanged,
      pickPhoto: pickPhoto ?? _pickPhotoFromSheet,
      onUploadPhoto: (file) => repository.uploadPhoto(
        petId: fresh.id,
        file: file,
      ),
      onDeletePhoto: () => repository.deletePhoto(fresh.id),
      onSubmit: (input) => repository.update(
        petId: fresh.id,
        profileVersion: fresh.profileVersion,
        input: input,
      ),
    ),
  );
}

class OwnerPetsPage extends StatefulWidget {
  const OwnerPetsPage({
    super.key,
    required this.repository,
    required this.onPetSelected,
    this.onOpenPetCare,
    this.platformOverride,
    this.selectedPetId,
    this.onOpenPetProfile,
  });

  final OwnerPetRepository repository;
  final ValueChanged<OwnerPet> onPetSelected;
  final ValueChanged<OwnerPet>? onOpenPetCare;
  final TargetPlatform? platformOverride;
  final String? selectedPetId;
  final ValueChanged<OwnerPet>? onOpenPetProfile;

  @override
  State<OwnerPetsPage> createState() => _OwnerPetsPageState();
}

class _OwnerPetsPageState extends State<OwnerPetsPage> {
  Future<_PetsSnapshot>? _request;
  _PetsSnapshot? _lastSnapshot;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    final request = _loadPets();
    setState(() {
      _request = request;
    });
  }

  Future<_PetsSnapshot> _loadPets() async {
    final pets = await widget.repository.list();
    final entries = await Future.wait(pets.map((pet) async {
      return MapEntry(
        pet.id,
        await widget.repository.profileSyncStates(pet.id),
      );
    }));
    return _PetsSnapshot(
      pets: pets,
      syncStatesByPetId:
          Map<String, List<OwnerPetProfileSyncState>>.fromEntries(
        entries.where((entry) => entry.value.isNotEmpty),
      ),
    );
  }

  Future<void> _createPet() async {
    if (_busy) return;
    final result = await showModalBottomSheet<OwnerPetSaveResult>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PetForm(
        onSubmit: (input) async => OwnerPetSaved(
          await widget.repository.create(input),
        ),
      ),
    );
    if (result is! OwnerPetSaved || !mounted) return;
    widget.onPetSelected(result.pet);
    _reload();
    _message('${result.pet.name} добавлен и выбран для записи.');
  }

  Future<void> _editPet(OwnerPet summary) async {
    if (_busy) return;
    setState(() {
      _busy = true;
    });
    try {
      setState(() {
        _busy = false;
      });
      final result = await showOwnerPetEditorBottomSheet(
        context: context,
        repository: widget.repository,
        pet: summary,
        onPetChanged: (pet) {
          widget.onPetSelected(pet);
          _reload();
        },
        onFallbackSnapshot: () => _message(
          'Открыта последняя загруженная версия. Изменения будут поставлены в очередь.',
        ),
      );
      if (result == null || !mounted) return;
      switch (result) {
        case OwnerPetSaved(:final pet):
          widget.onPetSelected(pet);
          _reload();
          _message('Профиль ${pet.name} обновлён.');
        case OwnerPetUpdateQueued():
          await _refreshSyncStates();
          if (!mounted) return;
          _message(
              'Изменения сохранены в очередь и синхронизируются при соединении.');
      }
    } on OwnerPetApiException catch (error) {
      if (!mounted) {
        return;
      }
      _message(error.statusCode == 412
          ? 'Профиль изменился. Откройте его заново.'
          : 'Не удалось сохранить профиль. Повторите попытку.');
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  void _message(String text) {
    showOwnerMessage(
      context,
      text,
      platform: widget.platformOverride,
    );
  }

  Future<void> _refreshSyncStates() async {
    final current = _lastSnapshot;
    if (current == null) return;
    final entries = await Future.wait(current.pets.map((pet) async {
      return MapEntry(
        pet.id,
        await widget.repository.profileSyncStates(pet.id),
      );
    }));
    if (!mounted) return;
    setState(() {
      _request = Future.value(_PetsSnapshot(
        pets: current.pets,
        syncStatesByPetId:
            Map<String, List<OwnerPetProfileSyncState>>.fromEntries(
          entries.where((entry) => entry.value.isNotEmpty),
        ),
      ));
    });
  }

  Future<void> _refreshPets() async {
    final request = _loadPets();
    setState(() => _request = request);
    await request;
  }

  @override
  Widget build(BuildContext context) {
    if (ownerUsesCupertino(platform: widget.platformOverride)) {
      return _buildCupertino(context);
    }
    return FutureBuilder<_PetsSnapshot>(
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
        final data = snapshot.data ?? const _PetsSnapshot.empty();
        _lastSnapshot = data;
        final pets = data.pets;
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
                    selected: pets[index].id == widget.selectedPetId,
                    syncStates: data.syncStatesFor(pets[index].id),
                    onSelect:
                        _busy ? null : () => widget.onPetSelected(pets[index]),
                    onEdit: _busy
                        ? null
                        : () {
                            final openProfile = widget.onOpenPetProfile;
                            if (openProfile != null) {
                              openProfile(pets[index]);
                            } else {
                              _editPet(pets[index]);
                            }
                          },
                  ),
                ),
        );
      },
    );
  }

  Widget _buildCupertino(BuildContext context) {
    return FutureBuilder<_PetsSnapshot>(
      future: _request,
      builder: (context, snapshot) {
        final loading = snapshot.connectionState != ConnectionState.done;
        final data = snapshot.data ?? _lastSnapshot;
        if (loading && data == null) {
          return CupertinoPageScaffold(
            navigationBar: _cupertinoNavigationBar(context),
            child: const SafeArea(
              child: OwnerCupertinoLoading(label: 'Загружаем питомцев'),
            ),
          );
        }
        if (snapshot.hasError && data == null) {
          return CupertinoPageScaffold(
            navigationBar: _cupertinoNavigationBar(context),
            child: SafeArea(
              child: OwnerCupertinoEmptyState(
                icon: CupertinoIcons.cloud,
                title: 'Не удалось загрузить питомцев',
                message:
                    'Повторная попытка обновит список питомцев и их профильные данные.',
                actionLabel: 'Обновить питомцев',
                onAction: _reload,
              ),
            ),
          );
        }

        final resolved = data ?? const _PetsSnapshot.empty();
        _lastSnapshot = resolved;
        return CupertinoPageScaffold(
          navigationBar: _cupertinoNavigationBar(context),
          child: SafeArea(
            bottom: false,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                CupertinoSliverRefreshControl(onRefresh: _refreshPets),
                if (snapshot.hasError)
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    sliver: SliverToBoxAdapter(
                      child: OwnerCupertinoInlineError(
                        title: 'Показаны последние данные',
                        message:
                            'Не удалось обновить список питомцев. Повторная попытка загрузит актуальные профили.',
                        retryLabel: 'Обновить питомцев',
                        onRetry: _reload,
                      ),
                    ),
                  ),
                if (resolved.pets.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: OwnerCupertinoEmptyState(
                      icon: CupertinoIcons.paw,
                      title: 'Питомцы не добавлены',
                      message:
                          'Добавьте питомца, чтобы видеть его дневник здоровья и быстро переходить к записи.',
                      actionLabel: 'Добавить питомца',
                      onAction: _busy ? null : _createPet,
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                    sliver: SliverList.separated(
                      itemCount: resolved.pets.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final pet = resolved.pets[index];
                        return _CupertinoPetCard(
                          pet: pet,
                          syncStates: resolved.syncStatesFor(pet.id),
                          onTap: () => _openCupertinoPetProfile(pet, resolved),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  ObstructingPreferredSizeWidget _cupertinoNavigationBar(BuildContext context) {
    return CupertinoNavigationBar(
      middle: const Text('Питомцы'),
      transitionBetweenRoutes: false,
      trailing: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: _busy ? null : _createPet,
        child: const Icon(CupertinoIcons.add),
      ),
    );
  }

  void _openCupertinoPetProfile(OwnerPet pet, _PetsSnapshot snapshot) {
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => _CupertinoPetProfilePage(
          pet: pet,
          syncStates: snapshot.syncStatesFor(pet.id),
          onSelectForBooking: () {
            widget.onPetSelected(pet);
            Navigator.of(context).pop();
          },
          onOpenPetCare: widget.onOpenPetCare == null
              ? null
              : () => widget.onOpenPetCare!(pet),
          onEdit: _busy ? null : () => _editPet(pet),
        ),
      ),
    );
  }
}

class _PetsSnapshot {
  const _PetsSnapshot({
    required this.pets,
    required this.syncStatesByPetId,
  });

  const _PetsSnapshot.empty()
      : pets = const <OwnerPet>[],
        syncStatesByPetId = const <String, List<OwnerPetProfileSyncState>>{};

  final List<OwnerPet> pets;
  final Map<String, List<OwnerPetProfileSyncState>> syncStatesByPetId;

  List<OwnerPetProfileSyncState> syncStatesFor(String petId) =>
      syncStatesByPetId[petId] ?? const <OwnerPetProfileSyncState>[];
}

class _PetCard extends StatelessWidget {
  const _PetCard({
    required this.pet,
    required this.syncStates,
    required this.onSelect,
    required this.onEdit,
    required this.selected,
  });

  final OwnerPet pet;
  final List<OwnerPetProfileSyncState> syncStates;
  final VoidCallback? onSelect;
  final VoidCallback? onEdit;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final syncStatus = _petSyncStatusFromStates(syncStates);
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
      if (pet.vaccinationNotes != null) 'Вакцинация указана',
      if (pet.insurancePolicyLinks.isNotEmpty)
        'Полисы: ${_policyCount(pet.insurancePolicyLinks.length)}',
      if (pet.photoUrl != null) 'Фото профиля добавлено',
      if (pet.sterilized != null)
        pet.sterilized! ? 'Стерилизован(а)' : 'Не стерилизован(а)',
    ];
    return Card(
      color: selected ? Theme.of(context).colorScheme.primaryContainer : null,
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
            if (syncStatus != null) ...[
              _PetSyncChip(status: syncStatus),
              const SizedBox(width: 4),
            ],
            if (selected)
              const Tooltip(
                message: 'Выбран для записи',
                child: Icon(Icons.check_circle_outline),
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

enum _PetSyncStatus { pending, syncing, conflict, failed }

extension on _PetSyncStatus {
  String get label => switch (this) {
        _PetSyncStatus.pending => 'В очереди',
        _PetSyncStatus.syncing => 'Синхронизация',
        _PetSyncStatus.conflict => 'Конфликт',
        _PetSyncStatus.failed => 'Не сохранено',
      };

  IconData get icon => switch (this) {
        _PetSyncStatus.pending => Icons.schedule_outlined,
        _PetSyncStatus.syncing => Icons.sync,
        _PetSyncStatus.conflict => Icons.error_outline,
        _PetSyncStatus.failed => Icons.sync_problem,
      };

  Color color(ColorScheme colors) => switch (this) {
        _PetSyncStatus.pending => colors.secondaryContainer,
        _PetSyncStatus.syncing => colors.primaryContainer,
        _PetSyncStatus.conflict => colors.errorContainer,
        _PetSyncStatus.failed => colors.errorContainer,
      };

  Color foreground(ColorScheme colors) => switch (this) {
        _PetSyncStatus.pending => colors.onSecondaryContainer,
        _PetSyncStatus.syncing => colors.onPrimaryContainer,
        _PetSyncStatus.conflict => colors.onErrorContainer,
        _PetSyncStatus.failed => colors.onErrorContainer,
      };
}

_PetSyncStatus? _petSyncStatusFromStates(
    List<OwnerPetProfileSyncState> states) {
  if (states.any((state) => state.status == OfflineCommandStatus.conflict)) {
    return _PetSyncStatus.conflict;
  }
  if (states.any((state) =>
      state.status == OfflineCommandStatus.denied ||
      state.status == OfflineCommandStatus.fencedSchema ||
      state.status == OfflineCommandStatus.invalid)) {
    return _PetSyncStatus.failed;
  }
  if (states.any((state) => state.status == OfflineCommandStatus.syncing)) {
    return _PetSyncStatus.syncing;
  }
  if (states.any((state) => state.status == OfflineCommandStatus.pending)) {
    return _PetSyncStatus.pending;
  }
  return null;
}

class _PetSyncChip extends StatelessWidget {
  const _PetSyncChip({required this.status});

  final _PetSyncStatus status;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final foreground = status.foreground(colors);
    return Tooltip(
      message: status.label,
      child: Chip(
        avatar: Icon(status.icon, size: 16, color: foreground),
        label: Text(status.label),
        visualDensity: VisualDensity.compact,
        backgroundColor: status.color(colors),
        labelStyle:
            Theme.of(context).textTheme.labelSmall?.copyWith(color: foreground),
        side: BorderSide.none,
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

class _CupertinoPetCard extends StatelessWidget {
  const _CupertinoPetCard({
    required this.pet,
    required this.syncStates,
    required this.onTap,
  });

  final OwnerPet pet;
  final List<OwnerPetProfileSyncState> syncStates;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final syncStatus = _petSyncStatusFromStates(syncStates);
    final subtitle = _cupertinoPetSubtitle(context, pet);
    final health = _ownerHealthContext(pet);
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      button: true,
      label:
          '${pet.name}. $subtitle. ${health.label}. Открыть профиль питомца.',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.secondarySystemGroupedBackground,
              context,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.separator,
                context,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CupertinoPetAvatar(pet: pet, size: 54),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pet.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .navTitleTextStyle
                            .copyWith(fontSize: 20),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .textStyle
                            .copyWith(color: secondary),
                      ),
                      const SizedBox(height: 8),
                      _cupertinoPetHealthLine(context: context, health: health),
                      if (syncStatus != null) ...[
                        const SizedBox(height: 8),
                        _CupertinoPetSyncStatus(status: syncStatus),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(CupertinoIcons.chevron_forward, color: secondary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoPetProfilePage extends StatelessWidget {
  const _CupertinoPetProfilePage({
    required this.pet,
    required this.syncStates,
    required this.onSelectForBooking,
    required this.onOpenPetCare,
    required this.onEdit,
  });

  final OwnerPet pet;
  final List<OwnerPetProfileSyncState> syncStates;
  final VoidCallback onSelectForBooking;
  final VoidCallback? onOpenPetCare;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final syncStatus = _petSyncStatusFromStates(syncStates);
    final facts = _petFactRows(pet);
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(pet.name),
        transitionBetweenRoutes: false,
        trailing: onEdit == null
            ? null
            : CupertinoButton(
                minSize: 44,
                padding: EdgeInsets.zero,
                onPressed: onEdit,
                child: const Icon(CupertinoIcons.pencil),
              ),
      ),
      child: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            _CupertinoPetIdentityHeader(pet: pet),
            const SizedBox(height: 14),
            if (syncStatus != null) ...[
              OwnerCupertinoStatusBanner(
                tone: syncStatus == _PetSyncStatus.conflict ||
                        syncStatus == _PetSyncStatus.failed
                    ? OwnerCupertinoFeedbackTone.warning
                    : OwnerCupertinoFeedbackTone.neutral,
                message: _cupertinoSyncMessage(syncStatus),
              ),
              const SizedBox(height: 14),
            ],
            OwnerCupertinoButton.primary(
              label: 'Выбрать для записи',
              onPressed: onSelectForBooking,
              semanticLabel: 'Выбрать ${pet.name} для записи',
            ),
            const SizedBox(height: 18),
            _CupertinoPetSection(
              title: 'Что сейчас важно',
              children: [
                _CupertinoInfoText(_ownerHealthContext(pet).description),
                if (onOpenPetCare != null) ...[
                  const SizedBox(height: 12),
                  OwnerCupertinoButton.secondary(
                    label: 'Открыть дневник здоровья',
                    icon: CupertinoIcons.doc_text,
                    onPressed: onOpenPetCare,
                    semanticLabel: 'Открыть дневник здоровья ${pet.name}',
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),
            _CupertinoPetSection(
              title: 'Сведения о питомце',
              children: [
                if (facts.isEmpty)
                  const _CupertinoInfoText(
                    'Дополнительные сведения пока не заполнены.',
                  )
                else
                  for (var index = 0; index < facts.length; index++) ...[
                    if (index > 0) const _CupertinoPetDivider(),
                    _CupertinoPetFactRow(fact: facts[index]),
                  ],
              ],
            ),
            if (_hasCareSource(pet)) ...[
              const SizedBox(height: 14),
              _CupertinoPetSection(
                title: 'Контекст для клиники',
                children: [
                  _CupertinoInfoText(_careSourceSummary(pet)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CupertinoPetIdentityHeader extends StatelessWidget {
  const _CupertinoPetIdentityHeader({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.secondarySystemGroupedBackground,
          context,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CupertinoPetAvatar(pet: pet, size: 68),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pet.name,
                    style: CupertinoTheme.of(context)
                        .textTheme
                        .navLargeTitleTextStyle
                        .copyWith(fontSize: 26),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _cupertinoPetSubtitle(context, pet),
                    style: CupertinoTheme.of(context)
                        .textTheme
                        .textStyle
                        .copyWith(color: secondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoPetAvatar extends StatelessWidget {
  const _CupertinoPetAvatar({required this.pet, required this.size});

  final OwnerPet pet;
  final double size;

  @override
  Widget build(BuildContext context) {
    final background = CupertinoDynamicColor.resolve(
      CupertinoColors.tertiarySystemFill,
      context,
    );
    final foreground = CupertinoDynamicColor.resolve(
      CupertinoColors.activeBlue,
      context,
    );
    final photo = pet.photoUrl;
    return ClipOval(
      child: SizedBox.square(
        dimension: size,
        child: DecoratedBox(
          decoration: BoxDecoration(color: background),
          child: photo == null
              ? Icon(CupertinoIcons.paw, color: foreground, size: size * .44)
              : Image.network(
                  photo,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Icon(
                    CupertinoIcons.paw,
                    color: foreground,
                    size: size * .44,
                  ),
                ),
        ),
      ),
    );
  }
}

class _CupertinoPetSection extends StatelessWidget {
  const _CupertinoPetSection({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OwnerCupertinoSectionHeader(title: title),
        const SizedBox(height: 8),
        DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.secondarySystemGroupedBackground,
              context,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.separator,
                context,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ],
    );
  }
}

class _CupertinoPetFact {
  const _CupertinoPetFact(this.label, this.value, this.icon);

  final String label;
  final String value;
  final IconData icon;
}

class _CupertinoPetFactRow extends StatelessWidget {
  const _CupertinoPetFactRow({required this.fact});

  final _CupertinoPetFact fact;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      label: '${fact.label}: ${fact.value}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(fact.icon, size: 20, color: secondary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fact.label,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: secondary,
                            fontSize: 13,
                          ),
                ),
                const SizedBox(height: 2),
                Text(fact.value),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoInfoText extends StatelessWidget {
  const _CupertinoInfoText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: CupertinoTheme.of(context).textTheme.textStyle,
    );
  }
}

class _CupertinoPetDivider extends StatelessWidget {
  const _CupertinoPetDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: ColoredBox(
        color:
            CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
        child: const SizedBox(height: .5),
      ),
    );
  }
}

class _CupertinoPetHealthContext {
  const _CupertinoPetHealthContext({
    required this.label,
    required this.description,
    required this.icon,
  });

  final String label;
  final String description;
  final IconData icon;
}

Widget _cupertinoPetHealthLine({
  required BuildContext context,
  required _CupertinoPetHealthContext health,
}) {
  final color = CupertinoDynamicColor.resolve(
    CupertinoColors.secondaryLabel,
    context,
  );
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(health.icon, size: 18, color: color),
      const SizedBox(width: 6),
      Expanded(
        child: Text(
          health.label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                color: color,
                fontSize: 14,
              ),
        ),
      ),
    ],
  );
}

class _CupertinoPetSyncStatus extends StatelessWidget {
  const _CupertinoPetSyncStatus({required this.status});

  final _PetSyncStatus status;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoStatusBanner(
      tone: status == _PetSyncStatus.conflict || status == _PetSyncStatus.failed
          ? OwnerCupertinoFeedbackTone.warning
          : OwnerCupertinoFeedbackTone.neutral,
      message: _cupertinoSyncMessage(status),
    );
  }
}

class _PetForm extends StatefulWidget {
  const _PetForm({
    this.initial,
    this.onPetChanged,
    this.pickPhoto,
    this.onUploadPhoto,
    this.onDeletePhoto,
    required this.onSubmit,
  });

  final OwnerPet? initial;
  final ValueChanged<OwnerPet>? onPetChanged;
  final Future<OwnerPickedPetFile?> Function(BuildContext context)? pickPhoto;
  final Future<OwnerPet> Function(OwnerPickedPetFile file)? onUploadPhoto;
  final Future<OwnerPet> Function()? onDeletePhoto;
  final Future<OwnerPetSaveResult> Function(OwnerPetProfileInput input)
      onSubmit;

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
  late String _species;
  OwnerPet? _currentPet;
  String? _sex;
  bool? _sterilized;
  bool _submittedOnce = false;
  _PetSubmitState _submitState = _PetSubmitState.idle;
  _PetSubmitState _photoState = _PetSubmitState.idle;
  String? _submitError;
  String? _photoError;
  OwnerPickedPetFile? _lastPhotoFile;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _currentPet = initial;
    _name = TextEditingController(text: initial?.name);
    _breed = TextEditingController(text: initial?.breed);
    _birthDate = TextEditingController(
        text: initial?.birthDate == null ? '' : _dateOnly(initial!.birthDate!));
    _weight = TextEditingController(text: initial?.weightKg);
    _allergies = TextEditingController(text: initial?.allergies.join(', '));
    _chronicConditions =
        TextEditingController(text: initial?.chronicConditions.join(', '));
    _vaccinationNotes = TextEditingController(text: initial?.vaccinationNotes);
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
              Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.initial == null
                          ? 'Новый питомец'
                          : 'Профиль питомца',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Закрыть',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Отменить'),
                ),
              ),
              const SizedBox(height: 16),
              if (widget.initial != null) ...[
                _PetPhotoEditor(
                  pet: _currentPet,
                  busy: _photoState == _PetSubmitState.loading,
                  error: _photoError,
                  canUpload: widget.onUploadPhoto != null &&
                      widget.pickPhoto != null &&
                      _currentPet != null,
                  canDelete: widget.onDeletePhoto != null &&
                      _currentPet?.photoUrl != null,
                  onPick: _pickAndUploadPhoto,
                  onRetry: _lastPhotoFile == null
                      ? null
                      : () => _uploadPhoto(_lastPhotoFile!),
                  onDelete: _deletePhoto,
                ),
                const SizedBox(height: 16),
              ],
              TextFormField(
                key: const ValueKey('owner-pet-name-field'),
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
                  helperText: 'Например: дата последней комплексной вакцины',
                ),
                validator: _validateLongText,
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
    setState(() {
      _submitState = _PetSubmitState.loading;
    });
    try {
      final result = await widget.onSubmit(OwnerPetProfileInput(
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
        photoUrl: _currentPet?.photoUrl ?? widget.initial?.photoUrl,
        insurancePolicyLinks: _currentPet?.insurancePolicyLinks ??
            widget.initial?.insurancePolicyLinks ??
            const <String>[],
        mutationId: 'owner-mobile-${DateTime.now().microsecondsSinceEpoch}',
      ));
      if (!mounted) {
        return;
      }
      setState(() {
        _submitState = _PetSubmitState.success;
      });
      unawaited(HapticFeedback.mediumImpact().catchError((_) {}));
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(result);
    } on OwnerPetApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitState = _PetSubmitState.failure;
        _submitError = _petError(error);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitState = _PetSubmitState.failure;
        _submitError =
            'Не удалось сохранить профиль. Проверьте соединение и повторите попытку.';
      });
    }
  }

  Future<void> _pickAndUploadPhoto() async {
    if (_photoState == _PetSubmitState.loading) return;
    final picker = widget.pickPhoto;
    if (picker == null) return;
    final file = await picker(context);
    if (file == null || !mounted) return;
    await _uploadPhoto(file);
  }

  Future<void> _uploadPhoto(OwnerPickedPetFile file) async {
    final upload = widget.onUploadPhoto;
    if (upload == null) return;
    final validation = ownerPetUploadValidationError(file, allowPdf: false);
    if (validation != null) {
      setState(() {
        _photoState = _PetSubmitState.failure;
        _photoError = validation;
        _lastPhotoFile = file;
      });
      return;
    }
    setState(() {
      _photoState = _PetSubmitState.loading;
      _photoError = null;
      _lastPhotoFile = file;
    });
    try {
      final pet = await upload(file);
      if (!mounted) return;
      setState(() {
        _currentPet = pet;
        _photoState = _PetSubmitState.success;
        _photoError = null;
        _lastPhotoFile = null;
      });
      widget.onPetChanged?.call(pet);
      unawaited(HapticFeedback.selectionClick().catchError((_) {}));
    } on OwnerPetApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _photoState = _PetSubmitState.failure;
        _photoError = _petPhotoError(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _photoState = _PetSubmitState.failure;
        _photoError =
            'Не удалось загрузить фото. Проверьте соединение и повторите попытку.';
      });
    }
  }

  Future<void> _deletePhoto() async {
    final delete = widget.onDeletePhoto;
    if (delete == null || _photoState == _PetSubmitState.loading) return;
    setState(() {
      _photoState = _PetSubmitState.loading;
      _photoError = null;
    });
    try {
      final pet = await delete();
      if (!mounted) return;
      setState(() {
        _currentPet = pet;
        _photoState = _PetSubmitState.success;
        _photoError = null;
        _lastPhotoFile = null;
      });
      widget.onPetChanged?.call(pet);
    } on OwnerPetApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _photoState = _PetSubmitState.failure;
        _photoError = _petPhotoError(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _photoState = _PetSubmitState.failure;
        _photoError =
            'Не удалось удалить фото. Проверьте соединение и повторите попытку.';
      });
    }
  }
}

class _PetPhotoEditor extends StatelessWidget {
  const _PetPhotoEditor({
    required this.pet,
    required this.busy,
    required this.error,
    required this.canUpload,
    required this.canDelete,
    required this.onPick,
    required this.onRetry,
    required this.onDelete,
  });

  final OwnerPet? pet;
  final bool busy;
  final String? error;
  final bool canUpload;
  final bool canDelete;
  final VoidCallback onPick;
  final VoidCallback? onRetry;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final photoUrl = pet?.photoUrl;
    final hasPhoto = photoUrl != null && photoUrl.trim().isNotEmpty;
    return Semantics(
      container: true,
      label: hasPhoto
          ? 'Фото питомца добавлено. Можно заменить или удалить фото.'
          : 'Фото питомца не добавлено.',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _PetPhotoPreview(photoUrl: photoUrl),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Фото питомца',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          hasPhoto
                              ? 'Фото профиля сохранено. Его можно заменить или удалить.'
                              : 'Добавьте фото из камеры, галереи или файлов.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  if (busy)
                    const SizedBox.square(
                      dimension: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                ],
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  error!,
                  style: TextStyle(color: colors.error),
                ),
              ],
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Tooltip(
                    message: hasPhoto ? 'Заменить фото' : 'Добавить фото',
                    child: FilledButton.icon(
                      onPressed: canUpload && !busy ? onPick : null,
                      icon: Icon(hasPhoto
                          ? Icons.photo_library_outlined
                          : Icons.add_a_photo_outlined),
                      label: Text(hasPhoto ? 'Заменить' : 'Добавить фото'),
                    ),
                  ),
                  if (onRetry != null)
                    OutlinedButton.icon(
                      onPressed: busy ? null : onRetry,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Повторить'),
                    ),
                  if (hasPhoto)
                    OutlinedButton.icon(
                      onPressed: canDelete && !busy ? onDelete : null,
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Удалить'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PetPhotoPreview extends StatelessWidget {
  const _PetPhotoPreview({required this.photoUrl});

  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final url = photoUrl?.trim();
    return ClipOval(
      child: SizedBox.square(
        dimension: 82,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.surface),
          child: url == null || url.isEmpty
              ? Icon(Icons.pets, color: colors.primary, size: 36)
              : Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      Icon(Icons.pets, color: colors.primary, size: 36),
                ),
        ),
      ),
    );
  }
}

enum _PetSubmitState { idle, loading, success, failure }

enum _PetPhotoSource { camera, gallery, files }

Future<OwnerPickedPetFile?> _pickPhotoFromSheet(BuildContext context) async {
  final source = await showModalBottomSheet<_PetPhotoSource>(
    context: context,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            minVerticalPadding: 12,
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Сделать фото'),
            onTap: () => Navigator.of(context).pop(_PetPhotoSource.camera),
          ),
          ListTile(
            minVerticalPadding: 12,
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Выбрать из галереи'),
            onTap: () => Navigator.of(context).pop(_PetPhotoSource.gallery),
          ),
          ListTile(
            minVerticalPadding: 12,
            leading: const Icon(Icons.folder_open_outlined),
            title: const Text('Выбрать файл'),
            subtitle: const Text('JPEG, PNG, HEIC или WEBP до 10 МБ'),
            onTap: () => Navigator.of(context).pop(_PetPhotoSource.files),
          ),
        ],
      ),
    ),
  );
  return switch (source) {
    _PetPhotoSource.camera => pickOwnerPetPhotoFromCamera(),
    _PetPhotoSource.gallery => pickOwnerPetPhotoFromGallery(),
    _PetPhotoSource.files => pickOwnerPetPhotoFromFiles(),
    null => null,
  };
}

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

String _petError(OwnerPetApiException error) {
  return switch (error.code) {
    'INVALID_PET_NAME' => 'Введите имя питомца',
    'PET_PROFILE_VERSION_MISMATCH' => 'Профиль изменился. Откройте его заново.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось сохранить профиль. Повторите попытку.',
  };
}

String _petPhotoError(OwnerPetApiException error) {
  return switch (error.code) {
    'EMPTY_PET_FILE' => 'Файл пустой. Выберите другой файл.',
    'PET_FILE_TOO_LARGE' =>
      'Файл больше ${ownerPetFileSizeLabel(ownerPetUploadMaxBytes)}. Выберите файл меньшего размера.',
    'UNSUPPORTED_PET_FILE_TYPE' =>
      'Этот тип файла не поддерживается. Можно загрузить JPEG, PNG, HEIC или WEBP.',
    'OWNER_PET_NOT_FOUND' => 'Питомец не найден. Обновите профиль.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось обновить фото. Повторите попытку.',
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

String _cupertinoPetSubtitle(BuildContext context, OwnerPet pet) {
  final parts = <String>[
    _speciesTitle(pet.species),
    if (pet.breed != null && pet.breed!.trim().isNotEmpty) pet.breed!.trim(),
    if (pet.birthDate != null) _ageFromBirthDate(context, pet.birthDate!),
    if (pet.birthDate == null && pet.ageMonths != null)
      _ageFromMonths(pet.ageMonths!),
  ];
  return parts.join(' · ');
}

String _ageFromBirthDate(BuildContext context, DateTime birthDate) {
  final now = DateTime.now();
  final months =
      ((now.year - birthDate.year) * 12) + now.month - birthDate.month;
  if (months >= 1) return _ageFromMonths(months);
  return 'рожд. ${MaterialLocalizations.of(context).formatMediumDate(birthDate)}';
}

String _ageFromMonths(int months) {
  if (months < 12) return '$months мес.';
  final years = months ~/ 12;
  final rest = months % 12;
  if (rest == 0) return '$years г.';
  return '$years г. $rest мес.';
}

_CupertinoPetHealthContext _ownerHealthContext(OwnerPet pet) {
  if (pet.allergies.isNotEmpty) {
    return _CupertinoPetHealthContext(
      label: 'Есть отмеченные аллергии',
      description:
          'В профиле указаны аллергии: ${pet.allergies.take(3).join(', ')}. Сообщите об этом клинике при записи.',
      icon: CupertinoIcons.exclamationmark_triangle,
    );
  }
  if (pet.chronicConditions.isNotEmpty) {
    return _CupertinoPetHealthContext(
      label: 'Есть хронические состояния',
      description:
          'В профиле указаны хронические состояния: ${pet.chronicConditions.take(3).join(', ')}. Дневник помогает сохранить контекст визитов.',
      icon: CupertinoIcons.heart,
    );
  }
  if (pet.vaccinationNotes != null && pet.vaccinationNotes!.trim().isNotEmpty) {
    return const _CupertinoPetHealthContext(
      label: 'Есть заметки о вакцинации',
      description:
          'В профиле сохранены заметки о вакцинации. Проверьте актуальность данных перед плановым визитом.',
      icon: CupertinoIcons.check_mark_circled,
    );
  }
  return const _CupertinoPetHealthContext(
    label: 'Нет важных заметок в профиле',
    description:
        'В профиле нет отмеченных аллергий, хронических состояний или заметок о вакцинации. Добавьте их, если клинике важно знать эти данные.',
    icon: CupertinoIcons.info_circle,
  );
}

List<_CupertinoPetFact> _petFactRows(OwnerPet pet) {
  return [
    if (pet.weightKg != null && pet.weightKg!.trim().isNotEmpty)
      _CupertinoPetFact('Вес', '${pet.weightKg} кг', CupertinoIcons.gauge),
    if (pet.sex != null && pet.sex!.trim().isNotEmpty)
      _CupertinoPetFact('Пол', _sexLabel(pet.sex!), CupertinoIcons.person),
    if (pet.sterilized != null || pet.isSterilized != null)
      _CupertinoPetFact(
        'Стерилизация',
        (pet.sterilized ?? pet.isSterilized) == true ? 'Да' : 'Нет',
        CupertinoIcons.heart,
      ),
    if (pet.allergies.isNotEmpty)
      _CupertinoPetFact(
        'Аллергии',
        pet.allergies.join(', '),
        CupertinoIcons.exclamationmark_triangle,
      ),
    if (pet.chronicConditions.isNotEmpty)
      _CupertinoPetFact(
        'Хронические состояния',
        pet.chronicConditions.join(', '),
        CupertinoIcons.doc_text,
      ),
    if (pet.vaccinationNotes != null && pet.vaccinationNotes!.trim().isNotEmpty)
      _CupertinoPetFact(
        'Вакцинация',
        pet.vaccinationNotes!.trim(),
        CupertinoIcons.check_mark_circled,
      ),
  ];
}

String _sexLabel(String value) => switch (value.toUpperCase()) {
      'MALE' => 'Самец',
      'FEMALE' => 'Самка',
      _ => 'Не указано',
    };

bool _hasCareSource(OwnerPet pet) {
  return pet.vaccinationNotes != null ||
      pet.insurancePolicyLinks.isNotEmpty ||
      pet.photoUrl != null;
}

String _careSourceSummary(OwnerPet pet) {
  final parts = <String>[
    if (pet.vaccinationNotes != null && pet.vaccinationNotes!.trim().isNotEmpty)
      'заметки о вакцинации',
    if (pet.insurancePolicyLinks.isNotEmpty)
      _policyCount(pet.insurancePolicyLinks.length),
    if (pet.photoUrl != null) 'фото профиля',
  ];
  return 'В профиле есть ${parts.join(', ')}. Это не заменяет медицинские рекомендации, но помогает сохранить контекст для клиники.';
}

String _cupertinoSyncMessage(_PetSyncStatus status) => switch (status) {
      _PetSyncStatus.pending =>
        'Изменения профиля сохранены на устройстве и будут отправлены при соединении.',
      _PetSyncStatus.syncing => 'Изменения профиля синхронизируются.',
      _PetSyncStatus.conflict =>
        'Профиль изменился в другом месте. Откройте профиль заново перед редактированием.',
      _PetSyncStatus.failed =>
        'Последние изменения профиля не удалось отправить. Проверьте данные и повторите позже.',
    };

String _policyCount(int count) {
  final suffix = count == 1
      ? 'полис'
      : count < 5
          ? 'полиса'
          : 'полисов';
  return '$count $suffix';
}
