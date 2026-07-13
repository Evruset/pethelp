import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'catalog_models.dart';
import 'public_catalog_repository.dart';

class PublicCatalogPage extends StatefulWidget {
  const PublicCatalogPage({
    super.key,
    required this.repository,
    required this.onSelected,
  });

  final PublicCatalogRepository repository;
  final ValueChanged<CatalogBookingSelection> onSelected;

  @override
  State<PublicCatalogPage> createState() => _PublicCatalogPageState();
}

class _PublicCatalogPageState extends State<PublicCatalogPage> {
  final _search = TextEditingController();
  CatalogClinicFilters _filters = const CatalogClinicFilters();
  _CatalogViewMode _viewMode = _CatalogViewMode.list;
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
    if (_usesCupertinoCatalog(context)) {
      return _CupertinoCatalogScaffold(
        clinic: clinic,
        onBackToClinics: _backToClinics,
        onRefresh: clinic == null ? _reloadClinics : _reloadDetail,
        child: clinic == null
            ? _CupertinoClinicsBody(
                search: _search,
                filters: _filters,
                request: _clinicsRequest,
                onReload: _reloadClinics,
                onFiltersChanged: _applyFilters,
                onOpenClinic: _openClinic,
              )
            : _CupertinoClinicDetailBody(
                repository: widget.repository,
                request: _detailRequest,
                onRetry: _reloadDetail,
                onSelected: widget.onSelected,
              ),
      );
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
                  viewMode: _viewMode,
                  request: _clinicsRequest,
                  onReload: _reloadClinics,
                  onFiltersChanged: _applyFilters,
                  onViewModeChanged: (value) =>
                      setState(() => _viewMode = value),
                  onOpenClinic: _openClinic,
                )
              : _ClinicDetailBody(
                  repository: widget.repository,
                  request: _detailRequest,
                  onRetry: _reloadDetail,
                  onSelected: widget.onSelected,
                ),
        ),
      ),
    );
  }
}

enum _CatalogViewMode { list, map }

class _CupertinoCatalogScaffold extends StatelessWidget {
  const _CupertinoCatalogScaffold({
    required this.clinic,
    required this.onBackToClinics,
    required this.onRefresh,
    required this.child,
  });

  final CatalogClinic? clinic;
  final VoidCallback onBackToClinics;
  final VoidCallback onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final openedClinic = clinic;
    return PopScope(
      canPop: openedClinic == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && openedClinic != null) onBackToClinics();
      },
      child: CupertinoPageScaffold(
        navigationBar: CupertinoNavigationBar(
          border: null,
          backgroundColor:
              _cupertinoColor(context, CupertinoColors.systemBackground)
                  .withValues(alpha: .72),
          leading: openedClinic == null
              ? null
              : Semantics(
                  button: true,
                  label: 'Назад к списку клиник',
                  child: CupertinoButton(
                    minSize: 44,
                    padding: EdgeInsets.zero,
                    onPressed: onBackToClinics,
                    child: const Icon(CupertinoIcons.back),
                  ),
                ),
          middle: Text(openedClinic?.name ?? 'Выберите клинику'),
          trailing: Semantics(
            button: true,
            label: 'Обновить каталог',
            child: CupertinoButton(
              minSize: 44,
              padding: EdgeInsets.zero,
              onPressed: onRefresh,
              child: const Icon(CupertinoIcons.refresh),
            ),
          ),
        ),
        child: _CupertinoCatalogBackdrop(
          child: SafeArea(top: false, child: child),
        ),
      ),
    );
  }
}

class _CupertinoCatalogBackdrop extends StatelessWidget {
  const _CupertinoCatalogBackdrop({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final background =
        _cupertinoColor(context, CupertinoColors.systemGroupedBackground);
    final accent =
        _cupertinoColor(context, CupertinoColors.activeBlue).withValues(
      alpha: MediaQuery.platformBrightnessOf(context) == Brightness.dark
          ? .10
          : .08,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [accent, background, background],
          stops: const [0, .46, 1],
        ),
      ),
      child: child,
    );
  }
}

class _CupertinoClinicsBody extends StatelessWidget {
  const _CupertinoClinicsBody({
    required this.search,
    required this.filters,
    required this.request,
    required this.onReload,
    required this.onFiltersChanged,
    required this.onOpenClinic,
  });

