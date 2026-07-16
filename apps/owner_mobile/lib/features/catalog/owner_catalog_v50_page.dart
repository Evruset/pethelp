import 'package:flutter/material.dart';

import '../../ui/vethelp_ios_theme.dart';
import '../pets/owner_v50_pet_visuals.dart';
import 'catalog_models.dart';
import 'owner_catalog_v50_feature_flags.dart';
import 'public_catalog_repository.dart';

enum OwnerCatalogLocationState { available, denied, unavailable }

enum _CatalogRoute { catalog, clinic, doctors, doctor }

class OwnerCatalogV50Page extends StatefulWidget {
  const OwnerCatalogV50Page({
    super.key,
    required this.repository,
    required this.flags,
    required this.onSelected,
    this.selectedPetId,
    this.selectedPetName,
    this.onChangePet,
    this.locationState = OwnerCatalogLocationState.available,
    this.initialLocation = '/owner/catalog',
    this.initialMapMode = false,
    this.initialFilters = const CatalogClinicFilters(),
  });

  final PublicCatalogRepository repository;
  final OwnerCatalogV50Flags flags;
  final ValueChanged<CatalogBookingSelection> onSelected;
  final String? selectedPetId;
  final String? selectedPetName;
  final VoidCallback? onChangePet;
  final OwnerCatalogLocationState locationState;
  final String initialLocation;
  final bool initialMapMode;
  final CatalogClinicFilters initialFilters;

  @override
  State<OwnerCatalogV50Page> createState() => _OwnerCatalogV50PageState();
}

class _OwnerCatalogV50PageState extends State<OwnerCatalogV50Page> {
  final _search = TextEditingController();
  late CatalogClinicFilters _filters;
  late Future<List<CatalogClinic>> _clinics;
  _CatalogRoute _route = _CatalogRoute.catalog;
  late bool _mapMode;
  CatalogClinic? _selectedClinic;
  CatalogClinicDetail? _clinicDetail;
  CatalogLocation? _selectedLocation;
  CatalogService? _selectedService;
  Future<CatalogClinicDetail>? _clinicRequest;
  Future<List<CatalogDoctor>>? _doctorsRequest;
  Future<CatalogDoctor>? _doctorRequest;

  @override
  void initState() {
    super.initState();
    _filters = widget.initialFilters;
    _mapMode = widget.initialMapMode;
    _clinics = widget.repository.listClinics(filters: _filters);
    _openInitialRoute();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _openInitialRoute() {
    final segments =
        Uri.tryParse(widget.initialLocation)?.pathSegments ?? const [];
    if (segments.length == 3 &&
        segments[0] == 'owner' &&
        segments[1] == 'clinics') {
      _route = _CatalogRoute.clinic;
      _clinicRequest = widget.repository.readClinic(segments[2]);
    } else if (segments.length == 3 &&
        segments[0] == 'owner' &&
        segments[1] == 'doctors') {
      _route = _CatalogRoute.doctor;
      _doctorRequest = widget.repository.readDoctor(segments[2]);
    } else if (segments.length == 4 &&
        segments[0] == 'owner' &&
        segments[1] == 'clinics' &&
        segments[3] == 'doctors') {
      _route = _CatalogRoute.doctors;
      _doctorsRequest = widget.repository.listDoctors(clinicId: segments[2]);
    }
  }

  void _reloadCatalog() {
    setState(() {
      _filters = _filters.copyWith(
        query: _search.text.trim(),
        clearQuery: _search.text.trim().isEmpty,
      );
      _clinics = widget.repository.listClinics(filters: _filters);
    });
  }

  void _setFilters(CatalogClinicFilters filters) {
    setState(() {
      _filters = filters.copyWith(
        query: _search.text.trim(),
        clearQuery: _search.text.trim().isEmpty,
      );
      _clinics = widget.repository.listClinics(filters: _filters);
    });
  }

  void _openClinic(CatalogClinic clinic) {
    if (!widget.flags.clinicDetail) return;
    setState(() {
      _selectedClinic = clinic;
      _route = _CatalogRoute.clinic;
      _clinicRequest = widget.repository.readClinic(clinic.id);
    });
  }

  void _openDoctors() {
    final clinic = _clinicDetail;
    if (!widget.flags.doctorDiscovery || clinic == null) return;
    setState(() {
      _route = _CatalogRoute.doctors;
      _doctorsRequest = widget.repository.listDoctors(
        clinicId: clinic.id,
        locationId: _selectedLocation?.locationId,
        serviceCode: _selectedService?.code,
      );
    });
  }

  void _openDoctor(CatalogDoctor doctor) {
    setState(() {
      _route = _CatalogRoute.doctor;
      _doctorRequest = widget.repository.readDoctor(doctor.id);
    });
  }

  void _back() {
    setState(() {
      switch (_route) {
        case _CatalogRoute.doctor:
          _route = _selectedClinic == null
              ? _CatalogRoute.catalog
              : _CatalogRoute.doctors;
          return;
        case _CatalogRoute.doctors:
          _route = _CatalogRoute.clinic;
          return;
        case _CatalogRoute.clinic:
          _route = _CatalogRoute.catalog;
          return;
        case _CatalogRoute.catalog:
          return;
      }
    });
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: _route == _CatalogRoute.catalog,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _back();
        },
        child: switch (_route) {
          _CatalogRoute.catalog => _buildCatalog(),
          _CatalogRoute.clinic => _buildClinic(),
          _CatalogRoute.doctors => _buildDoctors(),
          _CatalogRoute.doctor => _buildDoctor(),
        },
      );

