import 'package:flutter/material.dart';

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
              child: Column(
                children: [
                  TextField(
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
                  ),
                  const SizedBox(height: 14),
                  _CatalogFilters(
                    filters: _filters,
                    onChanged: _setFilters,
                  ),
                  const SizedBox(height: 14),
                  SegmentedButton<bool>(
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
                  ),
                ],
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
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: columns,
                        mainAxisExtent: 370,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                      ),
                      itemCount: clinics.length,
                      itemBuilder: (_, index) => _ClinicCard(
                        clinic: clinics[index],
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
            status: _freshnessBanner(clinic.availability),
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

class _CatalogFilters extends StatelessWidget {
  const _CatalogFilters({required this.filters, required this.onChanged});
  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          FilterChip(
            key: const ValueKey('catalog-filter-open'),
            label: const Text('Есть окна'),
            selected: filters.openNow == true,
            onSelected: (value) => onChanged(filters.copyWith(openNow: value)),
          ),
          FilterChip(
            key: const ValueKey('catalog-filter-service'),
            label: const Text('Первичный приём'),
            selected: filters.serviceCode == 'GENERAL_VISIT',
            onSelected: (value) => onChanged(filters.copyWith(
              serviceCode: value ? 'GENERAL_VISIT' : null,
              clearServiceCode: !value,
            )),
          ),
          FilterChip(
            key: const ValueKey('catalog-filter-telemed'),
            label: const Text('Онлайн'),
            selected: filters.telemedAvailable == true,
            onSelected: (value) =>
                onChanged(filters.copyWith(telemedAvailable: value)),
          ),
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
              if (value != null) onChanged(filters.copyWith(sort: value));
            },
          ),
        ],
      );
}

class _ClinicCard extends StatelessWidget {
  const _ClinicCard({required this.clinic, required this.onOpen});
  final CatalogClinic clinic;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.local_hospital_outlined, size: 34),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(clinic.name,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800)),
                      Text(_availabilityText(clinic.availability)),
                    ]),
              ),
            ]),
            const SizedBox(height: 14),
            Text('Почему подходит',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            for (final reason in clinic.fitReasons.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  const Icon(Icons.check_circle_outline, size: 18),
                  const SizedBox(width: 7),
                  Expanded(child: Text(reason))
                ]),
              ),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 6, children: [
              Chip(label: Text('${clinic.doctorCount} специалистов')),
              if (clinic.priceFrom != null)
                Chip(label: Text('от ${clinic.priceFrom} ₽')),
              if (clinic.distanceKm != null)
                Chip(label: Text('${clinic.distanceKm} км')),
              if (clinic.emergencyAvailable)
                const Chip(label: Text('Экстренная возможность проверена')),
            ]),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: ValueKey('catalog-clinic-${clinic.id}'),
                onPressed: onOpen,
                child: const Text('Открыть клинику'),
              ),
            ),
          ],
        ),
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
  String? _loadedLocation;

  @override
  Widget build(BuildContext context) {
    final location = widget.selectedLocation;
    if (location != null && location.locationId != _loadedLocation) {
      _loadedLocation = location.locationId;
      _services = widget.repository.listLocationServices(location.locationId);
    }
    return LayoutBuilder(builder: (context, constraints) {
      final wide = constraints.maxWidth >= 900;
      final primary =
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        OwnerV50InsetSection(
          title: 'Локация',
          child: Column(
            children: widget.clinic.locations
                .map((item) => RadioListTile<String>(
                      value: item.locationId,
                      groupValue: location?.locationId,
                      title: Text(item.address),
                      subtitle: Text(item.hasOpenSlots
                          ? 'Есть подтверждаемые окна'
                          : 'Нет подтверждённых окон'),
                      onChanged: (_) => widget.onLocation(item),
                    ))
                .toList(growable: false),
          ),
        ),
        const SizedBox(height: 16),
        OwnerV50InsetSection(
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
                      children: services
                          .map((service) => RadioListTile<String>(
                                value: service.id,
                                groupValue: widget.selectedService?.id,
                                title: Text(service.displayName),
                                subtitle: Text(
                                    '${service.durationMinutes} мин · от ${service.priceAmount} ${service.currency}'),
                                onChanged: (_) => widget.onService(service),
                              ))
                          .toList(growable: false),
                    );
                  },
                ),
        ),
      ]);
      final secondary =
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        OwnerV50InsetSection(
          title: 'Как подтверждается запись',
          child: Text(
              _confirmationText(widget.clinic.availability.confirmationMode)),
        ),
        const SizedBox(height: 16),
        OwnerV50InsetSection(
          title: 'Специалисты',
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(
                '${widget.clinic.doctorCount} активных публичных специалистов'),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              key: const ValueKey('clinic-doctors-action'),
              onPressed: widget.onDoctors,
              icon: const Icon(Icons.medical_services_outlined),
              label: const Text('Выбрать специалиста'),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        FilledButton(
          key: const ValueKey('clinic-booking-action'),
          onPressed: widget.onContinue,
          child: const Text('Перейти к выбору времени'),
        ),
        const SizedBox(height: 8),
        const Text(
            'Переход не создаёт удержание слота. Доступность повторно проверит booking backend.'),
      ]);
      return wide
          ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 3, child: primary),
              const SizedBox(width: 18),
              Expanded(flex: 2, child: secondary)
            ])
          : Column(children: [primary, const SizedBox(height: 16), secondary]);
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

class _CatalogMapFallback extends StatelessWidget {
  const _CatalogMapFallback(
      {required this.clinics,
      required this.locationState,
      required this.onOpen});
  final List<CatalogClinic> clinics;
  final OwnerCatalogLocationState locationState;
  final ValueChanged<CatalogClinic> onOpen;
  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        key: const ValueKey('catalog-map-mode'),
        title: 'Карта и список рядом',
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            height: 220,
            decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(18)),
            alignment: Alignment.center,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(
                  locationState == OwnerCatalogLocationState.available
                      ? Icons.map_outlined
                      : Icons.wrong_location_outlined,
                  size: 48),
              const SizedBox(height: 8),
              Text(locationState == OwnerCatalogLocationState.available
                  ? 'Маркеры используют те же данные, что и список'
                  : 'Карта недоступна — полный список сохранён'),
            ]),
          ),
          const SizedBox(height: 14),
          for (final clinic in clinics)
            ListTile(
              key: ValueKey('catalog-map-clinic-${clinic.id}'),
              leading: const Icon(Icons.location_on_outlined),
              title: Text(clinic.name),
              subtitle: Text(_availabilityText(clinic.availability)),
              onTap: () => onOpen(clinic),
            ),
        ]),
      );
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

String _confirmationText(CatalogConfirmationMode mode) => switch (mode) {
      CatalogConfirmationMode.instant => 'Запись подтверждается сразу',
      CatalogConfirmationMode.clinicConfirmation => 'Клиника подтвердит заявку',
      CatalogConfirmationMode.alternativePossible =>
        'Клиника может предложить другое время',
    };
