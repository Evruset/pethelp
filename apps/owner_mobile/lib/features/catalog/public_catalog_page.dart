import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../presentation/platform/owner_platform.dart';
import '../../presentation/widgets/owner_cupertino_feedback.dart';
import '../../ui/vethelp_owner_components.dart';
import 'catalog_models.dart';
import 'public_catalog_repository.dart';

class PublicCatalogPage extends StatefulWidget {
  const PublicCatalogPage({
    super.key,
    required this.repository,
    required this.onSelected,
    this.platformOverride,
    this.bookingPetName,
    this.bookingContextNote,
    this.onChangePet,
  });

  final PublicCatalogRepository repository;
  final ValueChanged<CatalogBookingSelection> onSelected;
  final TargetPlatform? platformOverride;
  final String? bookingPetName;
  final String? bookingContextNote;
  final VoidCallback? onChangePet;

  @override
  State<PublicCatalogPage> createState() => _PublicCatalogPageState();
}

class _PublicCatalogPageState extends State<PublicCatalogPage> {
  final _search = TextEditingController();
  CatalogClinicFilters _filters = const CatalogClinicFilters();
  Future<List<CatalogClinic>>? _clinicsRequest;
  Future<CatalogClinicDetail>? _detailRequest;
  CatalogClinic? _openedClinic;