  Widget _buildCatalog() => OwnerV50PetPageFrame(
        eyebrow: 'Поиск клиники',
        title: 'Выбор клиники',
        supportingText: widget.selectedPetName == null
            ? 'Сравните подтверждённые услуги и доступность. Выберите питомца для более точного контекста.'
            : 'Подберите клинику для ${widget.selectedPetName}: сначала доступность, подтверждение и услуги.',
        status: _locationStatus(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OwnerV50InsetSection(
              title: 'Найдите подходящий вариант',
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final search = TextField(
                    key: const ValueKey('catalog-search-field'),
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _reloadCatalog(),
                    decoration: InputDecoration(
                      hintText: 'Клиника, адрес или услуга',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        tooltip: 'Найти',
                        onPressed: _reloadCatalog,
                        icon: const Icon(Icons.arrow_forward),
                      ),
                    ),
                  );
                  final mode = SegmentedButton<bool>(
                    key: const ValueKey('catalog-mode-toggle'),
                    segments: const [
                      ButtonSegment(
                          value: false,
                          icon: Icon(Icons.view_list_outlined),
                          label: Text('Список')),
                      ButtonSegment(
                          value: true,
                          icon: Icon(Icons.map_outlined),
                          label: Text('Карта')),
                    ],
                    selected: {_mapMode},
                    onSelectionChanged: (value) =>
                        setState(() => _mapMode = value.first),
                  );
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (constraints.maxWidth >= 760)
                        Row(children: [
                          Expanded(child: search),
                          const SizedBox(width: 14),
                          mode,
                        ])
                      else ...[
                        search,
                        const SizedBox(height: 12),
                        mode,
                      ],
                      const SizedBox(height: 12),
                      _CatalogFilters(
                        filters: _filters,
                        onChanged: _setFilters,
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 18),
            FutureBuilder<List<CatalogClinic>>(
              future: _clinics,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const _CatalogSkeleton();
                }
                if (snapshot.hasError) {
                  return _CatalogError(onRetry: _reloadCatalog);
                }
                final clinics = snapshot.data ?? const <CatalogClinic>[];
                if (clinics.isEmpty) {
                  return _CatalogEmpty(
                    filtered: _search.text.trim().isNotEmpty || _hasFilters,
                    onClear: () {
                      _search.clear();
                      _setFilters(const CatalogClinicFilters());
                    },
                  );
                }
                if (_mapMode) {
                  return _CatalogMapFallback(
                    clinics: clinics,
                    locationState: widget.locationState,
                    onOpen: _openClinic,
                  );
                }
                return LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 980 ? 2 : 1;
                    final compactCards = constraints.maxWidth >= 760;
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        mainAxisExtent: compactCards ? 432 : 688,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                      ),
                      itemCount: clinics.length,
                      itemBuilder: (_, index) => _ClinicCard(
                        clinic: clinics[index],
                        featured: index == 0,
                        onOpen: () => _openClinic(clinics[index]),
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      );

  bool get _hasFilters =>
      _filters.serviceCode != null ||
      _filters.openNow == true ||
      _filters.telemedAvailable == true ||
      _filters.emergencyCapability != null;

  Widget? _locationStatus() => switch (widget.locationState) {
        OwnerCatalogLocationState.available => widget.selectedPetName == null
            ? OwnerV50StatusBanner(
                icon: Icons.pets_outlined,
                title: 'Общий каталог',
                message:
                    'Выберите питомца, чтобы сохранить контекст для записи.',
                action: widget.onChangePet == null
                    ? null
                    : TextButton(
                        onPressed: widget.onChangePet,
                        child: const Text('Выбрать')),
              )
            : null,
        OwnerCatalogLocationState.denied => const OwnerV50StatusBanner(
            icon: Icons.location_disabled_outlined,
            title: 'Геопозиция отключена',
            message:
                'Каталог работает без геопозиции. Выберите город или ищите по адресу.',
          ),
        OwnerCatalogLocationState.unavailable => const OwnerV50StatusBanner(
            icon: Icons.location_off_outlined,
            title: 'Не удалось определить местоположение',
            message: 'Показаны варианты без расчёта расстояния.',
            warning: true,
          ),
      };

  Widget _buildClinic() => FutureBuilder<CatalogClinicDetail>(
        future: _clinicRequest,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return _stateFrame('Карточка клиники', const _CatalogSkeleton());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return _stateFrame(
              'Клиника недоступна',
              _CatalogError(
                  onRetry: () => setState(() {
                        final id = _selectedClinic?.id;
                        if (id != null) {
                          _clinicRequest = widget.repository.readClinic(id);
                        }
                      })),
            );
          }
          final clinic = snapshot.data!;
          _clinicDetail = clinic;
          _selectedLocation ??= clinic.locations.firstOrNull;
          return OwnerV50PetPageFrame(
            eyebrow: 'Карточка клиники',
            title: clinic.name,
            supportingText:
                'Услуги, актуальность расписания и специалисты из публичного server-authoritative каталога.',
            leading: TextButton.icon(
              key: const ValueKey('clinic-back-action'),
              onPressed: _back,
              icon: const Icon(Icons.arrow_back),
              label: const Text('К каталогу'),
            ),
            child: _ClinicDetailContent(
              clinic: clinic,
              repository: widget.repository,
              selectedLocation: _selectedLocation,
              selectedService: _selectedService,
              onLocation: (location) => setState(() {
                _selectedLocation = location;
                _selectedService = null;
              }),
              onService: (service) =>
                  setState(() => _selectedService = service),
              onDoctors: widget.flags.doctorDiscovery ? _openDoctors : null,
              onContinue: _selectedLocation == null || _selectedService == null
                  ? null
                  : () => widget.onSelected(CatalogBookingSelection(
                        location: _selectedLocation!,
                        service: _selectedService!,
                      )),
            ),
          );
        },
      );

  Widget _buildDoctors() => OwnerV50PetPageFrame(
        eyebrow: 'Специалисты клиники',
        title: 'Выберите ветеринара',
        supportingText:
            'Показаны только активные публичные назначения в выбранной клинике и локации.',
        leading: TextButton.icon(
          key: const ValueKey('doctors-back-action'),
          onPressed: _back,
          icon: const Icon(Icons.arrow_back),
          label: const Text('К клинике'),
        ),
        child: FutureBuilder<List<CatalogDoctor>>(
          future: _doctorsRequest,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const _CatalogSkeleton();
            }
            if (snapshot.hasError) {
              return _CatalogError(onRetry: _openDoctors);
            }
            final doctors = snapshot.data ?? const <CatalogDoctor>[];
            if (doctors.isEmpty) {
              return const _SimpleEmpty(
                icon: Icons.person_search_outlined,
                title: 'Подходящих специалистов нет',
                message:
                    'Можно продолжить запись без выбора врача или изменить услугу.',
              );
            }
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: doctors
                  .map((doctor) => SizedBox(
                        width: 350,
                        child: _DoctorCard(
                          doctor: doctor,
                          onOpen: () => _openDoctor(doctor),
                        ),
                      ))
                  .toList(growable: false),
            );
          },
        ),
      );

  Widget _buildDoctor() => FutureBuilder<CatalogDoctor>(
        future: _doctorRequest,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return _stateFrame('Профиль ветеринара', const _CatalogSkeleton());
          }
          if (snapshot.hasError || snapshot.data == null) {
            return _stateFrame(
              'Специалист не найден',
              const _SimpleEmpty(
                icon: Icons.person_off_outlined,
                title: 'Профиль недоступен',
                message:
                    'Специалист не найден или больше не публикуется этой клиникой.',
              ),
            );
          }
          final doctor = snapshot.data!;
          return OwnerV50PetPageFrame(
            eyebrow: 'Публичный профиль',
            title: doctor.displayName,
            supportingText: '${doctor.title} · ${doctor.clinicName}',
            leading: TextButton.icon(
              key: const ValueKey('doctor-back-action'),
              onPressed: _back,
              icon: const Icon(Icons.arrow_back),
              label: const Text('К выбору специалиста'),
            ),
            status: _freshnessBanner(doctor.availability),
            child: _DoctorProfile(
              doctor: doctor,
              canContinue:
                  _selectedLocation != null && _selectedService != null,
              onContinue: _selectedLocation == null || _selectedService == null
                  ? null
                  : () => widget.onSelected(CatalogBookingSelection(
                        location: _selectedLocation!,
                        service: _selectedService!,
                        doctorId: doctor.id,
                      )),
            ),
          );
        },
      );

  Widget _stateFrame(String title, Widget child) => OwnerV50PetPageFrame(
        eyebrow: 'Каталог VetHelp',
        title: title,
        supportingText:
            'Публичные данные без раскрытия внутренних сведений клиники.',
        leading: TextButton.icon(
          onPressed: _back,
          icon: const Icon(Icons.arrow_back),
          label: const Text('Назад'),
        ),
        child: child,
      );
}