  final TextEditingController search;
  final CatalogClinicFilters filters;
  final Future<List<CatalogClinic>>? request;
  final VoidCallback onReload;
  final ValueChanged<CatalogClinicFilters> onFiltersChanged;
  final ValueChanged<CatalogClinic> onOpenClinic;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<CatalogClinic>>(
      future: request,
      builder: (context, snapshot) {
        final slivers = <Widget>[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 10),
              child: _CupertinoGlassSurface(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      textField: true,
                      label: 'Поиск клиники, адреса или услуги',
                      child: CupertinoTextField(
                        controller: search,
                        placeholder: 'Название, адрес или услуга',
                        textInputAction: TextInputAction.search,
                        minLines: 1,
                        maxLines: 2,
                        clearButtonMode: OverlayVisibilityMode.editing,
                        prefix: Padding(
                          padding: const EdgeInsetsDirectional.only(start: 12),
                          child: Icon(
                            CupertinoIcons.search,
                            size: 20,
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.secondaryLabel,
                            ),
                          ),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 13,
                        ),
                        decoration: BoxDecoration(
                          color: _cupertinoColor(
                            context,
                            CupertinoColors.secondarySystemFill,
                          ),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        onSubmitted: (_) => onReload(),
                      ),
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
              child: _CupertinoFeedbackState(
                title: 'Загружаем клиники',
                message: 'Получаем актуальный каталог VetHelp.',
                loading: true,
              ),
            ),
          );
        } else if (snapshot.hasError) {
          slivers.add(
            SliverFillRemaining(
              hasScrollBody: false,
              child: _CupertinoFeedbackState(
                title: 'Не удалось загрузить каталог',
                message: 'Проверьте соединение и повторите обновление.',
                actionLabel: 'Повторить',
                onAction: onReload,
                icon: CupertinoIcons.exclamationmark_circle,
                tone: _CupertinoFeedbackTone.warning,
              ),
            ),
          );
        } else {
          final clinics = snapshot.data ?? const <CatalogClinic>[];
          if (clinics.isEmpty) {
            slivers.add(
              const SliverFillRemaining(
                hasScrollBody: false,
                child: _CupertinoFeedbackState(
                  title: 'Клиники не найдены',
                  message:
                      'Попробуйте изменить запрос или убрать активные фильтры.',
                  icon: CupertinoIcons.search,
                ),
              ),
            );
          } else {
            slivers.add(
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 6, 18, 28),
                sliver: SliverList.separated(
                  itemCount: clinics.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final clinic = clinics[index];
                    return _CupertinoClinicCard(
                      clinic: clinic,
                      onTap: () => onOpenClinic(clinic),
                    );
                  },
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

class _CupertinoCatalogFilters extends StatelessWidget {
  const _CupertinoCatalogFilters({
    required this.filters,
    required this.onChanged,
  });

  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;

  @override
  Widget build(BuildContext context) {
    final serviceCode = filters.serviceCode;
    final todaySelected =
        filters.availableFrom != null && filters.availableTo != null;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _CupertinoFilterPill(
          label: 'Ближайшие окна',
          icon: CupertinoIcons.calendar,
          selected: filters.openNow == true,
          onPressed: () =>
              onChanged(filters.copyWith(openNow: filters.openNow != true)),
        ),
        _CupertinoFilterPill(
          label: 'Сегодня',
          icon: CupertinoIcons.time,
          selected: todaySelected,
          onPressed: () => onChanged(todaySelected
              ? filters.copyWith(clearAvailability: true, openNow: false)
              : filters.copyWith(
                  availableFrom: _todayStart(),
                  availableTo: _todayStart().add(const Duration(days: 1)),
                  openNow: true,
                )),
        ),
        _CupertinoFilterPill(
          label: 'Первичный приём',
          icon: CupertinoIcons.plus_app,
          selected: serviceCode == 'GENERAL_VISIT',
          onPressed: () => onChanged(filters.copyWith(
            serviceCode:
                serviceCode == 'GENERAL_VISIT' ? null : 'GENERAL_VISIT',
            clearServiceCode: serviceCode == 'GENERAL_VISIT',
          )),
        ),
        _CupertinoFilterPill(
          label: 'Онлайн',
          icon: CupertinoIcons.video_camera,
          selected: filters.telemedAvailable == true,
          onPressed: () => onChanged(filters.copyWith(
              telemedAvailable: filters.telemedAvailable != true)),
        ),
        _CupertinoFilterPill(
          label: 'Срочная помощь',
          icon: CupertinoIcons.exclamationmark_circle,
          selected: filters.emergencyCapability == 'TRAUMA',
          onPressed: () => onChanged(filters.copyWith(
            emergencyCapability:
                filters.emergencyCapability == 'TRAUMA' ? null : 'TRAUMA',
            clearEmergencyCapability: filters.emergencyCapability == 'TRAUMA',
          )),
        ),
        _CupertinoFilterPill(
          label: _sortLabel(filters.sort),
          icon: CupertinoIcons.sort_down,
          selected: true,
          onPressed: () => onChanged(filters.copyWith(
            sort: _nextSort(
              filters.sort,
              geoEnabled: filters.latitude != null && filters.longitude != null,
            ),
          )),
        ),
        if (_hasActiveCatalogFilters(filters))
          _CupertinoFilterPill(
            label: 'Сбросить',
            icon: CupertinoIcons.clear,
            selected: false,
            onPressed: () => onChanged(const CatalogClinicFilters()),
          ),
      ],
    );
  }
}

class _CupertinoFilterPill extends StatelessWidget {
  const _CupertinoFilterPill({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final accent = _cupertinoColor(context, CupertinoColors.activeBlue);
    final fill = selected
        ? accent.withValues(alpha: .18)
        : _cupertinoColor(context, CupertinoColors.secondarySystemFill);
    final textColor =
        selected ? accent : _cupertinoColor(context, CupertinoColors.label);
    return Semantics(
      button: true,
      selected: selected,
      label: '$label${selected ? ', выбран' : ''}',
      child: CupertinoButton(
        minSize: 44,
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected
                  ? accent.withValues(alpha: .36)
                  : _cupertinoColor(context, CupertinoColors.separator),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: textColor),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style:
                        CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                              color: textColor,
                              fontWeight:
                                  selected ? FontWeight.w700 : FontWeight.w500,
                            ),
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

class _CupertinoClinicCard extends StatelessWidget {
  const _CupertinoClinicCard({required this.clinic, required this.onTap});

  final CatalogClinic clinic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _CupertinoGlassSurface(
      padding: EdgeInsets.zero,
      child: Semantics(
        button: true,
        label: _clinicSemanticsLabel(context, clinic),
        child: CupertinoButton(
          minSize: 44,
          padding: const EdgeInsets.all(16),
          onPressed: onTap,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CupertinoIconBubble(
                icon: CupertinoIcons.location,
                color: _cupertinoColor(context, CupertinoColors.activeBlue),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      clinic.name,
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .navTitleTextStyle
                          .copyWith(
                            fontSize: 18,
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.label,
                            ),
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${clinic.locationCount} адрес(а) · ${clinic.serviceCount} услуг(и)',
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.secondaryLabel,
                            ),
                          ),
                    ),
                    if (clinic.distanceKm != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${_distance(clinic.distanceKm!)} от точки поиска',
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .textStyle
                            .copyWith(
                              color: _cupertinoColor(
                                context,
                                CupertinoColors.secondaryLabel,
                              ),
                            ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    _CupertinoClinicBadges(clinic: clinic),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                CupertinoIcons.chevron_right,
                size: 20,
                color: _cupertinoColor(
                  context,
                  CupertinoColors.tertiaryLabel,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoClinicBadges extends StatelessWidget {
  const _CupertinoClinicBadges({required this.clinic});

  final CatalogClinic clinic;

  @override
  Widget build(BuildContext context) {
    final next = clinic.nextAvailableAt;
    return Wrap(
      spacing: 7,
      runSpacing: 7,
      children: [
        if (next != null)
          _CupertinoInfoBadge(
            icon: CupertinoIcons.calendar,
            label: 'Ближайшее: ${_shortDateTime(context, next)}',
            tone: _CupertinoBadgeTone.accent,
          )
        else
          const _CupertinoInfoBadge(
            icon: CupertinoIcons.calendar,
            label: 'Время на следующем шаге',
          ),
        if (clinic.telemedAvailable)
          const _CupertinoInfoBadge(
            icon: CupertinoIcons.video_camera,
            label: 'Онлайн',
          ),
        if (clinic.emergencyAvailable)
          const _CupertinoInfoBadge(
            icon: CupertinoIcons.exclamationmark_circle,
            label: 'Срочная помощь',
            tone: _CupertinoBadgeTone.warning,
          ),
      ],
    );
  }
}

class _CupertinoClinicDetailBody extends StatefulWidget {
  const _CupertinoClinicDetailBody({
    required this.repository,
    required this.request,
    required this.onRetry,
    required this.onSelected,
  });

  final PublicCatalogRepository repository;
  final Future<CatalogClinicDetail>? request;
  final VoidCallback onRetry;
  final ValueChanged<CatalogBookingSelection> onSelected;

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
          return const _CupertinoFeedbackState(
            title: 'Открываем клинику',
            message: 'Загружаем адреса и услуги.',
            loading: true,
          );
        }
        if (snapshot.hasError) {
          return _CupertinoFeedbackState(
            title: 'Не удалось открыть клинику',
            message: 'Проверьте соединение и повторите попытку.',
            actionLabel: 'Повторить',
            onAction: widget.onRetry,
            icon: CupertinoIcons.exclamationmark_circle,
            tone: _CupertinoFeedbackTone.warning,
          );
        }
        final detail = snapshot.data;
        if (detail == null || detail.locations.isEmpty) {
          return const _CupertinoFeedbackState(
            title: 'Нет адресов для записи',
            message: 'Клиника пока не передала активные адреса.',
            icon: CupertinoIcons.location,
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
            final selectedService = _selectedService(services);
            final canContinue =
                location.hasOpenSlots && selectedService != null;
            final actionLabel = !location.hasOpenSlots
                ? 'Свободного времени нет'
                : selectedService == null
                    ? 'Выберите услугу'
                    : 'Выбрать время';
            return Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                    children: [
                      _CupertinoClinicHero(detail: detail),
                      const SizedBox(height: 14),
                      _CupertinoSectionTitle(
                        title: 'Адрес',
                        subtitle: detail.locations.length > 1
                            ? 'Выберите филиал перед просмотром времени.'
                            : null,
                      ),
                      const SizedBox(height: 8),
                      ...List<Widget>.generate(detail.locations.length,
                          (index) {
                        final item = detail.locations[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _CupertinoLocationChoice(
                            location: item,
                            selected: index == _selectedLocationIndex,
                            onTap: () {
                              setState(() {
                                _selectedLocationIndex = index;
                                _selectedServiceId = null;
                                _loadedLocationId = null;
                                _servicesRequest = null;
                              });
                            },
                          ),
                        );
                      }),
                      const SizedBox(height: 8),
                      _CupertinoSectionTitle(
                        title: 'Услуга',
                        subtitle:
                            'Выберите услугу. Дату и время откроем на следующем экране.',
                      ),
                      const SizedBox(height: 8),
                      if (servicesSnapshot.connectionState !=
                          ConnectionState.done)
                        const _CupertinoFeedbackState(
                          title: 'Загружаем услуги',
                          message: 'Получаем актуальный список услуг клиники.',
                          loading: true,
                          compact: true,
                        )
                      else if (servicesSnapshot.hasError)
                        _CupertinoFeedbackState(
                          title: 'Не удалось загрузить услуги',
                          message:
                              'Повторите обновление услуг для выбранного адреса.',
                          actionLabel: 'Повторить',
                          onAction: () => _reloadServices(location.locationId),
                          icon: CupertinoIcons.exclamationmark_circle,
                          tone: _CupertinoFeedbackTone.warning,
                          compact: true,
                        )
                      else if (services.isEmpty)
                        const _CupertinoFeedbackState(
                          title: 'Активные услуги не найдены',
                          message:
                              'Клиника пока не передала услуги для записи.',
                          icon: CupertinoIcons.search,
                          compact: true,
                        )
                      else
                        ...services.map((service) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _CupertinoServiceChoice(
                                service: service,
                                selected: service.id == selectedService?.id,
                                onTap: () => setState(
                                    () => _selectedServiceId = service.id),
                              ),
                            )),
                      const SizedBox(height: 4),
                      _CupertinoBookingContext(
                        location: location,
                        service: selectedService,
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 16),
                  child: _CupertinoPrimaryAction(
                    label: actionLabel,
                    enabled: canContinue,
                    semanticsLabel: selectedService == null
                        ? 'Выберите услугу перед выбором времени'
                        : 'Выбрать время для услуги ${selectedService.displayName}',
                    onPressed: canContinue
                        ? () {
                            final service = selectedService;
                            widget.onSelected(CatalogBookingSelection(
                              location: location,
                              service: service,
                            ));
                          }
                        : null,
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
    return services.first;
  }
}

class _CupertinoClinicHero extends StatelessWidget {
  const _CupertinoClinicHero({required this.detail});

  final CatalogClinicDetail detail;

  @override
  Widget build(BuildContext context) {
    final next = detail.nextAvailableAt;
    return _CupertinoGlassSurface(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CupertinoIconBubble(
            icon: CupertinoIcons.location_solid,
            color: _cupertinoColor(context, CupertinoColors.activeBlue),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  detail.name,
                  style: CupertinoTheme.of(context)
                      .textTheme
                      .navTitleTextStyle
                      .copyWith(
                        fontSize: 20,
                        color: _cupertinoColor(context, CupertinoColors.label),
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${detail.locationCount} адрес(а) · ${detail.serviceCount} услуг(и)',
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.secondaryLabel,
                            ),
                          ),
                ),
                const SizedBox(height: 10),
                _CupertinoClinicBadges(clinic: detail),
                if (next != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Ближайшее время из каталога: ${_fullDateTime(context, next)}',
                    style:
                        CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                              color: _cupertinoColor(
                                context,
                                CupertinoColors.secondaryLabel,
                              ),
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
    return _CupertinoGlassSurface(
      selected: selected,
      padding: EdgeInsets.zero,
      child: Semantics(
        button: true,
        selected: selected,
        label:
            'Адрес ${location.address}. ${location.hasOpenSlots ? 'Есть свободное время.' : 'Свободного времени нет.'}',
        child: CupertinoButton(
          minSize: 44,
          padding: const EdgeInsets.all(14),
          onPressed: onTap,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                selected
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.circle,
                color: selected
                    ? _cupertinoColor(context, CupertinoColors.activeBlue)
                    : _cupertinoColor(context, CupertinoColors.tertiaryLabel),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      location.address,
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.label,
                            ),
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    if (location.phone != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        location.phone!,
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .textStyle
                            .copyWith(
                              color: _cupertinoColor(
                                context,
                                CupertinoColors.secondaryLabel,
                              ),
                            ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    _CupertinoInfoBadge(
                      icon: CupertinoIcons.calendar,
                      label: location.hasOpenSlots
                          ? 'Есть свободное время'
                          : 'Свободного времени нет',
                      tone: location.hasOpenSlots
                          ? _CupertinoBadgeTone.accent
                          : _CupertinoBadgeTone.neutral,
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
    final accent = _cupertinoColor(context, CupertinoColors.activeBlue);
    return _CupertinoGlassSurface(
      selected: selected,
      padding: EdgeInsets.zero,
      child: Semantics(
        button: true,
        selected: selected,
        label:
            'Услуга ${service.displayName}. ${service.durationMinutes} минут. Выбрать услугу.',
        child: CupertinoButton(
          minSize: 44,
          padding: const EdgeInsets.all(14),
          onPressed: onTap,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CupertinoIconBubble(
                icon: selected
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.plus_app,
                color: selected
                    ? accent
                    : _cupertinoColor(context, CupertinoColors.systemGrey),
                compact: true,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service.displayName,
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.label,
                            ),
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${service.durationMinutes} мин · ${_price(service)}',
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(
                            color: _cupertinoColor(
                              context,
                              CupertinoColors.secondaryLabel,
                            ),
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                selected
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.chevron_right,
                size: 20,
                color: selected
                    ? accent
                    : _cupertinoColor(context, CupertinoColors.tertiaryLabel),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CupertinoBookingContext extends StatelessWidget {
  const _CupertinoBookingContext({
    required this.location,
    required this.service,
  });

  final CatalogLocation location;
  final CatalogService? service;

  @override
  Widget build(BuildContext context) {
    final selectedService = service;
    return _CupertinoGlassSurface(
      fill: _cupertinoColor(context, CupertinoColors.activeBlue).withValues(
        alpha: MediaQuery.platformBrightnessOf(context) == Brightness.dark
            ? .16
            : .11,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            CupertinoIcons.calendar,
            color: _cupertinoColor(context, CupertinoColors.activeBlue),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              selectedService == null
                  ? 'Выберите услугу, чтобы посмотреть доступное время.'
                  : 'Дальше выберите дату и время для «${selectedService.displayName}» в ${location.clinicName}. До выбора времени запись не создаётся.',
              style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                    color: _cupertinoColor(context, CupertinoColors.label),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoPrimaryAction extends StatelessWidget {
  const _CupertinoPrimaryAction({
    required this.label,
    required this.enabled,
    required this.semanticsLabel,
    required this.onPressed,
  });

  final String label;
  final bool enabled;
  final String semanticsLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final fill = enabled
        ? _cupertinoColor(context, CupertinoColors.activeBlue)
        : _cupertinoColor(context, CupertinoColors.systemFill);
    final foreground = enabled
        ? CupertinoColors.white
        : _cupertinoColor(context, CupertinoColors.secondaryLabel);
    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticsLabel,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(18),
          boxShadow: enabled
              ? [
                  BoxShadow(
                    color: _cupertinoColor(context, CupertinoColors.activeBlue)
                        .withValues(alpha: .22),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: CupertinoButton(
          minSize: 52,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          onPressed: enabled ? onPressed : null,
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ),
    );
  }
}

class _CupertinoSectionTitle extends StatelessWidget {
  const _CupertinoSectionTitle({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final secondary = _cupertinoColor(context, CupertinoColors.secondaryLabel);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style:
              CupertinoTheme.of(context).textTheme.navTitleTextStyle.copyWith(
                    fontSize: 18,
                    color: _cupertinoColor(context, CupertinoColors.label),
                  ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(
            subtitle!,
            style: CupertinoTheme.of(context)
                .textTheme
                .textStyle
                .copyWith(color: secondary),
          ),
        ],
      ],
    );
  }
}

enum _CupertinoBadgeTone { neutral, accent, warning }

class _CupertinoInfoBadge extends StatelessWidget {
  const _CupertinoInfoBadge({
    required this.icon,
    required this.label,
    this.tone = _CupertinoBadgeTone.neutral,
  });

  final IconData icon;
  final String label;
  final _CupertinoBadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final accent = switch (tone) {
      _CupertinoBadgeTone.accent =>
        _cupertinoColor(context, CupertinoColors.activeBlue),
      _CupertinoBadgeTone.warning =>
        _cupertinoColor(context, CupertinoColors.systemRed),
      _ => _cupertinoColor(context, CupertinoColors.secondaryLabel),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: .20)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: accent),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                      color: accent,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoIconBubble extends StatelessWidget {
  const _CupertinoIconBubble({
    required this.icon,
    required this.color,
    this.compact = false,
  });

  final IconData icon;
  final Color color;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final size = compact ? 38.0 : 46.0;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: .14),
        borderRadius: BorderRadius.circular(size / 2),
      ),
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(icon, size: compact ? 20 : 23, color: color),
      ),
    );
  }
}

class _CupertinoGlassSurface extends StatelessWidget {
  const _CupertinoGlassSurface({
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.selected = false,
    this.fill,
  });

  final Widget child;
  final EdgeInsets padding;
  final bool selected;
  final Color? fill;

  @override
  Widget build(BuildContext context) {
    final brightness = MediaQuery.platformBrightnessOf(context);
    final accent = _cupertinoColor(context, CupertinoColors.activeBlue);
    final surface = fill ??
        _cupertinoColor(context, CupertinoColors.systemBackground).withValues(
          alpha: brightness == Brightness.dark ? .68 : .78,
        );
    final border = selected
        ? accent.withValues(alpha: .74)
        : _cupertinoColor(context, CupertinoColors.separator)
            .withValues(alpha: .42);
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: border, width: selected ? 1.6 : 1),
            boxShadow: brightness == Brightness.dark
                ? null
                : [
                    BoxShadow(
                      color:
                          _cupertinoColor(context, CupertinoColors.systemGrey)
                              .withValues(alpha: .12),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

enum _CupertinoFeedbackTone { neutral, warning }

class _CupertinoFeedbackState extends StatelessWidget {
  const _CupertinoFeedbackState({
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.icon,
    this.loading = false,
    this.compact = false,
    this.tone = _CupertinoFeedbackTone.neutral,
  });

  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;
  final bool loading;
  final bool compact;
  final _CupertinoFeedbackTone tone;

  @override
  Widget build(BuildContext context) {
    final accent = tone == _CupertinoFeedbackTone.warning
        ? _cupertinoColor(context, CupertinoColors.systemRed)
        : _cupertinoColor(context, CupertinoColors.activeBlue);
    final content = _CupertinoGlassSurface(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (loading)
            const CupertinoActivityIndicator(radius: 14)
          else
            Icon(icon ?? CupertinoIcons.search, size: 32, color: accent),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style:
                CupertinoTheme.of(context).textTheme.navTitleTextStyle.copyWith(
                      fontSize: 18,
                      color: _cupertinoColor(context, CupertinoColors.label),
                    ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                  color: _cupertinoColor(
                    context,
                    CupertinoColors.secondaryLabel,
                  ),
                ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 12),
            _CupertinoPrimaryAction(
              label: actionLabel!,
              enabled: true,
              semanticsLabel: actionLabel!,
              onPressed: onAction,
            ),
          ],
        ],
      ),
    );
    if (compact) return content;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: content,
      ),
    );
  }
}

class _ClinicsBody extends StatelessWidget {
  const _ClinicsBody({
    required this.search,
    required this.filters,
    required this.viewMode,
    required this.request,
    required this.onReload,
    required this.onFiltersChanged,
    required this.onViewModeChanged,
    required this.onOpenClinic,
  });

  final TextEditingController search;
  final CatalogClinicFilters filters;
  final _CatalogViewMode viewMode;
  final Future<List<CatalogClinic>>? request;
  final VoidCallback onReload;
  final ValueChanged<CatalogClinicFilters> onFiltersChanged;
  final ValueChanged<_CatalogViewMode> onViewModeChanged;
  final ValueChanged<CatalogClinic> onOpenClinic;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
          child: Column(
            children: [
              SearchBar(
                controller: search,
                hintText: 'Название, адрес или услуга',
                leading: const Icon(Icons.search),
                trailing: [
                  IconButton(
                      onPressed: onReload, icon: const Icon(Icons.refresh))
                ],
                onSubmitted: (_) => onReload(),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  SegmentedButton<_CatalogViewMode>(
                    segments: const [
                      ButtonSegment(
                          value: _CatalogViewMode.list,
                          icon: Icon(Icons.list_alt),
                          label: Text('Список')),
                      ButtonSegment(
                          value: _CatalogViewMode.map,
                          icon: Icon(Icons.map_outlined),
                          label: Text('Карта')),
                    ],
                    selected: {viewMode},
                    onSelectionChanged: (value) =>
                        onViewModeChanged(value.single),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _CatalogFilters(
                filters: filters,
                onChanged: onFiltersChanged,
              ),
            ],
          ),
        ),
        Expanded(
          child: FutureBuilder<List<CatalogClinic>>(
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
                return const _CatalogEmpty(
                    text: 'По этому запросу активных клиник не найдено.');
              }
              if (viewMode == _CatalogViewMode.map) {
                return _MapFallback(
                  clinics: clinics,
                  onOpenClinic: onOpenClinic,
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                itemCount: clinics.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) => _ClinicCard(
                  clinic: clinics[index],
                  onTap: () => onOpenClinic(clinics[index]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CatalogFilters extends StatelessWidget {
  const _CatalogFilters({required this.filters, required this.onChanged});

  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;

  @override
  Widget build(BuildContext context) {
    final serviceCode = filters.serviceCode;
    final todaySelected =
        filters.availableFrom != null && filters.availableTo != null;
    return Align(
      alignment: Alignment.centerLeft,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          FilterChip(
            avatar: const Icon(Icons.event_available_outlined, size: 18),
            label: const Text('Ближайшие окна'),
            selected: filters.openNow == true,
            onSelected: (selected) =>
                onChanged(filters.copyWith(openNow: selected)),
          ),
          FilterChip(
            avatar: const Icon(Icons.today_outlined, size: 18),
            label: const Text('Сегодня'),
            selected: todaySelected,
            onSelected: (selected) => onChanged(selected
                ? filters.copyWith(
                    availableFrom: _todayStart(),
                    availableTo: _todayStart().add(const Duration(days: 1)),
                    openNow: true,
                  )
                : filters.copyWith(clearAvailability: true, openNow: false)),
          ),
          _GeoFilterChip(filters: filters, onChanged: onChanged),
          FilterChip(
            avatar: const Icon(Icons.medical_services_outlined, size: 18),
            label: const Text('Первичный приём'),
            selected: serviceCode == 'GENERAL_VISIT',
            onSelected: (selected) => onChanged(filters.copyWith(
              serviceCode: selected ? 'GENERAL_VISIT' : null,
              clearServiceCode: !selected,
            )),
          ),
          FilterChip(
            avatar: const Icon(Icons.video_call_outlined, size: 18),
            label: const Text('Онлайн'),
            selected: filters.telemedAvailable == true,
            onSelected: (selected) =>
                onChanged(filters.copyWith(telemedAvailable: selected)),
          ),
          FilterChip(
            avatar: const Icon(Icons.emergency_outlined, size: 18),
            label: const Text('Срочная помощь'),
            selected: filters.emergencyCapability == 'TRAUMA',
            onSelected: (selected) => onChanged(filters.copyWith(
              emergencyCapability: selected ? 'TRAUMA' : null,
              clearEmergencyCapability: !selected,
            )),
          ),
          ChoiceChip(
            avatar: const Icon(Icons.sort_by_alpha, size: 18),
            label: Text(_sortLabel(filters.sort)),
            selected: true,
            onSelected: (_) => onChanged(filters.copyWith(
                sort: _nextSort(filters.sort,
                    geoEnabled: filters.latitude != null &&
                        filters.longitude != null))),
          ),
        ],
      ),
    );
  }
}

class _GeoFilterChip extends StatelessWidget {
  const _GeoFilterChip({required this.filters, required this.onChanged});

  final CatalogClinicFilters filters;
  final ValueChanged<CatalogClinicFilters> onChanged;

  @override
  Widget build(BuildContext context) {
    final active = filters.latitude != null && filters.longitude != null;
    return FilterChip(
      avatar: const Icon(Icons.my_location_outlined, size: 18),
      label: Text(active ? 'До ${filters.radiusKm ?? 10} км' : 'Радиус'),
      selected: active,
      onSelected: (_) => _openGeoSheet(context),
      onDeleted: active
          ? () => onChanged(filters.copyWith(clearGeo: true, sort: 'soonest'))
          : null,
    );
  }

  Future<void> _openGeoSheet(BuildContext context) async {
    final next = await showModalBottomSheet<CatalogClinicFilters>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _GeoFilterSheet(filters: filters),
    );
    if (next != null) onChanged(next);
  }
}

class _GeoFilterSheet extends StatefulWidget {
  const _GeoFilterSheet({required this.filters});

  final CatalogClinicFilters filters;

  @override
  State<_GeoFilterSheet> createState() => _GeoFilterSheetState();
}

class _GeoFilterSheetState extends State<_GeoFilterSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _latitude;
  late final TextEditingController _longitude;
  late final TextEditingController _radius;

  @override
  void initState() {
    super.initState();
    _latitude =
        TextEditingController(text: widget.filters.latitude?.toString());
    _longitude =
        TextEditingController(text: widget.filters.longitude?.toString());
    _radius =
        TextEditingController(text: (widget.filters.radiusKm ?? 10).toString());
  }

  @override
  void dispose() {
    _latitude.dispose();
    _longitude.dispose();
    _radius.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottom),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Поиск рядом',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _latitude,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Широта',
                      ),
                      validator: (value) =>
                          _numberInRange(value, -90, 90, 'Широта'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _longitude,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Долгота',
                      ),
                      validator: (value) =>
                          _numberInRange(value, -180, 180, 'Долгота'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _radius,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Радиус, км',
                ),
                validator: (value) => _numberInRange(value, 0.1, 200, 'Радиус'),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _apply,
                icon: const Icon(Icons.check),
                label: const Text('Применить'),
              ),
              TextButton.icon(
                onPressed: () => Navigator.of(context)
                    .pop(widget.filters.copyWith(clearGeo: true)),
                icon: const Icon(Icons.clear),
                label: const Text('Сбросить радиус'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _apply() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(widget.filters.copyWith(
      latitude: _parseNumber(_latitude.text),
      longitude: _parseNumber(_longitude.text),
      radiusKm: _parseNumber(_radius.text),
      sort: 'distance',
    ));
  }
}

class _MapFallback extends StatelessWidget {
  const _MapFallback({required this.clinics, required this.onOpenClinic});

  final List<CatalogClinic> clinics;
  final ValueChanged<CatalogClinic> onOpenClinic;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      itemCount: clinics.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        if (index == 0) {
          return DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.secondaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Padding(
              padding: EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(Icons.location_off_outlined),
                  SizedBox(width: 10),
                  Expanded(
                      child: Text(
                          'Список отсортирован без доступа к геолокации.')),
                ],
              ),
            ),
          );
        }
        final clinic = clinics[index - 1];
        return _ClinicMapRow(
          clinic: clinic,
          onTap: () => onOpenClinic(clinic),
        );
      },
    );
  }
}

class _ClinicMapRow extends StatelessWidget {
  const _ClinicMapRow({required this.clinic, required this.onTap});

  final CatalogClinic clinic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final next = clinic.nextAvailableAt;
    return Material(
      color: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Theme.of(context).dividerColor),
      ),
      child: ListTile(
        onTap: onTap,
        leading: const Icon(Icons.place_outlined),
        title: Text(clinic.name),
        subtitle: Text(next == null
            ? 'Нет ближайших окон'
            : _shortDateTime(context, next)),
        trailing: const Icon(Icons.chevron_right),
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
      child: Semantics(
        button: true,
        label: 'Открыть клинику ${clinic.name}',
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
                            ? 'Нет окон'
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
          label: clinic.nextAvailableAt == null ? 'Нет окон' : 'Есть окна',
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
  });

  final PublicCatalogRepository repository;
  final Future<CatalogClinicDetail>? request;
  final VoidCallback onRetry;
  final ValueChanged<CatalogBookingSelection> onSelected;

  @override
  State<_ClinicDetailBody> createState() => _ClinicDetailBodyState();
}

class _ClinicDetailBodyState extends State<_ClinicDetailBody> {
  int _selectedLocationIndex = 0;
  String? _selectedServiceId;
  String? _loadedLocationId;
  DateTime _selectedAvailabilityDay = _todayStart();
  Future<_LocationSnapshot>? _locationRequest;

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
        _ensureLocationRequest(location.locationId);
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
            FutureBuilder<_LocationSnapshot>(
              future: _locationRequest,
              builder: (context, locationSnapshot) {
                if (locationSnapshot.connectionState != ConnectionState.done) {
                  return const Center(
                      child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: CircularProgressIndicator(),
                  ));
                }
                if (locationSnapshot.hasError) {
                  return _InlineRetry(
                      onRetry: () => _reloadLocation(location.locationId));
                }
                final data = locationSnapshot.data ??
                    const _LocationSnapshot(
                        services: <CatalogService>[],
                        slots: <CatalogAvailabilitySlot>[]);
                final selectedService = _selectedService(data.services);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ServicesSection(
                      services: data.services,
                      selectedServiceId: selectedService?.id,
                      onSelected: (service) =>
                          setState(() => _selectedServiceId = service.id),
                    ),
                    const SizedBox(height: 16),
                    Semantics(
                      button: true,
                      label: selectedService == null
                          ? 'Выберите услугу перед выбором времени'
                          : 'Выбрать время для услуги ${selectedService.displayName}',
                      child: FilledButton.icon(
                        onPressed: location.hasOpenSlots &&
                                selectedService != null
                            ? () => widget.onSelected(CatalogBookingSelection(
                                  location: location,
                                  service: selectedService,
                                ))
                            : null,
                        icon: const Icon(Icons.calendar_month_outlined),
                        label: Text(!location.hasOpenSlots
                            ? 'Свободных окон нет'
                            : selectedService == null
                                ? 'Выберите услугу'
                                : 'Выбрать время'),
                        style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(52)),
                      ),
                    ),
                    const SizedBox(height: 20),
                    _AvailabilityDaySelector(
                      selectedDay: _selectedAvailabilityDay,
                      onSelected: (day) {
                        setState(() {
                          _selectedAvailabilityDay = _dayStart(day);
                          _locationRequest = _loadLocation(location.locationId);
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    _AvailabilitySection(
                      slots: data.slots,
                      service: selectedService,
                    ),
                    const SizedBox(height: 24),
                    Semantics(
                      button: true,
                      label: selectedService == null
                          ? 'Выберите услугу перед выбором времени'
                          : 'Выбрать время для услуги ${selectedService.displayName}',
                      child: FilledButton.icon(
                        onPressed: location.hasOpenSlots &&
                                selectedService != null
                            ? () => widget.onSelected(CatalogBookingSelection(
                                  location: location,
                                  service: selectedService,
                                ))
                            : null,
                        icon: const Icon(Icons.calendar_month_outlined),
                        label: Text(!location.hasOpenSlots
                            ? 'Свободных окон нет'
                            : selectedService == null
                                ? 'Выберите услугу'
                                : 'Выбрать время'),
                        style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(52)),
                      ),
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

  void _ensureLocationRequest(String locationId) {
    if (_loadedLocationId == locationId && _locationRequest != null) return;
    _loadedLocationId = locationId;
    _selectedServiceId = null;
    _locationRequest = _loadLocation(locationId);
  }

  void _reloadLocation(String locationId) {
    setState(() {
      _loadedLocationId = locationId;
      _locationRequest = _loadLocation(locationId);
    });
  }

  Future<_LocationSnapshot> _loadLocation(String locationId) async {
    final now = DateTime.now();
    final dayStart = _dayStart(_selectedAvailabilityDay);
    final from = _sameDay(dayStart, _dayStart(now)) ? now : dayStart;
    final results = await Future.wait<Object>([
      widget.repository.listLocationServices(locationId),
      widget.repository.readAvailability(
        locationId: locationId,
        from: from,
        to: dayStart.add(const Duration(days: 1)),
      ),
    ]);
    return _LocationSnapshot(
      services: results[0] as List<CatalogService>,
      slots: results[1] as List<CatalogAvailabilitySlot>,
    );
  }

  CatalogService? _selectedService(List<CatalogService> services) {
    if (services.isEmpty) return null;
    final selectedId = _selectedServiceId;
    if (selectedId != null) {
      for (final service in services) {
        if (service.id == selectedId) return service;
      }
    }
    return services.first;
  }
}

class _AvailabilityDaySelector extends StatelessWidget {
  const _AvailabilityDaySelector({
    required this.selectedDay,
    required this.onSelected,
  });

  final DateTime selectedDay;
  final ValueChanged<DateTime> onSelected;

  @override
  Widget build(BuildContext context) {
    final today = _todayStart();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('День записи', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        SizedBox(
          height: 72,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: 7,
            itemBuilder: (context, index) {
              final day = today.add(Duration(days: index));
              final selected = _sameDay(day, selectedDay);
              return Padding(
                padding: EdgeInsets.only(right: index == 6 ? 0 : 8),
                child: _CatalogDayChip(
                  day: day,
                  selected: selected,
                  onTap: () => onSelected(day),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _CatalogDayChip extends StatelessWidget {
  const _CatalogDayChip({
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        width: 88,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? colors.primaryContainer : colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? colors.primary : Theme.of(context).dividerColor,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_dayLabel(day),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 2),
            Text('${day.day}', style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
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
      child: Semantics(
        button: true,
        selected: selected,
        label: 'Выбрать адрес ${location.address}',
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
                  label: Text(location.hasOpenSlots ? 'Есть окна' : 'Нет окон'),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
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

class _AvailabilitySection extends StatelessWidget {
  const _AvailabilitySection({required this.slots, required this.service});

  final List<CatalogAvailabilitySlot> slots;
  final CatalogService? service;

  @override
  Widget build(BuildContext context) {
    final selectedService = service;
    final visibleSlots = selectedService == null
        ? const <CatalogAvailabilitySlot>[]
        : slots
            .where((slot) =>
                slot.serviceId == null || slot.serviceId == selectedService.id)
            .toList(growable: false);
    if (visibleSlots.isEmpty) {
      return const _CatalogEmpty(text: 'На ближайшие дни свободных окон нет.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Ближайшее время', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: visibleSlots.length,
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 180,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.9,
          ),
          itemBuilder: (context, index) => _AvailabilitySlotPreview(
            slot: visibleSlots[index],
          ),
        ),
      ],
    );
  }
}

class _AvailabilitySlotPreview extends StatelessWidget {
  const _AvailabilitySlotPreview({required this.slot});

  final CatalogAvailabilitySlot slot;

  @override
  Widget build(BuildContext context) {
    final start = TimeOfDay.fromDateTime(slot.startsAt).format(context);
    final end = TimeOfDay.fromDateTime(slot.endsAt).format(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                const Icon(Icons.schedule, size: 18),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    start,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text('до $end',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall),
            if (slot.serviceName != null)
              Text(slot.serviceName!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall),
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
                      Text(
                          '${service.durationMinutes} мин · ${_price(service)}'),
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
            const Expanded(child: Text('Не удалось обновить услуги и время.')),
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
  const _CatalogEmpty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Text(text),
      ),
    );
  }
}

class _LocationSnapshot {
  const _LocationSnapshot({required this.services, required this.slots});

  final List<CatalogService> services;
  final List<CatalogAvailabilitySlot> slots;
}

Color _cupertinoColor(BuildContext context, Color color) =>
    CupertinoDynamicColor.resolve(color, context);

bool _usesCupertinoCatalog(BuildContext context) =>
    Theme.of(context).platform == TargetPlatform.iOS;

bool _hasActiveCatalogFilters(CatalogClinicFilters filters) {
  return filters.serviceCode != null ||
      filters.latitude != null ||
      filters.longitude != null ||
      filters.availableFrom != null ||
      filters.availableTo != null ||
      filters.openNow == true ||
      filters.telemedAvailable == true ||
      filters.emergencyCapability != null ||
      filters.sort != 'soonest';
}

String _clinicSemanticsLabel(BuildContext context, CatalogClinic clinic) {
  final parts = <String>[
    'Клиника ${clinic.name}.',
    '${clinic.locationCount} адрес(а).',
    '${clinic.serviceCount} услуг(и).',
  ];
  final next = clinic.nextAvailableAt;
  if (next != null) {
    parts.add('Ближайшее время: ${_shortDateTime(context, next)}.');
  }
  if (clinic.distanceKm != null) {
    parts.add('${_distance(clinic.distanceKm!)} от точки поиска.');
  }
  parts.add('Открыть услуги.');
  return parts.join(' ');
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

DateTime _dayStart(DateTime value) =>
    DateTime(value.year, value.month, value.day);

bool _sameDay(DateTime first, DateTime second) =>
    first.year == second.year &&
    first.month == second.month &&
    first.day == second.day;

String _dayLabel(DateTime day) {
  final today = _todayStart();
  if (_sameDay(day, today)) return 'Сегодня';
  if (_sameDay(day, today.add(const Duration(days: 1)))) return 'Завтра';
  const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return names[day.weekday - 1];
}

String _price(CatalogService service) {
  final value = service.priceAmount.replaceAll(RegExp(r'\.0+$'), '');
  return service.currency == 'RUB' ? '$value ₽' : '$value ${service.currency}';
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

String? _numberInRange(
  String? value,
  double min,
  double max,
  String label,
) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) return 'Заполните поле.';
  final parsed = double.tryParse(normalized.replaceAll(',', '.'));
  if (parsed == null || parsed < min || parsed > max) {
    return '$label: от $min до $max.';
  }
  return null;
}

String _distance(double value) {
  if (value < 1) return '${(value * 1000).round()} м';
  return '${value.toStringAsFixed(value < 10 ? 1 : 0)} км';
}

double _parseNumber(String value) =>
    double.parse(value.trim().replaceAll(',', '.'));

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
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}