  @override
  void initState() {
    super.initState();
    _reloadClinics();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _reloadClinics() {
    final filters = _filters.copyWith(
      query: _search.text.trim(),
      clearQuery: _search.text.trim().isEmpty,
    );
    setState(() {
      _filters = filters;
      _clinicsRequest = widget.repository.listClinics(filters: filters);
      _openedClinic = null;
      _detailRequest = null;
    });
  }

  void _clearFilters() {
    _search.clear();
    setState(() {
      _filters = const CatalogClinicFilters();
      _clinicsRequest = widget.repository.listClinics(filters: _filters);
      _openedClinic = null;
      _detailRequest = null;
    });
  }

  void _applyFilters(CatalogClinicFilters filters) {
    setState(() {
      _filters = filters.copyWith(
        query: _search.text.trim(),
        clearQuery: _search.text.trim().isEmpty,
      );
      _clinicsRequest = widget.repository.listClinics(filters: _filters);
      _openedClinic = null;
      _detailRequest = null;
    });
  }

  void _openClinic(CatalogClinic clinic) {
    setState(() {
      _openedClinic = clinic;
      _detailRequest = widget.repository.readClinic(clinic.id);
    });
  }

  void _reloadDetail() {
    final clinic = _openedClinic;
    if (clinic == null) return;
    setState(() => _detailRequest = widget.repository.readClinic(clinic.id));
  }

  void _backToClinics() {
    setState(() {
      _openedClinic = null;
      _detailRequest = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final clinic = _openedClinic;
    if (ownerUsesCupertino(platform: widget.platformOverride)) {
      return _buildCupertino(context, clinic);
    }

    return PopScope(
      canPop: clinic == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _openedClinic != null) _backToClinics();
      },
      child: Scaffold(
        appBar: AppBar(
          leading:
              clinic == null ? null : BackButton(onPressed: _backToClinics),
          title: Text(clinic?.name ?? 'Выберите клинику'),
          actions: [
            IconButton(
              tooltip: 'Обновить',
              onPressed: clinic == null ? _reloadClinics : _reloadDetail,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: SafeArea(
          child: clinic == null
              ? _ClinicsBody(
                  search: _search,
                  filters: _filters,
                  request: _clinicsRequest,
                  bookingPetName: widget.bookingPetName,
                  bookingContextNote: widget.bookingContextNote,
                  onChangePet: widget.onChangePet,
                  onReload: _reloadClinics,
                  onClearFilters: _clearFilters,
                  onFiltersChanged: _applyFilters,
                  onOpenClinic: _openClinic,
                )
              : _ClinicDetailBody(
                  repository: widget.repository,
                  request: _detailRequest,
                  onRetry: _reloadDetail,
                  onSelected: widget.onSelected,
                  bookingPetName: widget.bookingPetName,
                  bookingContextNote: widget.bookingContextNote,
                  onChangeClinic: _backToClinics,
                  onChangePet: widget.onChangePet,
                ),
        ),
      ),
    );
  }

  Widget _buildCupertino(BuildContext context, CatalogClinic? clinic) {
    return PopScope(
      canPop: clinic == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _openedClinic != null) _backToClinics();
      },
      child: CupertinoPageScaffold(
        navigationBar: CupertinoNavigationBar(
          leading: clinic == null
              ? null
              : CupertinoNavigationBarBackButton(onPressed: _backToClinics),
          middle: Text(clinic?.name ?? 'Клиники'),
          trailing: CupertinoButton(
            minSize: 44,
            padding: EdgeInsets.zero,
            onPressed: clinic == null ? _reloadClinics : _reloadDetail,
            child: const Icon(CupertinoIcons.refresh),
          ),
        ),
        child: VhPageBackdrop(
          child: SafeArea(
            bottom: false,
            child: clinic == null
                ? _CupertinoClinicsBody(
                    search: _search,
                    filters: _filters,
                    request: _clinicsRequest,
                    bookingPetName: widget.bookingPetName,
                    bookingContextNote: widget.bookingContextNote,
                    onChangePet: widget.onChangePet,
                    onReload: _reloadClinics,
                    onClearFilters: _clearFilters,
                    onFiltersChanged: _applyFilters,
                    onOpenClinic: _openClinic,
                  )
                : _CupertinoClinicDetailBody(
                    repository: widget.repository,
                    request: _detailRequest,
                    onRetry: _reloadDetail,
                    onSelected: widget.onSelected,
                    bookingPetName: widget.bookingPetName,
                    bookingContextNote: widget.bookingContextNote,
                    onChangeClinic: _backToClinics,
                    onChangePet: widget.onChangePet,
                  ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoClinicsBody extends StatelessWidget {
  const _CupertinoClinicsBody({
    required this.search,
    required this.filters,
    required this.request,
    required this.bookingPetName,
    required this.bookingContextNote,
    required this.onChangePet,
    required this.onReload,
    required this.onClearFilters,
    required this.onFiltersChanged,
    required this.onOpenClinic,
  });

  final TextEditingController search;
  final CatalogClinicFilters filters;
  final Future<List<CatalogClinic>>? request;
  final String? bookingPetName;
  final String? bookingContextNote;
  final VoidCallback? onChangePet;
  final VoidCallback onReload;
  final VoidCallback onClearFilters;
  final ValueChanged<CatalogClinicFilters> onFiltersChanged;
  final ValueChanged<CatalogClinic> onOpenClinic;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CatalogClinic>>(
      future: request,
      builder: (context, snapshot) {
        final hasFilters = _hasActiveCatalogFilters(filters);
        final slivers = <Widget>[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: _CupertinoPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _CupertinoCatalogPetContext(
                      petName: bookingPetName,
                      contextNote: bookingContextNote,
                      onChangePet: onChangePet,
                    ),
                    const SizedBox(height: 12),
                    _CupertinoCatalogSearchField(
                      controller: search,
                      onSubmitted: onReload,
                    ),
                    const SizedBox(height: 12),
                    _CupertinoCatalogFilters(
                      filters: filters,
                      onChanged: onFiltersChanged,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ];

        if (snapshot.connectionState != ConnectionState.done) {
          slivers.add(
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CupertinoActivityIndicator()),
            ),
          );
        } else if (snapshot.hasError) {
          slivers.add(
            SliverFillRemaining(
              hasScrollBody: false,
              child: _CupertinoCatalogError(onRetry: onReload),
            ),
          );
        } else {
          final clinics = snapshot.data ?? const <CatalogClinic>[];
          if (clinics.isEmpty) {
            slivers.add(
              SliverFillRemaining(
                hasScrollBody: false,
                child: _CupertinoCatalogEmpty(
                  text: hasFilters
                      ? 'По текущему запросу и фильтрам активных клиник не найдено. Можно очистить фильтры и повторить поиск.'
                      : 'По этому запросу активных клиник не найдено. Попробуйте изменить формулировку поиска.',
                  actionLabel: hasFilters ? 'Очистить фильтры' : null,
                  onAction: hasFilters ? onClearFilters : null,
                ),
              ),
            );
          } else {
            slivers.add(
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                sliver: SliverList.separated(
                  itemCount: clinics.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) => _CupertinoClinicCard(
                    clinic: clinics[index],
                    onTap: () => onOpenClinic(clinics[index]),
                  ),
                ),
              ),
            );
          }
        }

        return CustomScrollView(slivers: slivers);
      },
    );
  }
}

class _CupertinoCatalogSearchField extends StatelessWidget {
  const _CupertinoCatalogSearchField({
    required this.controller,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final VoidCallback onSubmitted;

  @override
  Widget build(BuildContext context) {
    return CupertinoSearchTextField(
      controller: controller,
      placeholder: 'Название, адрес или услуга',
      onSubmitted: (_) => onSubmitted(),
    );
  }
}

class _CupertinoCatalogFilters extends StatelessWidget {
  const _CupertinoCatalogFilters({
    required this.filters,
    required this.onChanged,
  });

  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;

  @override
  Widget build(BuildContext context) {
    final todaySelected =
        filters.availableFrom != null && filters.availableTo != null;
    final serviceSelected = filters.serviceCode == 'GENERAL_VISIT';
    final emergencySelected = filters.emergencyCapability == 'TRAUMA';
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _CupertinoFilterButton(
            label: 'Ближайшие окна',
            selected: filters.openNow == true,
            onPressed: () =>
                onChanged(filters.copyWith(openNow: filters.openNow != true)),
          ),
          _CupertinoFilterButton(
            label: 'Сегодня',
            selected: todaySelected,
            onPressed: () => onChanged(todaySelected
                ? filters.copyWith(clearAvailability: true, openNow: false)
                : filters.copyWith(
                    availableFrom: _todayStart(),
                    availableTo: _todayStart().add(const Duration(days: 1)),
                    openNow: true,
                  )),
          ),
          _CupertinoFilterButton(
            label: 'Первичный приём',
            selected: serviceSelected,
            onPressed: () => onChanged(filters.copyWith(
              serviceCode: serviceSelected ? null : 'GENERAL_VISIT',
              clearServiceCode: serviceSelected,
            )),
          ),
          _CupertinoFilterButton(
            label: 'Онлайн',
            selected: filters.telemedAvailable == true,
            onPressed: () => onChanged(
              filters.copyWith(
                  telemedAvailable: filters.telemedAvailable != true),
            ),
          ),
          _CupertinoFilterButton(
            label: 'Срочная помощь',
            selected: emergencySelected,
            onPressed: () => onChanged(filters.copyWith(
              emergencyCapability: emergencySelected ? null : 'TRAUMA',
              clearEmergencyCapability: emergencySelected,
            )),
          ),
          _CupertinoFilterButton(
            label: _sortLabel(filters.sort),
            selected: true,
            onPressed: () => onChanged(
              filters.copyWith(
                sort: _nextSort(filters.sort, geoEnabled: false),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoCatalogPetContext extends StatelessWidget {
  const _CupertinoCatalogPetContext({
    required this.petName,
    required this.contextNote,
    required this.onChangePet,
  });

  final String? petName;
  final String? contextNote;
  final VoidCallback? onChangePet;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final label = CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    final note = contextNote?.trim();
    final pet = petName?.trim();
    return Semantics(
      label: pet == null || pet.isEmpty
          ? 'Питомец для поиска клиники не выбран'
          : 'Поиск клиники для питомца $pet',
      child: _CupertinoPanel(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              CupertinoIcons.paw,
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.activeBlue,
                context,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pet == null || pet.isEmpty
                        ? 'Выберите клинику и услугу'
                        : 'Клиника и услуга для $pet',
                    style: textTheme.textStyle.copyWith(
                      color: label,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    note == null || note.isEmpty
                        ? 'Дата, время и удержание слота будут проверены на следующем экране.'
                        : note,
                    style: textTheme.textStyle.copyWith(
                      color: secondaryLabel,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            if (onChangePet != null) ...[
              const SizedBox(width: 8),
              CupertinoButton(
                minSize: 44,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                onPressed: onChangePet,
                child: const Text('Сменить'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CupertinoFilterButton extends StatelessWidget {
  const _CupertinoFilterButton({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final color = CupertinoDynamicColor.resolve(
      selected
          ? CupertinoColors.activeBlue
          : CupertinoColors.secondarySystemGroupedBackground,
      context,
    );
    final textColor = CupertinoDynamicColor.resolve(
      selected ? CupertinoColors.white : CupertinoColors.label,
      context,
    );
    final borderColor = CupertinoDynamicColor.resolve(
      selected ? CupertinoColors.activeBlue : CupertinoColors.separator,
      context,
    );
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Semantics(
        button: true,
        selected: selected,
        child: CupertinoButton(
          minSize: 44,
          padding: EdgeInsets.zero,
          onPressed: onPressed,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: borderColor),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              child: Text(
                label,
                style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                      color: textColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoClinicCard extends StatelessWidget {
  const _CupertinoClinicCard({required this.clinic, required this.onTap});

  final CatalogClinic clinic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final next = clinic.nextAvailableAt;
    final textTheme = CupertinoTheme.of(context).textTheme;
    final label = CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    final stacksMeta = MediaQuery.textScalerOf(context).scale(1) >= 1.6;
    return Semantics(
      button: true,
      label:
          '${clinic.name}. ${clinic.locationCount} адреса. ${next == null ? 'Свободное время проверим после выбора услуги' : 'Ближайшее подтверждённое окно ${_shortDateTime(context, next)}'}.',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: onTap,
        child: _CupertinoPanel(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                CupertinoIcons.building_2_fill,
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.activeBlue,
                  context,
                ),
                size: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      clinic.name,
                      style: textTheme.textStyle.copyWith(
                        color: label,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${clinic.locationCount} адрес(а) · ${clinic.serviceCount} услуг(и)',
                      style: textTheme.textStyle.copyWith(
                        color: secondaryLabel,
                        fontSize: 14,
                      ),
                    ),
                    if (stacksMeta) ...[
                      const SizedBox(height: 4),
                      Text(
                        next == null
                            ? 'Свободное время проверим после выбора услуги'
                            : 'Ближайшее подтверждённое окно ${_shortDateTime(context, next)}',
                        style: textTheme.textStyle.copyWith(
                          color: secondaryLabel,
                          fontSize: 14,
                        ),
                      ),
                    ],
                    if (clinic.distanceKm != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${_distance(clinic.distanceKm!)} от точки поиска',
                        style: textTheme.textStyle.copyWith(
                          color: secondaryLabel,
                          fontSize: 14,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    _CupertinoCatalogBadges(clinic: clinic),
                  ],
                ),
              ),
              if (!stacksMeta) ...[
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      next == null ? 'Уточним' : _shortDateTime(context, next),
                      textAlign: TextAlign.right,
                      style: textTheme.textStyle.copyWith(
                        color: secondaryLabel,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Icon(
                      CupertinoIcons.chevron_forward,
                      color: secondaryLabel,
                      size: 18,
                    ),
                  ],
                ),
              ] else ...[
                const SizedBox(width: 8),
                Icon(
                  CupertinoIcons.chevron_forward,
                  color: secondaryLabel,
                  size: 18,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoCatalogBadges extends StatelessWidget {
  const _CupertinoCatalogBadges({required this.clinic});

  final CatalogClinic clinic;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        _CupertinoCatalogBadge(
          label: clinic.nextAvailableAt == null ? 'Время уточним' : 'Есть окна',
        ),
        if (clinic.telemedAvailable)
          const _CupertinoCatalogBadge(label: 'Онлайн'),
        if (clinic.emergencyAvailable)
          const _CupertinoCatalogBadge(label: 'Срочная проверена'),
      ],
    );
  }
}

class _CupertinoCatalogBadge extends StatelessWidget {
  const _CupertinoCatalogBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final background = CupertinoDynamicColor.resolve(
      CupertinoColors.tertiarySystemFill,
      context,
    );
    final labelColor = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        child: Text(
          label,
          style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                color: labelColor,
                fontSize: 12,
              ),
        ),
      ),
    );
  }
}

class _CupertinoClinicDetailBody extends StatefulWidget {
  const _CupertinoClinicDetailBody({
    required this.repository,
    required this.request,
    required this.onRetry,
    required this.onSelected,
    required this.bookingPetName,
    required this.bookingContextNote,
    required this.onChangeClinic,
    required this.onChangePet,
  });

  final PublicCatalogRepository repository;
  final Future<CatalogClinicDetail>? request;
  final VoidCallback onRetry;
  final ValueChanged<CatalogBookingSelection> onSelected;
  final String? bookingPetName;
  final String? bookingContextNote;
  final VoidCallback onChangeClinic;
  final VoidCallback? onChangePet;

  @override
  State<_CupertinoClinicDetailBody> createState() =>
      _CupertinoClinicDetailBodyState();
}

class _CupertinoClinicDetailBodyState
    extends State<_CupertinoClinicDetailBody> {
  int _selectedLocationIndex = 0;
  String? _selectedServiceId;
  String? _loadedLocationId;
  Future<List<CatalogService>>? _servicesRequest;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CatalogClinicDetail>(
      future: widget.request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CupertinoActivityIndicator());
        }
        if (snapshot.hasError) {
          return _CupertinoCatalogError(onRetry: widget.onRetry);
        }
        final detail = snapshot.data;
        if (detail == null || detail.locations.isEmpty) {
          return const _CupertinoCatalogEmpty(
            text: 'У клиники пока нет активных адресов для записи.',
          );
        }
        if (_selectedLocationIndex >= detail.locations.length) {
          _selectedLocationIndex = 0;
        }
        final location = detail.locations[_selectedLocationIndex];
        _ensureServicesRequest(location.locationId);

        return FutureBuilder<List<CatalogService>>(
          future: _servicesRequest,
          builder: (context, servicesSnapshot) {
            final services = servicesSnapshot.data ?? const <CatalogService>[];
            final servicesLoaded =
                servicesSnapshot.connectionState == ConnectionState.done &&
                    !servicesSnapshot.hasError;
            final selectedService =
                servicesLoaded ? _selectedService(services) : null;

            return Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    children: [
                      _CupertinoClinicSummary(detail: detail),
                      const SizedBox(height: 14),
                      _CupertinoSectionHeader(title: 'Адрес'),
                      const SizedBox(height: 8),
                      for (var index = 0;
                          index < detail.locations.length;
                          index++) ...[
                        if (index > 0) const SizedBox(height: 8),
                        _CupertinoLocationChoice(
                          location: detail.locations[index],
                          selected: index == _selectedLocationIndex,
                          onTap: () =>
                              setState(() => _selectedLocationIndex = index),
                        ),
                      ],
                      const SizedBox(height: 8),
                      _CupertinoLocationActions(location: location),
                      const SizedBox(height: 16),
                      if (servicesSnapshot.connectionState !=
                          ConnectionState.done)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 32),
                          child: Center(child: CupertinoActivityIndicator()),
                        )
                      else if (servicesSnapshot.hasError)
                        _CupertinoInlineRetry(
                          onRetry: () => _reloadServices(location.locationId),
                        )
                      else ...[
                        _CupertinoServicesSection(
                          services: services,
                          selectedServiceId: selectedService?.id,
                          onSelected: (service) =>
                              setState(() => _selectedServiceId = service.id),
                        ),
                        const SizedBox(height: 16),
                        if (selectedService == null)
                          const OwnerCupertinoStatusBanner(
                            tone: OwnerCupertinoFeedbackTone.neutral,
                            title: 'Что будет дальше',
                            message:
                                'Выберите услугу, чтобы перейти к доступному времени. Слот не удерживается до выбора времени.',
                          )
                        else ...[
                          _CupertinoAvailabilityHint(
                            nextAvailableAt: detail.nextAvailableAt,
                            hasOpenSlots: location.hasOpenSlots,
                          ),
                          const SizedBox(height: 16),
                          _CupertinoBookingContextSummary(
                            petName: widget.bookingPetName,
                            clinicName: location.clinicName,
                            locationAddress: location.address,
                            service: selectedService,
                            contextNote: widget.bookingContextNote,
                            onChangeClinic: widget.onChangeClinic,
                            onChangeService: () =>
                                setState(() => _selectedServiceId = null),
                            onChangePet: widget.onChangePet,
                          ),
                        ],
                      ],
                    ],
                  ),
                ),
                if (servicesLoaded && services.isNotEmpty)
                  SafeArea(
                    top: false,
                    minimum: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                    child: _CupertinoPrimaryButton(
                      label: selectedService == null
                          ? 'Выберите услугу'
                          : 'Посмотреть время',
                      enabled: selectedService != null,
                      onPressed: selectedService == null
                          ? null
                          : () => widget.onSelected(
                                CatalogBookingSelection(
                                  location: location,
                                  service: selectedService,
                                ),
                              ),
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }

  void _ensureServicesRequest(String locationId) {
    if (_loadedLocationId == locationId && _servicesRequest != null) return;
    _loadedLocationId = locationId;
    _selectedServiceId = null;
    _servicesRequest = widget.repository.listLocationServices(locationId);
  }

  void _reloadServices(String locationId) {
    setState(() {
      _loadedLocationId = locationId;
      _servicesRequest = widget.repository.listLocationServices(locationId);
    });
  }

  CatalogService? _selectedService(List<CatalogService> services) {
    if (services.isEmpty) return null;
    final selectedId = _selectedServiceId;
    if (selectedId != null) {
      for (final service in services) {
        if (service.id == selectedId) return service;
      }
    }
    return null;
  }
}

class _CupertinoClinicSummary extends StatelessWidget {
  const _CupertinoClinicSummary({required this.detail});

  final CatalogClinicDetail detail;

  @override
  Widget build(BuildContext context) {
    final next = detail.nextAvailableAt;
    final textTheme = CupertinoTheme.of(context).textTheme;
    final label = CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return _CupertinoPanel(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            CupertinoIcons.building_2_fill,
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.activeBlue,
              context,
            ),
            size: 30,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  detail.name,
                  style: textTheme.textStyle.copyWith(
                    color: label,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${detail.locationCount} адрес(а) · ${detail.serviceCount} услуг(и)',
                  style: textTheme.textStyle.copyWith(
                    color: secondaryLabel,
                    fontSize: 14,
                  ),
                ),
                if (detail.distanceKm != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${_distance(detail.distanceKm!)} от точки поиска',
                    style: textTheme.textStyle.copyWith(
                      color: secondaryLabel,
                      fontSize: 14,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                _CupertinoCatalogBadges(clinic: detail),
                if (next != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Ближайшее подтверждённое окно: ${_fullDateTime(context, next)}',
                    style: textTheme.textStyle.copyWith(
                      color: secondaryLabel,
                      fontSize: 14,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoSectionHeader extends StatelessWidget {
  const _CupertinoSectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoSectionHeader(title: title);
  }
}

class _CupertinoLocationChoice extends StatelessWidget {
  const _CupertinoLocationChoice({
    required this.location,
    required this.selected,
    required this.onTap,
  });

  final CatalogLocation location;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final label = CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      button: true,
      selected: selected,
      label:
          '${location.address}. ${location.hasOpenSlots ? 'Есть свободные окна по данным клиники.' : 'Свободные окна для этого адреса не подтверждены.'}',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: onTap,
        child: _CupertinoPanel(
          selected: selected,
          child: Row(
            children: [
              Icon(
                selected
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.circle,
                color: selected
                    ? CupertinoDynamicColor.resolve(
                        CupertinoColors.activeBlue,
                        context,
                      )
                    : secondaryLabel,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      location.address,
                      style: textTheme.textStyle.copyWith(
                        color: label,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (location.phone != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        location.phone!,
                        style: textTheme.textStyle.copyWith(
                          color: secondaryLabel,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _CupertinoCatalogBadge(
                label: location.hasOpenSlots ? 'Есть окна' : 'Уточнить время',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoLocationActions extends StatelessWidget {
  const _CupertinoLocationActions({required this.location});

  final CatalogLocation location;

  @override
  Widget build(BuildContext context) {
    final hasPhone = location.phone?.trim().isNotEmpty == true;
    return Row(
      children: [
        Expanded(
          child: _CupertinoSecondaryButton(
            label: 'Маршрут',
            icon: CupertinoIcons.map,
            onPressed: () => _openRoute(context, location),
          ),
        ),
        if (hasPhone) ...[
          const SizedBox(width: 8),
          Expanded(
            child: _CupertinoSecondaryButton(
              label: 'Позвонить',
              icon: CupertinoIcons.phone,
              onPressed: () => _callClinic(context, location),
            ),
          ),
        ],
      ],
    );
  }
}

class _CupertinoServicesSection extends StatelessWidget {
  const _CupertinoServicesSection({
    required this.services,
    required this.selectedServiceId,
    required this.onSelected,
  });

  final List<CatalogService> services;
  final String? selectedServiceId;
  final ValueChanged<CatalogService> onSelected;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) {
      return const _CupertinoCatalogEmpty(text: 'Активные услуги не найдены.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CupertinoSectionHeader(title: 'Услуги'),
        const SizedBox(height: 8),
        for (var index = 0; index < services.length; index++) ...[
          if (index > 0) const SizedBox(height: 8),
          _CupertinoServiceChoice(
            service: services[index],
            selected: services[index].id == selectedServiceId,
            onTap: () => onSelected(services[index]),
          ),
        ],
      ],
    );
  }
}

class _CupertinoServiceChoice extends StatelessWidget {
  const _CupertinoServiceChoice({
    required this.service,
    required this.selected,
    required this.onTap,
  });

  final CatalogService service;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = CupertinoTheme.of(context).textTheme;
    final label = CupertinoDynamicColor.resolve(CupertinoColors.label, context);
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      button: true,
      selected: selected,
      label:
          '${service.displayName}. ${service.durationMinutes} минут. ${selected ? 'Выбрано.' : 'Выбрать услугу.'}',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: onTap,
        child: _CupertinoPanel(
          selected: selected,
          child: Row(
            children: [
              Icon(
                selected
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.circle,
                color: selected
                    ? CupertinoDynamicColor.resolve(
                        CupertinoColors.activeBlue,
                        context,
                      )
                    : secondaryLabel,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service.displayName,
                      style: textTheme.textStyle.copyWith(
                        color: label,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${service.durationMinutes} мин',
                      style: textTheme.textStyle.copyWith(
                        color: secondaryLabel,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoAvailabilityHint extends StatelessWidget {
  const _CupertinoAvailabilityHint({
    required this.nextAvailableAt,
    required this.hasOpenSlots,
  });

  final DateTime? nextAvailableAt;
  final bool hasOpenSlots;

  @override
  Widget build(BuildContext context) {
    final next = nextAvailableAt;
    final message = next == null
        ? hasOpenSlots
            ? 'Клиника сообщает о свободных окнах. Конкретное время проверим на следующем экране.'
            : 'Свободное время проверим на следующем экране по данным сервера.'
        : 'Ближайшая подсказка от клиники: ${_fullDateTime(context, next)}. Точное время выберете дальше.';
    return OwnerCupertinoStatusBanner(
      tone: OwnerCupertinoFeedbackTone.neutral,
      icon: CupertinoIcons.time,
      title: 'Время будет на следующем шаге',
      message: message,
    );
  }
}

class _CupertinoBookingContextSummary extends StatelessWidget {
  const _CupertinoBookingContextSummary({
    required this.petName,
    required this.clinicName,
    required this.locationAddress,
    required this.service,
    required this.contextNote,
    required this.onChangeClinic,
    required this.onChangeService,
    required this.onChangePet,
  });

  final String? petName;
  final String clinicName;
  final String locationAddress;
  final CatalogService service;
  final String? contextNote;
  final VoidCallback onChangeClinic;
  final VoidCallback onChangeService;
  final VoidCallback? onChangePet;

  @override
  Widget build(BuildContext context) {
    final note = contextNote?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CupertinoSectionHeader(title: 'Перед выбором времени'),
        const SizedBox(height: 8),
        _CupertinoPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (note != null && note.isNotEmpty) ...[
                OwnerCupertinoStatusBanner(
                  tone: OwnerCupertinoFeedbackTone.neutral,
                  icon: CupertinoIcons.arrow_counterclockwise,
                  message: note,
                ),
                const SizedBox(height: 12),
              ],
              _CupertinoContextRow(
                icon: CupertinoIcons.paw,
                label: 'Питомец',
                value: petName ?? 'Будет выбран после входа',
                actionLabel: onChangePet == null ? null : 'Изменить',
                onAction: onChangePet,
              ),
              const _CupertinoContextDivider(),
              _CupertinoContextRow(
                icon: CupertinoIcons.building_2_fill,
                label: 'Клиника',
                value: '$clinicName, $locationAddress',
                actionLabel: 'Изменить',
                onAction: onChangeClinic,
              ),
              const _CupertinoContextDivider(),
              _CupertinoContextRow(
                icon: CupertinoIcons.list_bullet,
                label: 'Услуга',
                value: '${service.displayName}, ${service.durationMinutes} мин',
                actionLabel: 'Изменить',
                onAction: onChangeService,
              ),
              const SizedBox(height: 12),
              OwnerCupertinoStatusBanner(
                tone: OwnerCupertinoFeedbackTone.neutral,
                icon: CupertinoIcons.info_circle,
                message:
                    'Данные клиники и услуги выбраны. Свободное время и удержание слота будут проверены сервером только после выбора времени.',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CupertinoContextRow extends StatelessWidget {
  const _CupertinoContextRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final secondaryLabel = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      label: '$label: $value',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: secondaryLabel, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: secondaryLabel,
                            fontSize: 13,
                          ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                ),
              ],
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(width: 8),
            CupertinoButton(
              minSize: 44,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class _CupertinoContextDivider extends StatelessWidget {
  const _CupertinoContextDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: ColoredBox(
        color:
            CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
        child: const SizedBox(height: .5),
      ),
    );
  }
}

class _CupertinoPanel extends StatelessWidget {
  const _CupertinoPanel({
    required this.child,
    this.selected = false,
  });

  final Widget child;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final border = CupertinoDynamicColor.resolve(
      selected ? CupertinoColors.activeBlue : CupertinoColors.separator,
      context,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: border, width: selected ? 2 : 1),
      ),
      child: VhGlassSurface(
        padding: const EdgeInsets.all(14),
        radius: 18,
        child: child,
      ),
    );
  }
}

class _CupertinoPrimaryButton extends StatelessWidget {
  const _CupertinoPrimaryButton({
    required this.label,
    required this.enabled,
    required this.onPressed,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoButton.primary(
      label: label,
      enabled: enabled,
      onPressed: onPressed,
    );
  }
}

class _CupertinoSecondaryButton extends StatelessWidget {
  const _CupertinoSecondaryButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoButton.secondary(
      label: label,
      icon: icon,
      onPressed: onPressed,
    );
  }
}

class _CupertinoInlineRetry extends StatelessWidget {
  const _CupertinoInlineRetry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoInlineError(
      title: 'Не удалось обновить услуги',
      message: 'Повторная попытка обновит список услуг выбранного адреса.',
      retryLabel: 'Обновить услуги',
      onRetry: onRetry,
    );
  }
}

class _CupertinoCatalogError extends StatelessWidget {
  const _CupertinoCatalogError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoEmptyState(
      icon: CupertinoIcons.cloud,
      title: 'Не удалось загрузить каталог',
      message: 'Повторная попытка обновит список клиник по текущим фильтрам.',
      actionLabel: 'Обновить каталог',
      onAction: onRetry,
    );
  }
}

class _CupertinoCatalogEmpty extends StatelessWidget {
  const _CupertinoCatalogEmpty({
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return OwnerCupertinoEmptyState(
      icon: CupertinoIcons.search,
      title: 'Ничего не найдено',
      message: text,
      actionLabel: actionLabel,
      onAction: onAction,
    );
  }
}

bool _hasActiveCatalogFilters(CatalogClinicFilters filters) {
  return filters.query?.trim().isNotEmpty == true ||
      filters.serviceCode != null ||
      filters.availableFrom != null ||
      filters.availableTo != null ||
      filters.openNow == true ||
      filters.telemedAvailable == true ||
      filters.emergencyCapability != null ||
      filters.sort != 'soonest';
}

List<String> _activeFilterLabels(CatalogClinicFilters filters) {
  final labels = <String>[];
  final query = filters.query?.trim();
  if (query != null && query.isNotEmpty) labels.add('Поиск: $query');
  if (filters.openNow == true) labels.add('Ближайшие окна');
  if (filters.availableFrom != null && filters.availableTo != null) {
    labels.add('Сегодня');
  }
  if (filters.serviceCode == 'GENERAL_VISIT') labels.add('Первичный приём');
  if (filters.telemedAvailable == true) labels.add('Онлайн');
  if (filters.emergencyCapability == 'TRAUMA') labels.add('Срочная помощь');
  if (filters.sort != 'soonest') labels.add(_sortLabel(filters.sort));
  return labels;
}

class _ClinicsBody extends StatelessWidget {
  const _ClinicsBody({
    required this.search,
    required this.filters,
    required this.request,
    required this.bookingPetName,
    required this.bookingContextNote,
    required this.onChangePet,
    required this.onReload,
    required this.onClearFilters,
    required this.onFiltersChanged,
    required this.onOpenClinic,
  });

  final TextEditingController search;
  final CatalogClinicFilters filters;
  final Future<List<CatalogClinic>>? request;
  final String? bookingPetName;
  final String? bookingContextNote;
  final VoidCallback? onChangePet;
  final VoidCallback onReload;
  final VoidCallback onClearFilters;
  final ValueChanged<CatalogClinicFilters> onFiltersChanged;
  final ValueChanged<CatalogClinic> onOpenClinic;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 900;
        final searchControls = _CatalogSearchControls(
          search: search,
          filters: filters,
          bookingPetName: bookingPetName,
          bookingContextNote: bookingContextNote,
          onChangePet: onChangePet,
          onReload: onReload,
          onClearFilters: onClearFilters,
        );
        final filtersPanel = _CatalogFiltersPanel(
          filters: filters,
          onChanged: onFiltersChanged,
          onClearFilters: onClearFilters,
        );
        final results = _CatalogResults(
          request: request,
          filters: filters,
          onReload: onReload,
          onClearFilters: onClearFilters,
          onOpenClinic: onOpenClinic,
        );

        if (wide) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 300,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 24, 16, 24),
                  child: filtersPanel,
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
                      child: searchControls,
                    ),
                    Expanded(child: results),
                  ],
                ),
              ),
            ],
          );
        }

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
              child: Column(
                children: [
                  searchControls,
                  const SizedBox(height: 12),
                  _CatalogMobileFilters(
                    filters: filters,
                    onChanged: onFiltersChanged,
                    onClearFilters: onClearFilters,
                  ),
                ],
              ),
            ),
            Expanded(child: results),
          ],
        );
      },
    );
  }
}

class _CatalogSearchControls extends StatelessWidget {
  const _CatalogSearchControls({
    required this.search,
    required this.filters,
    required this.bookingPetName,
    required this.bookingContextNote,
    required this.onChangePet,
    required this.onReload,
    required this.onClearFilters,
  });

  final TextEditingController search;
  final CatalogClinicFilters filters;
  final String? bookingPetName;
  final String? bookingContextNote;
  final VoidCallback? onChangePet;
  final VoidCallback onReload;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    final hasFilters = _hasActiveCatalogFilters(filters);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CatalogPetContext(
          petName: bookingPetName,
          contextNote: bookingContextNote,
          onChangePet: onChangePet,
        ),
        const SizedBox(height: 12),
        SearchBar(
          controller: search,
          hintText: 'Название, адрес или услуга',
          leading: const Icon(Icons.search),
          trailing: [
            Tooltip(
              message: 'Обновить каталог',
              child: IconButton(
                onPressed: onReload,
                icon: const Icon(Icons.refresh),
              ),
            ),
          ],
          onSubmitted: (_) => onReload(),
        ),
        if (hasFilters) ...[
          const SizedBox(height: 10),
          _ActiveCatalogFilters(
            filters: filters,
            onClearFilters: onClearFilters,
          ),
        ],
      ],
    );
  }
}

class _ActiveCatalogFilters extends StatelessWidget {
  const _ActiveCatalogFilters({
    required this.filters,
    required this.onClearFilters,
  });

  final CatalogClinicFilters filters;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    final labels = _activeFilterLabels(filters);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final label in labels)
                Chip(
                  visualDensity: VisualDensity.compact,
                  label: Text(label),
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        TextButton.icon(
          onPressed: onClearFilters,
          icon: const Icon(Icons.clear),
          label: const Text('Очистить фильтры'),
        ),
      ],
    );
  }
}

class _CatalogPetContext extends StatelessWidget {
  const _CatalogPetContext({
    required this.petName,
    required this.contextNote,
    required this.onChangePet,
  });

  final String? petName;
  final String? contextNote;
  final VoidCallback? onChangePet;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final pet = petName?.trim();
    final note = contextNote?.trim();
    return Semantics(
      container: true,
      label: pet == null || pet.isEmpty
          ? 'Питомец для поиска клиники не выбран'
          : 'Поиск клиники для питомца $pet',
      child: Card(
        elevation: 0,
        color: colors.surfaceContainerHighest,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.pets_outlined, color: colors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pet == null || pet.isEmpty
                          ? 'Выберите клинику и услугу'
                          : 'Клиника и услуга для $pet',
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      note == null || note.isEmpty
                          ? 'Дата, время и удержание слота будут проверены на следующем экране.'
                          : note,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              if (onChangePet != null) ...[
                const SizedBox(width: 8),
                Tooltip(
                  message: 'Сменить питомца',
                  child: OutlinedButton(
                    onPressed: onChangePet,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(44, 44),
                    ),
                    child: const Text('Сменить'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CatalogResults extends StatelessWidget {
  const _CatalogResults({
    required this.request,
    required this.filters,
    required this.onReload,
    required this.onClearFilters,
    required this.onOpenClinic,
  });

  final Future<List<CatalogClinic>>? request;
  final CatalogClinicFilters filters;
  final VoidCallback onReload;
  final VoidCallback onClearFilters;
  final ValueChanged<CatalogClinic> onOpenClinic;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CatalogClinic>>(
      future: request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _CatalogError(onRetry: onReload);
        }
        final clinics = snapshot.data ?? const <CatalogClinic>[];
        if (clinics.isEmpty) {
          return _CatalogEmpty(
            text: 'По этому запросу активных клиник не найдено.',
            actionLabel:
                _hasActiveCatalogFilters(filters) ? 'Очистить фильтры' : null,
            onAction: _hasActiveCatalogFilters(filters) ? onClearFilters : null,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          itemCount: clinics.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) => _ClinicCard(
            clinic: clinics[index],
            onTap: () => onOpenClinic(clinics[index]),
          ),
        );
      },
    );
  }
}

class _CatalogMobileFilters extends StatelessWidget {
  const _CatalogMobileFilters({
    required this.filters,
    required this.onChanged,
    required this.onClearFilters,
  });

  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: const Text('Фильтры'),
      subtitle: Text(
        _hasActiveCatalogFilters(filters)
            ? _activeFilterLabels(filters).join(', ')
            : 'Список без дополнительных ограничений',
      ),
      children: [
        _CatalogFiltersPanel(
          filters: filters,
          onChanged: onChanged,
          onClearFilters: onClearFilters,
          compact: true,
        ),
      ],
    );
  }
}

class _CatalogFiltersPanel extends StatelessWidget {
  const _CatalogFiltersPanel({
    required this.filters,
    required this.onChanged,
    required this.onClearFilters,
    this.compact = false,
  });

  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;
  final VoidCallback onClearFilters;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final serviceCode = filters.serviceCode;
    final todaySelected =
        filters.availableFrom != null && filters.availableTo != null;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child:
                  Text('Фильтры каталога', style: theme.textTheme.titleMedium),
            ),
            if (_hasActiveCatalogFilters(filters))
              TextButton(
                onPressed: onClearFilters,
                child: const Text('Сбросить'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.event_available_outlined),
          title: const Text('Ближайшие окна'),
          subtitle: const Text('Показывать клиники с ближайшими окнами.'),
          value: filters.openNow == true,
          onChanged: (selected) =>
              onChanged(filters.copyWith(openNow: selected)),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.today_outlined),
          title: const Text('Сегодня'),
          subtitle: const Text('Только окна на текущий день.'),
          value: todaySelected,
          onChanged: (selected) => onChanged((selected ?? false)
              ? filters.copyWith(
                  availableFrom: _todayStart(),
                  availableTo: _todayStart().add(const Duration(days: 1)),
                  openNow: true,
                )
              : filters.copyWith(clearAvailability: true, openNow: false)),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.medical_services_outlined),
          title: const Text('Первичный приём'),
          value: serviceCode == 'GENERAL_VISIT',
          onChanged: (selected) => onChanged(filters.copyWith(
            serviceCode: (selected ?? false) ? 'GENERAL_VISIT' : null,
            clearServiceCode: !(selected ?? false),
          )),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.video_call_outlined),
          title: const Text('Онлайн-консультации'),
          value: filters.telemedAvailable == true,
          onChanged: (selected) =>
              onChanged(filters.copyWith(telemedAvailable: selected ?? false)),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          secondary: const Icon(Icons.emergency_outlined),
          title: const Text('Срочная помощь'),
          value: filters.emergencyCapability == 'TRAUMA',
          onChanged: (selected) => onChanged(filters.copyWith(
            emergencyCapability: (selected ?? false) ? 'TRAUMA' : null,
            clearEmergencyCapability: !(selected ?? false),
          )),
        ),
        const SizedBox(height: 12),
        Text('Сортировка', style: theme.textTheme.labelLarge),
        RadioListTile<String>(
          contentPadding: EdgeInsets.zero,
          title: const Text('Сначала ближайшие'),
          value: 'soonest',
          groupValue: filters.sort == 'name' ? 'name' : 'soonest',
          onChanged: (value) {
            if (value != null) onChanged(filters.copyWith(sort: value));
          },
        ),
        RadioListTile<String>(
          contentPadding: EdgeInsets.zero,
          title: const Text('По названию'),
          value: 'name',
          groupValue: filters.sort == 'name' ? 'name' : 'soonest',
          onChanged: (value) {
            if (value != null) onChanged(filters.copyWith(sort: value));
          },
        ),
        const SizedBox(height: 8),
        Text(
          'Поиск рядом появится после доступа к геолокации.',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );

    if (compact) return content;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: content,
      ),
    );
  }
}

class _ClinicCard extends StatelessWidget {
  const _ClinicCard({required this.clinic, required this.onTap});

  final CatalogClinic clinic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final next = clinic.nextAvailableAt;
    final badges = _CatalogBadges(clinic: clinic);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CircleAvatar(child: Icon(Icons.local_hospital_outlined)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(clinic.name,
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                        '${clinic.locationCount} адрес(а) · ${clinic.serviceCount} услуг(и)'),
                    if (clinic.distanceKm != null) ...[
                      const SizedBox(height: 4),
                      Text('${_distance(clinic.distanceKm!)} от точки поиска',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                    const SizedBox(height: 8),
                    badges,
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                      next == null
                          ? 'Время уточним'
                          : _shortDateTime(context, next),
                      style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 6),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CatalogBadges extends StatelessWidget {
  const _CatalogBadges({required this.clinic});

  final CatalogClinic clinic;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        _CatalogBadge(
          icon: Icons.event_available_outlined,
          label: clinic.nextAvailableAt == null ? 'Время уточним' : 'Есть окна',
        ),
        if (clinic.telemedAvailable)
          const _CatalogBadge(
            icon: Icons.video_call_outlined,
            label: 'Онлайн',
          ),
        if (clinic.emergencyAvailable)
          const _CatalogBadge(
            icon: Icons.verified_outlined,
            label: 'Срочная проверена',
          ),
      ],
    );
  }
}

class _CatalogBadge extends StatelessWidget {
  const _CatalogBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14),
            const SizedBox(width: 4),
            Text(label, style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

class _ClinicDetailBody extends StatefulWidget {
  const _ClinicDetailBody({
    required this.repository,
    required this.request,
    required this.onRetry,
    required this.onSelected,
    required this.bookingPetName,
    required this.bookingContextNote,
    required this.onChangeClinic,
    required this.onChangePet,
  });

  final PublicCatalogRepository repository;
  final Future<CatalogClinicDetail>? request;
  final VoidCallback onRetry;
  final ValueChanged<CatalogBookingSelection> onSelected;
  final String? bookingPetName;
  final String? bookingContextNote;
  final VoidCallback onChangeClinic;
  final VoidCallback? onChangePet;

  @override
  State<_ClinicDetailBody> createState() => _ClinicDetailBodyState();
}

class _ClinicDetailBodyState extends State<_ClinicDetailBody> {
  int _selectedLocationIndex = 0;
  String? _selectedServiceId;
  String? _loadedLocationId;
  Future<List<CatalogService>>? _servicesRequest;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CatalogClinicDetail>(
      future: widget.request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _CatalogError(onRetry: widget.onRetry);
        }
        final detail = snapshot.data;
        if (detail == null || detail.locations.isEmpty) {
          return const _CatalogEmpty(
              text: 'У клиники пока нет активных адресов для записи.');
        }
        if (_selectedLocationIndex >= detail.locations.length) {
          _selectedLocationIndex = 0;
        }
        final location = detail.locations[_selectedLocationIndex];
        _ensureServicesRequest(location.locationId);
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            _ClinicSummary(detail: detail),
            const SizedBox(height: 16),
            Text('Адрес', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ...List<Widget>.generate(detail.locations.length, (index) {
              final item = detail.locations[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _LocationChoice(
                  location: item,
                  selected: index == _selectedLocationIndex,
                  onTap: () => setState(() => _selectedLocationIndex = index),
                ),
              );
            }),
            _LocationActions(location: location),
            const SizedBox(height: 16),
            FutureBuilder<List<CatalogService>>(
              future: _servicesRequest,
              builder: (context, servicesSnapshot) {
                if (servicesSnapshot.connectionState != ConnectionState.done) {
                  return const Center(
                      child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: CircularProgressIndicator(),
                  ));
                }
                if (servicesSnapshot.hasError) {
                  return _InlineRetry(
                      onRetry: () => _reloadServices(location.locationId));
                }
                final services =
                    servicesSnapshot.data ?? const <CatalogService>[];
                final selectedService = _selectedService(services);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ServicesSection(
                      services: services,
                      selectedServiceId: selectedService?.id,
                      onSelected: (service) =>
                          setState(() => _selectedServiceId = service.id),
                    ),
                    const SizedBox(height: 20),
                    if (selectedService == null)
                      const _CatalogInfoPanel(
                        title: 'Что будет дальше',
                        message:
                            'Выберите услугу, чтобы перейти к доступному времени. Слот не удерживается до выбора времени.',
                      )
                    else ...[
                      _AvailabilityHint(
                        nextAvailableAt: detail.nextAvailableAt,
                        hasOpenSlots: location.hasOpenSlots,
                      ),
                      const SizedBox(height: 16),
                      _BookingContextSummary(
                        petName: widget.bookingPetName,
                        clinicName: location.clinicName,
                        locationAddress: location.address,
                        service: selectedService,
                        contextNote: widget.bookingContextNote,
                        onChangeClinic: widget.onChangeClinic,
                        onChangeService: () =>
                            setState(() => _selectedServiceId = null),
                        onChangePet: widget.onChangePet,
                      ),
                    ],
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: selectedService != null
                          ? () => widget.onSelected(CatalogBookingSelection(
                                location: location,
                                service: selectedService,
                              ))
                          : null,
                      icon: const Icon(Icons.calendar_month_outlined),
                      label: Text(selectedService == null
                          ? 'Выберите услугу'
                          : 'Посмотреть время'),
                      style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(52)),
                    ),
                  ],
                );
              },
            ),
          ],
        );
      },
    );
  }