class _CatalogFilters extends StatefulWidget {
  const _CatalogFilters({required this.filters, required this.onChanged});
  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;

  @override
  State<_CatalogFilters> createState() => _CatalogFiltersState();
}

class _CatalogFiltersState extends State<_CatalogFilters> {
  bool _secondaryOpen = false;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final filters = widget.filters;
          final wide = constraints.maxWidth >= 720;
          final hasSelection = filters.openNow == true ||
              filters.serviceCode != null ||
              filters.telemedAvailable == true ||
              filters.emergencyCapability != null ||
              filters.sort != 'soonest';
          final showSecondary = wide ||
              _secondaryOpen ||
              filters.telemedAvailable == true ||
              filters.sort != 'soonest';
          final primary = <Widget>[
            _touchTarget(
              FilterChip(
                key: const ValueKey('catalog-filter-open'),
                label: const Text('Есть окна'),
                selected: filters.openNow == true,
                onSelected: (value) =>
                    widget.onChanged(filters.copyWith(openNow: value)),
              ),
            ),
            _touchTarget(
              FilterChip(
                key: const ValueKey('catalog-filter-service'),
                label: const Text('Первичный приём'),
                selected: filters.serviceCode == 'GENERAL_VISIT',
                onSelected: (value) => widget.onChanged(filters.copyWith(
                  serviceCode: value ? 'GENERAL_VISIT' : null,
                  clearServiceCode: !value,
                )),
              ),
            ),
          ];
          final secondary = <Widget>[
            _touchTarget(
              FilterChip(
                key: const ValueKey('catalog-filter-telemed'),
                label: const Text('Онлайн-консультация'),
                selected: filters.telemedAvailable == true,
                onSelected: (value) =>
                    widget.onChanged(filters.copyWith(telemedAvailable: value)),
              ),
            ),
            _touchTarget(
              DropdownButton<String>(
                key: const ValueKey('catalog-sort'),
                value: filters.sort,
                items: const [
                  DropdownMenuItem(
                      value: 'soonest', child: Text('Раньше доступно')),
                  DropdownMenuItem(value: 'distance', child: Text('Ближе')),
                  DropdownMenuItem(value: 'name', child: Text('По названию')),
                ],
                onChanged: (value) {
                  if (value != null) {
                    widget.onChanged(filters.copyWith(sort: value));
                  }
                },
              ),
            ),
          ];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(spacing: 8, runSpacing: 4, children: primary),
              if (!wide)
                Align(
                  alignment: Alignment.centerLeft,
                  child: _touchTarget(
                    TextButton.icon(
                      key: const ValueKey('catalog-secondary-filters'),
                      onPressed: () =>
                          setState(() => _secondaryOpen = !_secondaryOpen),
                      icon: Icon(showSecondary
                          ? Icons.expand_less
                          : Icons.tune_outlined),
                      label: Text(showSecondary
                          ? 'Скрыть дополнительные'
                          : 'Ещё фильтры'),
                    ),
                  ),
                ),
              if (showSecondary) ...[
                const SizedBox(height: 4),
                Wrap(spacing: 12, runSpacing: 4, children: secondary),
              ],
              if (hasSelection) ...[
                const SizedBox(height: 4),
                Row(children: [
                  const Icon(Icons.filter_alt_outlined, size: 18),
                  const SizedBox(width: 6),
                  const Expanded(child: Text('Выбранные условия применены')),
                  _touchTarget(
                    TextButton(
                      key: const ValueKey('catalog-filters-reset'),
                      onPressed: () =>
                          widget.onChanged(const CatalogClinicFilters()),
                      child: const Text('Сбросить'),
                    ),
                  ),
                ]),
              ],
            ],
          );
        },
      );

  Widget _touchTarget(Widget child) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44),
        child: Center(widthFactor: 1, heightFactor: 1, child: child),
      );
}