  void _ensureServicesRequest(String locationId) {
    if (_loadedLocationId == locationId && _servicesRequest != null) return;
    _loadedLocationId = locationId;
    _selectedServiceId = null;
    _servicesRequest = widget.repository.listLocationServices(locationId);
  }

  void _reloadServices(String locationId) {
    setState(() {
      _loadedLocationId = locationId;
      _servicesRequest = widget.repository.listLocationServices(locationId);
    });
  }

  CatalogService? _selectedService(List<CatalogService> services) {
    if (services.isEmpty) return null;
    final selectedId = _selectedServiceId;
    if (selectedId != null) {
      for (final service in services) {
        if (service.id == selectedId) return service;
      }
    }
    return null;
  }
}

class _ClinicSummary extends StatelessWidget {
  const _ClinicSummary({required this.detail});

  final CatalogClinicDetail detail;

  @override
  Widget build(BuildContext context) {
    final next = detail.nextAvailableAt;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.local_hospital_outlined, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(detail.name,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                      '${detail.locationCount} адрес(а) · ${detail.serviceCount} услуг(и)'),
                  if (detail.distanceKm != null) ...[
                    const SizedBox(height: 4),
                    Text('${_distance(detail.distanceKm!)} от точки поиска'),
                  ],
                  const SizedBox(height: 8),
                  _CatalogBadges(clinic: detail),
                  if (next != null) ...[
                    const SizedBox(height: 4),
                    Text('Ближайшее окно: ${_fullDateTime(context, next)}'),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationChoice extends StatelessWidget {
  const _LocationChoice({
    required this.location,
    required this.selected,
    required this.onTap,
  });

  final CatalogLocation location;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Material(
      color: selected ? colors.secondaryContainer : colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
            color: selected ? colors.primary : Theme.of(context).dividerColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(selected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_off),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(location.address,
                        style: Theme.of(context).textTheme.titleSmall),
                    if (location.phone != null) Text(location.phone!),
                  ],
                ),
              ),
              Chip(
                label: Text(
                  location.hasOpenSlots ? 'Есть окна' : 'Время уточним',
                ),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationActions extends StatelessWidget {
  const _LocationActions({required this.location});

  final CatalogLocation location;

  @override
  Widget build(BuildContext context) {
    final hasPhone = location.phone?.trim().isNotEmpty == true;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _openRoute(context, location),
              icon: const Icon(Icons.route_outlined),
              label: const Text('Маршрут'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: hasPhone ? () => _callClinic(context, location) : null,
              icon: const Icon(Icons.call_outlined),
              label: const Text('Позвонить'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServicesSection extends StatelessWidget {
  const _ServicesSection({
    required this.services,
    required this.selectedServiceId,
    required this.onSelected,
  });

  final List<CatalogService> services;
  final String? selectedServiceId;
  final ValueChanged<CatalogService> onSelected;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) {
      return const _CatalogEmpty(text: 'Активные услуги не найдены.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Услуги', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...services.map((service) => _ServiceChoice(
              service: service,
              selected: service.id == selectedServiceId,
              onTap: () => onSelected(service),
            )),
      ],
    );
  }
}

class _AvailabilityHint extends StatelessWidget {
  const _AvailabilityHint({
    required this.nextAvailableAt,
    required this.hasOpenSlots,
  });

  final DateTime? nextAvailableAt;
  final bool hasOpenSlots;

  @override
  Widget build(BuildContext context) {
    final next = nextAvailableAt;
    final message = next == null
        ? hasOpenSlots
            ? 'Клиника сообщает о свободных окнах. Конкретное время проверим на следующем экране.'
            : 'Свободное время проверим на следующем экране по данным сервера.'
        : 'Ближайшая подсказка от клиники: ${_fullDateTime(context, next)}. Точное время выберете дальше.';
    return _CatalogInfoPanel(
      title: 'Время будет на следующем шаге',
      message: message,
    );
  }
}

class _BookingContextSummary extends StatelessWidget {
  const _BookingContextSummary({
    required this.petName,
    required this.clinicName,
    required this.locationAddress,
    required this.service,
    required this.contextNote,
    required this.onChangeClinic,
    required this.onChangeService,
    required this.onChangePet,
  });

  final String? petName;
  final String clinicName;
  final String locationAddress;
  final CatalogService service;
  final String? contextNote;
  final VoidCallback onChangeClinic;
  final VoidCallback onChangeService;
  final VoidCallback? onChangePet;

  @override
  Widget build(BuildContext context) {
    final note = contextNote?.trim();
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Перед выбором времени',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            if (note != null && note.isNotEmpty) ...[
              _CatalogInfoPanel(title: 'Контекст записи', message: note),
              const SizedBox(height: 10),
            ],
            _ContextRow(
              icon: Icons.pets_outlined,
              label: 'Питомец',
              value: petName ?? 'Будет выбран после входа',
              actionLabel: onChangePet == null ? null : 'Изменить',
              onAction: onChangePet,
            ),
            const Divider(height: 20),
            _ContextRow(
              icon: Icons.local_hospital_outlined,
              label: 'Клиника',
              value: '$clinicName, $locationAddress',
              actionLabel: 'Изменить',
              onAction: onChangeClinic,
            ),
            const Divider(height: 20),
            _ContextRow(
              icon: Icons.medical_services_outlined,
              label: 'Услуга',
              value: '${service.displayName}, ${service.durationMinutes} мин',
              actionLabel: 'Изменить',
              onAction: onChangeService,
            ),
            const SizedBox(height: 12),
            _CatalogInfoPanel(
              title: 'Слот ещё не удерживается',
              message:
                  'Свободное время и удержание слота будут проверены сервером только после выбора времени.',
            ),
          ],
        ),
      ),
    );
  }
}