class _ClinicCard extends StatelessWidget {
  const _ClinicCard({
    required this.clinic,
    required this.featured,
    required this.onOpen,
  });
  final CatalogClinic clinic;
  final bool featured;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 480;
            final identity = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(clinic.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                Text('${clinic.locationCount} адресов'),
              ],
            );
            final fit = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Почему подходит',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                for (final reason in clinic.fitReasons.take(3))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Row(children: [
                      const Icon(Icons.check_circle_outline, size: 18),
                      const SizedBox(width: 7),
                      Expanded(child: Text(reason)),
                    ]),
                  ),
              ],
            );
            final facts = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CatalogFact(
                  key: const ValueKey('catalog-card-availability'),
                  icon: Icons.event_available_outlined,
                  label: 'Ближайшая доступность',
                  value: _nextAvailableText(clinic.nextAvailableAt),
                  emphasized: true,
                  compact: wide,
                ),
                const SizedBox(height: 6),
                _CatalogFact(
                  key: const ValueKey('catalog-card-confirmation'),
                  icon: Icons.verified_outlined,
                  label: 'Подтверждение',
                  value:
                      _confirmationText(clinic.availability.confirmationMode),
                  compact: wide,
                ),
                if (clinic.priceFrom != null) ...[
                  const SizedBox(height: 6),
                  _CatalogFact(
                    key: const ValueKey('catalog-card-price'),
                    icon: Icons.payments_outlined,
                    label: 'Стоимость приёма',
                    value: 'от ${clinic.priceFrom} ₽',
                    compact: wide,
                  ),
                ],
              ],
            );
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (wide)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ClinicMedia(
                        clinicId: clinic.id,
                        clinicName: clinic.name,
                        featured: featured,
                        availability: clinic.availability,
                        width: 140,
                        height: 140,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            identity,
                            const SizedBox(height: 8),
                            fit,
                            const SizedBox(height: 8),
                            facts,
                          ],
                        ),
                      ),
                    ],
                  )
                else ...[
                  _ClinicMedia(
                    clinicId: clinic.id,
                    clinicName: clinic.name,
                    featured: featured,
                    availability: clinic.availability,
                    width: double.infinity,
                    height: 112,
                  ),
                  const SizedBox(height: 10),
                  identity,
                  const SizedBox(height: 8),
                  fit,
                  const SizedBox(height: 10),
                  facts,
                ],
                const SizedBox(height: 6),
                if (wide)
                  Wrap(spacing: 12, runSpacing: 4, children: [
                    if (clinic.distanceKm != null)
                      Text('${clinic.distanceKm} км от выбранной точки',
                          style: Theme.of(context).textTheme.bodySmall),
                    Text('${clinic.doctorCount} специалистов',
                        style: Theme.of(context).textTheme.bodySmall),
                    if (clinic.telemedAvailable)
                      Text('Онлайн-консультация',
                          style: Theme.of(context).textTheme.bodySmall),
                    if (clinic.emergencyAvailable)
                      Text('Экстренная возможность проверена',
                          style: Theme.of(context).textTheme.bodySmall),
                  ])
                else ...[
                  if (clinic.distanceKm != null)
                    Text('${clinic.distanceKm} км от выбранной точки',
                        style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 6),
                  Wrap(spacing: 8, runSpacing: 4, children: [
                    Chip(label: Text('${clinic.doctorCount} специалистов')),
                    if (clinic.telemedAvailable)
                      const Chip(label: Text('Онлайн-консультация')),
                    if (clinic.emergencyAvailable)
                      const Chip(
                          label: Text('Экстренная возможность проверена')),
                  ]),
                ],
                const SizedBox(height: 6),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: ValueKey('catalog-clinic-${clinic.id}'),
                    onPressed: onOpen,
                    child: const Text('Открыть клинику'),
                  ),
                ),
              ],
            );
          },
        ),
      );
}

class _ClinicMedia extends StatelessWidget {
  const _ClinicMedia({
    required this.clinicId,
    required this.clinicName,
    required this.featured,
    required this.availability,
    required this.width,
    required this.height,
  });

  final String clinicId;
  final String clinicName;
  final bool featured;
  final CatalogAvailabilitySummary availability;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<VetHelpSurfaceTokens>();
    final success = tokens?.success ?? colors.tertiary;
    final freshness = _catalogFreshnessText(availability);
    final stale =
        availability.freshness == CatalogAvailabilityFreshness.stale ||
            availability.freshness == CatalogAvailabilityFreshness.unavailable;
    return Semantics(
      key: ValueKey('catalog-clinic-media-$clinicId'),
      image: true,
      label: 'Иллюстрация клиники $clinicName. $freshness',
      child: ExcludeSemantics(
        child: Container(
          width: width,
          height: height,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                featured
                    ? success.withValues(alpha: 0.28)
                    : colors.surfaceContainerHigh,
                colors.surfaceContainerLowest,
              ],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: featured
                  ? success.withValues(alpha: 0.42)
                  : colors.outlineVariant,
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                right: -18,
                top: -24,
                child: Container(
                  width: 94,
                  height: 94,
                  decoration: BoxDecoration(
                    color: success.withValues(alpha: 0.13),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                left: 18,
                bottom: -30,
                child: Container(
                  width: 112,
                  height: 74,
                  decoration: BoxDecoration(
                    color: colors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(40),
                  ),
                ),
              ),
              Align(
                alignment: const Alignment(-0.45, -0.05),
                child: Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(Icons.local_hospital_outlined,
                      size: 34, color: colors.primary),
                ),
              ),
              Positioned(
                right: 10,
                bottom: 10,
                child: Container(
                  key: const ValueKey('catalog-card-freshness'),
                  constraints: const BoxConstraints(maxWidth: 124),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: stale
                        ? colors.errorContainer
                        : colors.surface.withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    freshness,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: stale
                              ? colors.onErrorContainer
                              : colors.onSurface,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CatalogFact extends StatelessWidget {
  const _CatalogFact({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.emphasized = false,
    this.compact = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool emphasized;
  final bool compact;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: compact
                ? Text(
                    '$label · $value',
                    style: emphasized
                        ? Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w800)
                        : Theme.of(context).textTheme.bodyMedium,
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: Theme.of(context).textTheme.labelMedium),
                      Text(value,
                          style: emphasized
                              ? Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800)
                              : Theme.of(context).textTheme.bodyMedium),
                    ],
                  ),
          ),
        ],
      );
}

class _ClinicDetailContent extends StatefulWidget {
  const _ClinicDetailContent({
    required this.clinic,
    required this.repository,
    required this.selectedLocation,
    required this.selectedService,
    required this.onLocation,
    required this.onService,
    required this.onContinue,
    this.onDoctors,
  });
  final CatalogClinicDetail clinic;
  final PublicCatalogRepository repository;
  final CatalogLocation? selectedLocation;
  final CatalogService? selectedService;
  final ValueChanged<CatalogLocation> onLocation;
  final ValueChanged<CatalogService> onService;
  final VoidCallback? onContinue;
  final VoidCallback? onDoctors;

  @override
  State<_ClinicDetailContent> createState() => _ClinicDetailContentState();
}

class _ClinicDetailContentState extends State<_ClinicDetailContent> {
  Future<List<CatalogService>>? _services;
  Future<List<CatalogDoctor>>? _doctorPreview;
  String? _loadedLocation;
  String? _loadedDoctorLocation;
  final _servicesKey = GlobalKey();