class _ContextRow extends StatelessWidget {
  const _ContextRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label: $value',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 2),
                Text(value, style: Theme.of(context).textTheme.titleSmall),
              ],
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(width: 8),
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class _CatalogInfoPanel extends StatelessWidget {
  const _CatalogInfoPanel({
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: theme.textTheme.titleSmall),
                  const SizedBox(height: 3),
                  Text(message),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceChoice extends StatelessWidget {
  const _ServiceChoice({
    required this.service,
    required this.selected,
    required this.onTap,
  });

  final CatalogService service;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? colors.secondaryContainer : colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
              color:
                  selected ? colors.primary : Theme.of(context).dividerColor),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(service.displayName,
                          style: Theme.of(context).textTheme.titleSmall),
                      Text('${service.durationMinutes} мин'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InlineRetry extends StatelessWidget {
  const _InlineRetry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.cloud_off_outlined),
            const SizedBox(width: 10),
            const Expanded(child: Text('Не удалось обновить услуги.')),
            TextButton(onPressed: onRetry, child: const Text('Повторить')),
          ],
        ),
      ),
    );
  }
}

class _CatalogError extends StatelessWidget {
  const _CatalogError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 48),
            const SizedBox(height: 12),
            Text('Не удалось загрузить каталог',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text('Проверьте подключение и повторите попытку.'),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Повторить')),
          ],
        ),
      ),
    );
  }
}