  void _handleHeroAction() {
    if (widget.onContinue != null) {
      widget.onContinue!();
      return;
    }
    final target = _servicesKey.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(
        target,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        alignment: 0.08,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = widget.selectedLocation;
    if (location != null && location.locationId != _loadedLocation) {
      _loadedLocation = location.locationId;
      _services = widget.repository.listLocationServices(location.locationId);
    }
    if (location != null && location.locationId != _loadedDoctorLocation) {
      _loadedDoctorLocation = location.locationId;
      _doctorPreview = widget.repository.listDoctors(
        clinicId: widget.clinic.id,
        locationId: location.locationId,
      );
    }
    return LayoutBuilder(builder: (context, constraints) {
      final wide = constraints.maxWidth >= 760;
      final heroDetails = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(widget.clinic.name,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(location?.address ?? 'Выберите адрес клиники'),
          const SizedBox(height: 10),
          Text(_nextAvailableText(widget.clinic.nextAvailableAt),
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          Text(_confirmationText(widget.clinic.availability.confirmationMode)),
          const SizedBox(height: 12),
          FilledButton.icon(
            key: const ValueKey('clinic-hero-action'),
            onPressed: location == null ? null : _handleHeroAction,
            icon: const Icon(Icons.arrow_forward),
            label: Text(widget.selectedService == null
                ? 'Выбрать услугу'
                : 'Перейти к выбору времени'),
          ),
          const SizedBox(height: 6),
          const Text(
            'Действие не создаёт удержание: услуга и время подтверждаются на следующих шагах.',
          ),
        ],
      );
      final hero = OwnerV50InsetSection(
        key: const ValueKey('clinic-compact-hero'),
        child: Flex(
          direction: wide ? Axis.horizontal : Axis.vertical,
          crossAxisAlignment:
              wide ? CrossAxisAlignment.start : CrossAxisAlignment.stretch,
          children: [
            Container(
              key: const ValueKey('clinic-hero-media'),
              width: wide ? 156 : null,
              height: wide ? 156 : 104,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.local_hospital_outlined, size: 48),
            ),
            SizedBox(width: wide ? 18 : 0, height: wide ? 0 : 14),
            if (wide) Expanded(child: heroDetails) else heroDetails,
          ],
        ),
      );
      final availability = OwnerV50InsetSection(
        key: const ValueKey('clinic-availability-section'),
        title: 'Доступность по адресам',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
                _confirmationText(widget.clinic.availability.confirmationMode)),
            const SizedBox(height: 8),
            Text('Ближайшее окно: '
                '${_nextAvailableText(widget.clinic.nextAvailableAt)}'),
            const SizedBox(height: 8),
            ...widget.clinic.locations.map((item) => RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  value: item.locationId,
                  groupValue: location?.locationId,
                  title: Text(item.address),
                  subtitle: Text(item.hasOpenSlots
                      ? 'Есть подтверждаемые окна'
                      : 'Нет подтверждённых окон'),
                  onChanged: (_) => widget.onLocation(item),
                )),
          ],
        ),
      );
      final services = OwnerV50InsetSection(
        key: _servicesKey,
        title: 'Услуги и стоимость',
        child: _services == null
            ? const Text('Выберите локацию')
            : FutureBuilder<List<CatalogService>>(
                future: _services,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const LinearProgressIndicator();
                  }
                  final services = snapshot.data ?? const <CatalogService>[];
                  if (services.isEmpty) {
                    return const Text(
                        'В этой локации нет активных публичных услуг.');
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ...services.map((service) => RadioListTile<String>(
                            contentPadding: EdgeInsets.zero,
                            value: service.id,
                            groupValue: widget.selectedService?.id,
                            title: Text(service.displayName),
                            subtitle: Text(
                              '${service.durationMinutes} мин · базовая цена от '
                              '${service.priceAmount} ${service.currency}',
                            ),
                            onChanged: (_) => widget.onService(service),
                          )),
                      const SizedBox(height: 8),
                      const Text(
                        'Базовая цена относится к выбранной публичной услуге. '
                        'Дополнительные процедуры согласуются отдельно; '
                        'итоговая стоимость известна после согласования.',
                      ),
                      const SizedBox(height: 14),
                      FilledButton(
                        key: const ValueKey('clinic-booking-action'),
                        onPressed: widget.onContinue,
                        child: const Text('Перейти к выбору времени'),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                          'Переход не создаёт удержание слота. Доступность повторно проверит booking backend.'),
                    ],
                  );
                },
              ),
      );
      final doctors = OwnerV50InsetSection(
        key: const ValueKey('clinic-doctors-section'),
        title: 'Специалисты',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
                '${widget.clinic.doctorCount} активных публичных специалистов'),
            const SizedBox(height: 10),
            if (_doctorPreview == null)
              const Text('Выберите адрес, чтобы увидеть специалистов.')
            else
              FutureBuilder<List<CatalogDoctor>>(
                future: _doctorPreview,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const LinearProgressIndicator();
                  }
                  if (snapshot.hasError) {
                    return const Text(
                        'Не удалось загрузить превью специалистов.');
                  }
                  final preview =
                      (snapshot.data ?? const <CatalogDoctor>[]).take(2);
                  if (preview.isEmpty) {
                    return const Text(
                        'Для этого адреса публичные специалисты не найдены.');
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final doctor in preview)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                              child: Text(doctor.displayName.characters.first)),
                          title: Text(doctor.displayName),
                          subtitle: Text(
                              '${doctor.title} · ${_availabilityText(doctor.availability)}'),
                        ),
                    ],
                  );
                },
              ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              key: const ValueKey('clinic-doctors-action'),
              onPressed: widget.onDoctors,
              icon: const Icon(Icons.medical_services_outlined),
              label: const Text('Посмотреть специалистов'),
            ),
          ],
        ),
      );
      final contact = OwnerV50InsetSection(
        key: const ValueKey('clinic-contact-section'),
        title: 'Возможности и контакты',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (location != null) ...[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.place_outlined),
                title: Text(location.address),
              ),
              if (location.phone != null)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.phone_outlined),
                  title: Text(location.phone!),
                ),
            ],
            const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.schedule_outlined),
              title: Text('Часы работы не опубликованы'),
              subtitle: Text('Уточните время работы у клиники.'),
            ),
            Wrap(spacing: 8, runSpacing: 6, children: [
              if (widget.clinic.telemedAvailable)
                const Chip(label: Text('Онлайн-консультация')),
              if (widget.clinic.emergencyAvailable)
                const Chip(label: Text('Экстренная возможность проверена')),
            ]),
          ],
        ),
      );
      final primary = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          availability,
          const SizedBox(height: 16),
          services,
        ],
      );
      final secondary = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          doctors,
          const SizedBox(height: 16),
          contact,
        ],
      );
      final freshness = _freshnessBanner(widget.clinic.availability);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          hero,
          const SizedBox(height: 16),
          if (wide)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 3, child: primary),
              const SizedBox(width: 18),
              Expanded(flex: 2, child: secondary),
            ])
          else ...[
            primary,
            const SizedBox(height: 16),
            secondary,
          ],
          if (freshness != null) ...[
            const SizedBox(height: 16),
            KeyedSubtree(
              key: const ValueKey('clinic-freshness-section'),
              child: freshness,
            ),
          ],
        ],
      );
    });
  }
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor, required this.onOpen});
  final CatalogDoctor doctor;
  final VoidCallback onOpen;
  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CircleAvatar(
              radius: 34, child: Text(doctor.displayName.characters.first)),
          const SizedBox(height: 12),
          Text(doctor.displayName,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          Text(doctor.title),
          const SizedBox(height: 8),
          Text(_availabilityText(doctor.availability)),
          const SizedBox(height: 12),
          FilledButton(
            key: ValueKey('doctor-card-${doctor.id}'),
            onPressed: onOpen,
            child: const Text('Открыть профиль'),
          ),
        ]),
      );
}

class _DoctorProfile extends StatelessWidget {
  const _DoctorProfile(
      {required this.doctor, required this.canContinue, this.onContinue});
  final CatalogDoctor doctor;
  final bool canContinue;
  final VoidCallback? onContinue;
  @override
  Widget build(BuildContext context) =>
      LayoutBuilder(builder: (context, constraints) {
        final identity = OwnerV50InsetSection(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CircleAvatar(
                radius: 58,
                child: Text(doctor.displayName.characters.first,
                    style: Theme.of(context).textTheme.headlineLarge)),
            const SizedBox(height: 16),
            Text(doctor.displayName,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
            Text(doctor.title),
            const SizedBox(height: 8),
            const Chip(label: Text('Активное назначение клиники')),
          ]),
        );
        final details = OwnerV50InsetSection(
          title: 'Публичная информация',
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ListTile(
                leading: const Icon(Icons.local_hospital_outlined),
                title: Text(doctor.clinicName),
                subtitle: Text(doctor.locationAddress)),
            ListTile(
                leading: const Icon(Icons.schedule_outlined),
                title: const Text('Ближайшая доступность'),
                subtitle: Text(_availabilityText(doctor.availability))),
            const Text(
                'Биография, рейтинги и документы не показаны: для них нет отдельного публичного контракта.'),
            const SizedBox(height: 16),
            FilledButton(
              key: const ValueKey('doctor-booking-action'),
              onPressed: onContinue,
              child: Text(canContinue
                  ? 'Выбрать врача и время'
                  : 'Сначала выберите услугу в клинике'),
            ),
          ]),
        );
        return constraints.maxWidth >= 850
            ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: identity),
                const SizedBox(width: 18),
                Expanded(flex: 2, child: details)
              ])
            : Column(children: [identity, const SizedBox(height: 16), details]);
      });
}

class _CatalogMapFallback extends StatefulWidget {
  const _CatalogMapFallback(
      {required this.clinics,
      required this.locationState,
      required this.onOpen});
  final List<CatalogClinic> clinics;
  final OwnerCatalogLocationState locationState;
  final ValueChanged<CatalogClinic> onOpen;

  @override
  State<_CatalogMapFallback> createState() => _CatalogMapFallbackState();
}

class _CatalogMapFallbackState extends State<_CatalogMapFallback> {
  String? _selectedId;

  CatalogClinic get _selected => widget.clinics.firstWhere(
        (clinic) => clinic.id == _selectedId,
        orElse: () => widget.clinics.first,
      );

  @override
  void initState() {
    super.initState();
    _selectedId = widget.clinics.first.id;
  }

  @override
  void didUpdateWidget(covariant _CatalogMapFallback oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.clinics.any((clinic) => clinic.id == _selectedId)) {
      _selectedId = widget.clinics.first.id;
    }
  }

  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        key: const ValueKey('catalog-map-mode'),
        title: 'Список и локальная карта',
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            height: 220,
            decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(18)),
            clipBehavior: Clip.antiAlias,
            child: widget.locationState == OwnerCatalogLocationState.available
                ? Stack(
                    children: [
                      const Positioned.fill(child: _LocalMapPattern()),
                      for (var index = 0;
                          index < widget.clinics.length;
                          index++)
                        Align(
                          alignment: _markerAlignment(index),
                          child: Semantics(
                            selected: widget.clinics[index].id == _selected.id,
                            label: 'Маркер ${widget.clinics[index].name}',
                            child: Material(
                              key: ValueKey(
                                  'catalog-map-marker-${widget.clinics[index].id}'),
                              color: widget.clinics[index].id == _selected.id
                                  ? Theme.of(context).colorScheme.primary
                                  : Theme.of(context).colorScheme.surface,
                              shape: const CircleBorder(),
                              elevation: 3,
                              child: InkWell(
                                customBorder: const CircleBorder(),
                                onTap: () => setState(() =>
                                    _selectedId = widget.clinics[index].id),
                                child: SizedBox.square(
                                  dimension: 48,
                                  child: Icon(
                                    Icons.location_on,
                                    color: widget.clinics[index].id ==
                                            _selected.id
                                        ? Theme.of(context)
                                            .colorScheme
                                            .onPrimary
                                        : Theme.of(context).colorScheme.primary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        left: 12,
                        right: 12,
                        bottom: 10,
                        child: Text(
                          'Локальный предпросмотр · выбран ${_selected.name}',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
                    ],
                  )
                : const Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.wrong_location_outlined, size: 48),
                      SizedBox(height: 8),
                      Text('Карта недоступна — полный список сохранён'),
                    ]),
                  ),
          ),
          const SizedBox(height: 14),
          Text('Список остаётся основным',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          for (final clinic in widget.clinics)
            Container(
              key: ValueKey(
                  'catalog-map-card-${clinic.id}-${clinic.id == _selected.id ? 'selected' : 'idle'}'),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: clinic.id == _selected.id
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outlineVariant,
                  width: clinic.id == _selected.id ? 2 : 1,
                ),
              ),
              child: ListTile(
                key: ValueKey('catalog-map-clinic-${clinic.id}'),
                selected: clinic.id == _selected.id,
                leading: const Icon(Icons.location_on_outlined),
                title: Text(clinic.name),
                subtitle: Text(_nextAvailableText(clinic.nextAvailableAt)),
                onTap: () => setState(() => _selectedId = clinic.id),
                trailing: TextButton(
                  key: ValueKey('catalog-map-open-${clinic.id}'),
                  onPressed: () => widget.onOpen(clinic),
                  child: const Text('Открыть'),
                ),
              ),
            ),
        ]),
      );

  Alignment _markerAlignment(int index) => const [
        Alignment(-0.58, -0.36),
        Alignment(0.44, -0.12),
        Alignment(-0.12, 0.42),
        Alignment(0.66, 0.46),
      ][index % 4];
}

class _LocalMapPattern extends StatelessWidget {
  const _LocalMapPattern();