class _CatalogEmpty extends StatelessWidget {
  const _CatalogEmpty({
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(text, textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _shortDateTime(BuildContext context, DateTime value) {
  final time = TimeOfDay.fromDateTime(value).format(context);
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')} $time';
}

String _fullDateTime(BuildContext context, DateTime value) {
  final time = TimeOfDay.fromDateTime(value).format(context);
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year} $time';
}

DateTime _todayStart() {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
}

String _sortLabel(String value) => switch (value) {
      'name' => 'По названию',
      'distance' => 'По расстоянию',
      _ => 'По времени',
    };

String _nextSort(String value, {required bool geoEnabled}) {
  if (value == 'soonest') return 'name';
  if (value == 'name') return geoEnabled ? 'distance' : 'soonest';
  return 'soonest';
}

String _distance(double value) {
  if (value < 1) return '${(value * 1000).round()} м';
  return '${value.toStringAsFixed(value < 10 ? 1 : 0)} км';
}

Future<void> _openRoute(BuildContext context, CatalogLocation location) async {
  final uri = _routeUri(location);
  if (uri == null) {
    await Clipboard.setData(ClipboardData(text: location.address));
    if (context.mounted) _showCatalogMessage(context, 'Адрес скопирован.');
    return;
  }
  try {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (opened) return;
  } catch (_) {
    // Clipboard fallback keeps the address usable when maps are unavailable.
  }
  await Clipboard.setData(ClipboardData(text: location.address));
  if (context.mounted) _showCatalogMessage(context, 'Адрес скопирован.');
}

Future<void> _callClinic(BuildContext context, CatalogLocation location) async {
  final phone = location.phone?.trim();
  if (phone == null || phone.isEmpty) return;
  try {
    final opened = await launchUrl(
      Uri(scheme: 'tel', path: phone),
      mode: LaunchMode.externalApplication,
    );
    if (opened) return;
  } catch (_) {
    // Clipboard fallback keeps the phone number accessible.
  }
  await Clipboard.setData(ClipboardData(text: phone));
  if (context.mounted) _showCatalogMessage(context, 'Телефон скопирован.');
}

Uri? _routeUri(CatalogLocation location) {
  final latitude = location.latitude;
  final longitude = location.longitude;
  if (latitude != null && longitude != null) {
    return Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': '$latitude,$longitude',
    });
  }
  final address = location.address.trim();
  if (address.isEmpty) return null;
  return Uri.https('www.google.com', '/maps/search/', {
    'api': '1',
    'query': address,
  });
}

void _showCatalogMessage(BuildContext context, String text) {
  final hasCupertinoApp =
      context.findAncestorWidgetOfExactType<CupertinoApp>() != null;
  if (hasCupertinoApp || ownerUsesCupertino()) {
    showCupertinoDialog<void>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('VetHelp'),
        content: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(text),
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Понятно'),
          ),
        ],
      ),
    );
    return;
  }
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}