  @override
  Widget build(BuildContext context) => CustomPaint(
        painter: _LocalMapPainter(
          lineColor: Theme.of(context).colorScheme.outlineVariant,
          areaColor: Theme.of(context).colorScheme.secondaryContainer,
        ),
      );
}

class _LocalMapPainter extends CustomPainter {
  const _LocalMapPainter({required this.lineColor, required this.areaColor});

  final Color lineColor;
  final Color areaColor;

  @override
  void paint(Canvas canvas, Size size) {
    final areaPaint = Paint()..color = areaColor.withValues(alpha: 0.45);
    canvas.drawCircle(Offset(size.width * 0.78, size.height * 0.22),
        size.shortestSide * 0.24, areaPaint);
    final roadPaint = Paint()
      ..color = lineColor
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    final road = Path()
      ..moveTo(-10, size.height * 0.68)
      ..quadraticBezierTo(size.width * 0.3, size.height * 0.35, size.width + 10,
          size.height * 0.52);
    canvas.drawPath(road, roadPaint);
    canvas.drawLine(Offset(size.width * 0.25, -10),
        Offset(size.width * 0.58, size.height + 10), roadPaint);
  }

  @override
  bool shouldRepaint(covariant _LocalMapPainter oldDelegate) =>
      oldDelegate.lineColor != lineColor || oldDelegate.areaColor != areaColor;
}

class _CatalogSkeleton extends StatelessWidget {
  const _CatalogSkeleton();
  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        key: const ValueKey('catalog-loading'),
        child: Column(
            children: List.generate(
                3,
                (index) => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: LinearProgressIndicator(minHeight: 14),
                    ))),
      );
}

class _CatalogError extends StatelessWidget {
  const _CatalogError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => OwnerV50StatusBanner(
        icon: Icons.cloud_off_outlined,
        title: 'Каталог временно недоступен',
        message: 'Безопасно повторите запрос. Данные выбора не потеряны.',
        warning: true,
        action: TextButton(onPressed: onRetry, child: const Text('Повторить')),
      );
}

class _CatalogEmpty extends StatelessWidget {
  const _CatalogEmpty({required this.filtered, required this.onClear});
  final bool filtered;
  final VoidCallback onClear;
  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        key: const ValueKey('catalog-empty'),
        child: Column(children: [
          const Icon(Icons.search_off_outlined, size: 52),
          const SizedBox(height: 12),
          Text(
              filtered
                  ? 'По этим условиям клиник нет'
                  : 'Активные клиники пока не найдены',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text(
              'Измените поиск или очистите фильтры. Каталог не подставляет демонстрационные варианты.'),
          if (filtered)
            TextButton(
                onPressed: onClear, child: const Text('Очистить фильтры')),
        ]),
      );
}

class _SimpleEmpty extends StatelessWidget {
  const _SimpleEmpty(
      {required this.icon, required this.title, required this.message});
  final IconData icon;
  final String title;
  final String message;
  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        child: Column(children: [
          Icon(icon, size: 52),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message)
        ]),
      );
}

Widget? _freshnessBanner(CatalogAvailabilitySummary availability) =>
    switch (availability.freshness) {
      CatalogAvailabilityFreshness.current => const OwnerV50StatusBanner(
          icon: Icons.update,
          title: 'Расписание обновлено недавно',
          message: 'Время будет повторно проверено перед созданием удержания.'),
      CatalogAvailabilityFreshness.aging => const OwnerV50StatusBanner(
          icon: Icons.sync,
          title: 'Уточняем актуальность времени',
          message: 'Клиника подтвердит выбранное окно.'),
      CatalogAvailabilityFreshness.stale => const OwnerV50StatusBanner(
          icon: Icons.history,
          title: 'Время может измениться',
          message:
              'Расписание устарело — заявка потребует подтверждения клиники.',
          warning: true),
      CatalogAvailabilityFreshness.unavailable => const OwnerV50StatusBanner(
          icon: Icons.event_busy_outlined,
          title: 'Нет подтверждённых окон',
          message:
              'Можно посмотреть услуги и специалистов без обещания времени.'),
    };

String _availabilityText(CatalogAvailabilitySummary availability) =>
    switch (availability.freshness) {
      CatalogAvailabilityFreshness.current => 'Расписание обновлено недавно',
      CatalogAvailabilityFreshness.aging => 'Уточняем актуальность времени',
      CatalogAvailabilityFreshness.stale => 'Время может измениться',
      CatalogAvailabilityFreshness.unavailable => 'Нет подтверждённых окон',
    };

String _catalogFreshnessText(CatalogAvailabilitySummary availability) =>
    switch (availability.freshness) {
      CatalogAvailabilityFreshness.current => 'Обновлено недавно',
      CatalogAvailabilityFreshness.aging => 'Расписание уточняется',
      CatalogAvailabilityFreshness.stale => 'Расписание устарело',
      CatalogAvailabilityFreshness.unavailable => 'Расписание недоступно',
    };

String _nextAvailableText(DateTime? value) {
  if (value == null) return 'Ближайшие окна уточняются';
  String twoDigits(int part) => part.toString().padLeft(2, '0');
  return '${twoDigits(value.day)}.${twoDigits(value.month)} · '
      '${twoDigits(value.hour)}:${twoDigits(value.minute)}';
}

String _confirmationText(CatalogConfirmationMode mode) => switch (mode) {
      CatalogConfirmationMode.instant => 'Запись подтверждается сразу',
      CatalogConfirmationMode.clinicConfirmation => 'Клиника подтвердит заявку',
      CatalogConfirmationMode.alternativePossible =>
        'Клиника может предложить другое время',
    };
