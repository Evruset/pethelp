import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../presentation/platform/owner_platform.dart';
import 'emergency_repository.dart';

class EmergencyPage extends StatefulWidget {
  const EmergencyPage({
    super.key,
    required this.repository,
    this.initialSpecies = 'DOG',
    this.initialCapabilities = const <String>['OXYGEN_SUPPORT'],
    this.triageDecision,
    this.platformOverride,
  });

  final EmergencyRepository repository;
  final String initialSpecies;
  final List<String> initialCapabilities;
  final EmergencyTriageDecision? triageDecision;
  final TargetPlatform? platformOverride;

  @override
  State<EmergencyPage> createState() => _EmergencyPageState();
}

class _EmergencyPageState extends State<EmergencyPage> {
  late String _species;
  late final Set<String> _capabilities;
  Future<_EmergencyClinicResult>? _request;

  @override
  void initState() {
    super.initState();
    _species = widget.initialSpecies;
    _capabilities = widget.initialCapabilities.toSet();
    _search();
  }

  void _search() {
    final filters = _filters();
    setState(() {
      _request = _loadClinics(filters);
    });
  }

  EmergencyClinicFilters _filters() {
    return EmergencyClinicFilters(
      species: _species,
      requiredCapabilities: _capabilities.toList(growable: false),
    );
  }

  Future<_EmergencyClinicResult> _loadClinics(
    EmergencyClinicFilters filters,
  ) async {
    try {
      final clinics = await widget.repository.search(filters);
      return _EmergencyClinicResult.online(clinics);
    } catch (_) {
      final cached = await widget.repository.cached(filters);
      if (cached != null && cached.clinics.isNotEmpty) {
        return _EmergencyClinicResult.cached(cached);
      }
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_usesCupertino(context)) {
      return _buildCupertino(context);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Срочная помощь')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.triageDecision != null) ...[
                    _TriageDecisionBanner(decision: widget.triageDecision!),
                    const SizedBox(height: 12),
                  ],
                  const _EmergencyDisclaimer(),
                  const SizedBox(height: 12),
                  Text('Питомец',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                          value: 'DOG',
                          icon: Icon(Icons.pets),
                          label: Text('Собака')),
                      ButtonSegment(
                          value: 'CAT',
                          icon: Icon(Icons.pets),
                          label: Text('Кошка')),
                      ButtonSegment(
                          value: 'OTHER',
                          icon: Icon(Icons.more_horiz),
                          label: Text('Другой')),
                    ],
                    selected: {_species},
                    onSelectionChanged: (value) {
                      setState(() => _species = value.single);
                      _search();
                    },
                  ),
                  const SizedBox(height: 12),
                  Text('Что нужно сейчас',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  _CapabilityFilters(
                    selected: _capabilities,
                    onChanged: (value) {
                      setState(() {
                        _capabilities
                          ..clear()
                          ..addAll(value);
                      });
                      _search();
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: FutureBuilder<_EmergencyClinicResult>(
                future: _request,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return _EmergencyError(onRetry: _search);
                  }
                  final result =
                      snapshot.data ?? _EmergencyClinicResult.online(const []);
                  final clinics = result.clinics;
                  if (clinics.isEmpty) {
                    return const _EmergencyEmpty();
                  }
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    children: [
                      if (result.cachedAt != null) ...[
                        _CachedEmergencyBanner(cachedAt: result.cachedAt!),
                        const SizedBox(height: 8),
                      ],
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: clinics.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) => _EmergencyClinicCard(
                          clinic: clinics[index],
                          repository: widget.repository,
                          triageDecision: widget.triageDecision,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _usesCupertino(BuildContext context) {
    final themedPlatform =
        context.findAncestorWidgetOfExactType<Theme>()?.data.platform;
    return ownerUsesCupertino(
      platform: widget.platformOverride ?? themedPlatform,
    );
  }

  Widget _buildCupertino(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('Срочные клиники'),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.triageDecision != null) ...[
                    _CupertinoTriageDecisionBanner(
                      decision: widget.triageDecision!,
                    ),
                    const SizedBox(height: 12),
                  ],
                  const _CupertinoEmergencyDisclaimer(),
                  const SizedBox(height: 12),
                  _CupertinoEmergencySpeciesControl(
                    species: _species,
                    onChanged: (value) {
                      setState(() => _species = value);
                      _search();
                    },
                  ),
                  const SizedBox(height: 12),
                  _CupertinoCapabilityFilters(
                    selected: _capabilities,
                    onChanged: (value) {
                      setState(() {
                        _capabilities
                          ..clear()
                          ..addAll(value);
                      });
                      _search();
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: FutureBuilder<_EmergencyClinicResult>(
                future: _request,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CupertinoActivityIndicator());
                  }
                  if (snapshot.hasError) {
                    return _CupertinoEmergencyError(onRetry: _search);
                  }
                  final result =
                      snapshot.data ?? _EmergencyClinicResult.online(const []);
                  final clinics = result.clinics;
                  if (clinics.isEmpty) {
                    return const _CupertinoEmergencyEmpty();
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount:
                        clinics.length + (result.cachedAt != null ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      if (result.cachedAt != null && index == 0) {
                        return _CupertinoCachedEmergencyBanner(
                          cachedAt: result.cachedAt!,
                        );
                      }
                      final clinicIndex =
                          result.cachedAt != null ? index - 1 : index;
                      return _CupertinoEmergencyClinicCard(
                        clinic: clinics[clinicIndex],
                        repository: widget.repository,
                        triageDecision: widget.triageDecision,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencyClinicResult {
  const _EmergencyClinicResult({
    required this.clinics,
    required this.cachedAt,
  });

  factory _EmergencyClinicResult.online(List<EmergencyClinic> clinics) {
    return _EmergencyClinicResult(clinics: clinics, cachedAt: null);
  }

  factory _EmergencyClinicResult.cached(EmergencyCachedClinics cached) {
    return _EmergencyClinicResult(
      clinics: cached.clinics,
      cachedAt: cached.cachedAt,
    );
  }

  final List<EmergencyClinic> clinics;
  final DateTime? cachedAt;
}

class _EmergencyDisclaimer extends StatelessWidget {
  const _EmergencyDisclaimer();

  @override
  Widget build(BuildContext context) => Card(
        color: Theme.of(context).colorScheme.errorContainer,
        child: const Padding(
          padding: EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.warning_amber_rounded),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'При тяжёлом дыхании, судорогах, сильном кровотечении или потере сознания звоните в клинику сразу. VetHelp показывает только проверенные срочные профили.',
                ),
              ),
            ],
          ),
        ),
      );
}

class _CupertinoEmergencyDisclaimer extends StatelessWidget {
  const _CupertinoEmergencyDisclaimer();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label:
          'Важное предупреждение. Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.systemRed.withValues(alpha: 0.16),
            context,
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.systemRed,
              context,
            ),
          ),
        ),
        child: const Padding(
          padding: EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(CupertinoIcons.exclamationmark_triangle_fill),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CachedEmergencyBanner extends StatelessWidget {
  const _CachedEmergencyBanner({required this.cachedAt});

  final DateTime cachedAt;

  @override
  Widget build(BuildContext context) => Card(
        color: Theme.of(context).colorScheme.secondaryContainer,
        child: ListTile(
          leading: const Icon(Icons.cloud_off_outlined),
          title: const Text('Показаны последние полученные клиники'),
          subtitle: Text(
            'Обновлялись: ${_dateTime(context, cachedAt)}. Позвоните перед выездом.',
          ),
        ),
      );
}

class _CupertinoCachedEmergencyBanner extends StatelessWidget {
  const _CupertinoCachedEmergencyBanner({required this.cachedAt});

  final DateTime cachedAt;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.systemYellow.withValues(alpha: 0.16),
          context,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            const Icon(CupertinoIcons.cloud),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Показаны последние полученные клиники. Обновлялись: ${_cupertinoDateTime(cachedAt)}. Позвоните перед выездом.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TriageDecisionBanner extends StatelessWidget {
  const _TriageDecisionBanner({required this.decision});

  final EmergencyTriageDecision decision;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visual = _triageVisual(decision.outcome, theme.colorScheme);
    return Card(
      color: visual.background,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(visual.icon, color: visual.foreground),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(visual.title, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(decision.ownerMessage),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoTriageDecisionBanner extends StatelessWidget {
  const _CupertinoTriageDecisionBanner({required this.decision});

  final EmergencyTriageDecision decision;

  @override
  Widget build(BuildContext context) {
    final visual = _cupertinoTriageVisual(context, decision.outcome);
    final severe = decision.outcome == 'EMERGENCY' ||
        decision.selectedSignals.any(_isEmergencyRedFlag);
    final copy = severe
        ? 'Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.'
        : _safeEmergencyText(decision.ownerMessage);
    return Semantics(
      liveRegion: true,
      label: severe ? 'Срочная помощь. $copy' : '${visual.title}. $copy',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: visual.background,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: visual.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(visual.icon, color: visual.foreground),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      visual.title,
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .navTitleTextStyle
                          .copyWith(fontSize: 18),
                    ),
                    const SizedBox(height: 4),
                    Text(copy),
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

class _CapabilityFilters extends StatelessWidget {
  const _CapabilityFilters({required this.selected, required this.onChanged});

  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _chip('OXYGEN_SUPPORT', 'Кислород'),
        _chip('TRAUMA', 'Травма'),
        _chip('TOXICOLOGY', 'Отравление'),
        _chip('EMERGENCY_SURGERY', 'Операционная'),
        _chip('INPATIENT_CARE', 'Стационар'),
      ],
    );
  }

  Widget _chip(String code, String label) {
    return FilterChip(
      avatar: const Icon(Icons.health_and_safety_outlined, size: 18),
      label: Text(label),
      selected: selected.contains(code),
      onSelected: (enabled) {
        final next = Set<String>.from(selected);
        if (enabled) {
          next.add(code);
        } else {
          next.remove(code);
        }
        onChanged(next);
      },
    );
  }
}

class _CupertinoEmergencySpeciesControl extends StatelessWidget {
  const _CupertinoEmergencySpeciesControl({
    required this.species,
    required this.onChanged,
  });

  final String species;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return _CupertinoEmergencyPanel(
      title: 'Питомец',
      child: CupertinoSlidingSegmentedControl<String>(
        groupValue: species,
        children: const {
          'DOG': Padding(
            padding: EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            child: Text('Собака'),
          ),
          'CAT': Padding(
            padding: EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            child: Text('Кошка'),
          ),
          'OTHER': Padding(
            padding: EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            child: Text('Другой'),
          ),
        },
        onValueChanged: (value) {
          if (value != null) onChanged(value);
        },
      ),
    );
  }
}

class _CupertinoCapabilityFilters extends StatelessWidget {
  const _CupertinoCapabilityFilters({
    required this.selected,
    required this.onChanged,
  });

  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return _CupertinoEmergencyPanel(
      title: 'Что нужно сейчас',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _button(context, 'OXYGEN_SUPPORT', 'Кислород'),
          _button(context, 'TRAUMA', 'Травма'),
          _button(context, 'TOXICOLOGY', 'Отравление'),
          _button(context, 'EMERGENCY_SURGERY', 'Операционная'),
          _button(context, 'INPATIENT_CARE', 'Стационар'),
        ],
      ),
    );
  }

  Widget _button(BuildContext context, String code, String label) {
    final active = selected.contains(code);
    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: CupertinoButton(
        minSize: 44,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        color: active
            ? CupertinoColors.activeBlue
            : CupertinoDynamicColor.resolve(
                CupertinoColors.tertiarySystemFill,
                context,
              ),
        borderRadius: BorderRadius.circular(999),
        onPressed: () {
          final next = Set<String>.from(selected);
          if (active) {
            next.remove(code);
          } else {
            next.add(code);
          }
          onChanged(next);
        },
        child: Text(
          label,
          style: TextStyle(
            color: active
                ? CupertinoColors.white
                : CupertinoDynamicColor.resolve(CupertinoColors.label, context),
          ),
        ),
      ),
    );
  }
}

class _CupertinoEmergencyPanel extends StatelessWidget {
  const _CupertinoEmergencyPanel({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 18),
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _EmergencyClinicCard extends StatelessWidget {
  const _EmergencyClinicCard({
    required this.clinic,
    required this.repository,
    required this.triageDecision,
  });

  final EmergencyClinic clinic;
  final EmergencyRepository repository;
  final EmergencyTriageDecision? triageDecision;

  @override
  Widget build(BuildContext context) {
    final phone = clinic.emergencyContactPhone;
    final routeUri = _routeUri(clinic);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.local_hospital_outlined, size: 30),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(clinic.clinicName,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(clinic.address),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                Chip(
                  avatar: const Icon(Icons.verified_outlined, size: 18),
                  label: const Text('Проверено'),
                  visualDensity: VisualDensity.compact,
                ),
                if (clinic.straightLineDistanceKm != null)
                  Chip(
                    avatar: const Icon(Icons.place_outlined, size: 18),
                    label: Text('${clinic.straightLineDistanceKm} км'),
                    visualDensity: VisualDensity.compact,
                  ),
                for (final capability in clinic.matchingCapabilities.take(3))
                  Chip(
                    label: Text(_capabilityLabel(capability)),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text('Актуально до: ${_dateTime(context, clinic.validUntil)}',
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: phone == null
                        ? null
                        : () => _callClinic(context, phone),
                    icon: const Icon(Icons.phone_outlined),
                    label: Text(phone ?? 'Телефон не указан'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  tooltip: 'Маршрут',
                  onPressed: routeUri == null
                      ? null
                      : () => _openRoute(context, routeUri, clinic.address),
                  icon: const Icon(Icons.route_outlined),
                ),
              ],
            ),
            if (triageDecision != null) ...[
              const SizedBox(height: 10),
              const Divider(height: 1),
              const SizedBox(height: 10),
              _EmergencyFollowUpAction(
                repository: repository,
                clinicLocationId: clinic.clinicLocationId,
                triageSessionId: triageDecision!.sessionId,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _callClinic(BuildContext context, String phone) async {
    final messenger = ScaffoldMessenger.of(context);
    final uri = Uri(scheme: 'tel', path: phone);
    var launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!launched) {
      await Clipboard.setData(ClipboardData(text: phone));
      messenger.showSnackBar(
        const SnackBar(content: Text('Телефон клиники скопирован.')),
      );
    }
    await _recordRouteAction('CALL_STARTED');
  }

  Future<void> _openRoute(
      BuildContext context, Uri routeUri, String address) async {
    final messenger = ScaffoldMessenger.of(context);
    var launched = false;
    try {
      launched =
          await launchUrl(routeUri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!launched) {
      await Clipboard.setData(ClipboardData(text: address));
      messenger.showSnackBar(
        const SnackBar(
            content:
                Text('Не удалось открыть карты. Адрес клиники скопирован.')),
      );
    }
    await _recordRouteAction('ROUTE_OPENED');
  }

  Future<void> _recordRouteAction(String action) async {
    try {
      await repository.recordRouteAction(
        clinicLocationId: clinic.clinicLocationId,
        action: action,
        triageSessionId: triageDecision?.sessionId,
      );
    } catch (_) {
      // Emergency routing must stay usable even if analytics/follow-up logging is unavailable.
    }
  }
}

class _CupertinoEmergencyClinicCard extends StatelessWidget {
  const _CupertinoEmergencyClinicCard({
    required this.clinic,
    required this.repository,
    required this.triageDecision,
  });

  final EmergencyClinic clinic;
  final EmergencyRepository repository;
  final EmergencyTriageDecision? triageDecision;

  @override
  Widget build(BuildContext context) {
    final phone = clinic.emergencyContactPhone;
    final routeUri = _routeUri(clinic);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.secondarySystemGroupedBackground,
          context,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color:
              CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(CupertinoIcons.building_2_fill, size: 30),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        clinic.clinicName,
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .navTitleTextStyle,
                      ),
                      const SizedBox(height: 4),
                      Text(clinic.address),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                const _CupertinoBadge(
                  icon: CupertinoIcons.check_mark_circled,
                  label: 'Проверено',
                ),
                if (clinic.straightLineDistanceKm != null)
                  _CupertinoBadge(
                    icon: CupertinoIcons.location,
                    label: '${clinic.straightLineDistanceKm} км',
                  ),
                for (final capability in clinic.matchingCapabilities.take(3))
                  _CupertinoBadge(
                    icon: CupertinoIcons.plus_circle,
                    label: _safeCapabilityLabel(capability),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Актуально до: ${_cupertinoDateTime(clinic.validUntil)}',
              style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                    color: CupertinoDynamicColor.resolve(
                      CupertinoColors.secondaryLabel,
                      context,
                    ),
                    fontSize: 13,
                  ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: CupertinoButton(
                    minSize: 52,
                    color: CupertinoColors.activeBlue,
                    borderRadius: BorderRadius.circular(14),
                    onPressed: phone == null
                        ? null
                        : () => _callClinic(context, phone),
                    child: Text(phone ?? 'Телефон не указан'),
                  ),
                ),
                const SizedBox(width: 8),
                CupertinoButton(
                  minSize: 52,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  color: CupertinoDynamicColor.resolve(
                    CupertinoColors.tertiarySystemFill,
                    context,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  onPressed: routeUri == null
                      ? null
                      : () => _openRoute(context, routeUri, clinic.address),
                  child: const Icon(CupertinoIcons.location),
                ),
              ],
            ),
            if (triageDecision != null) ...[
              const SizedBox(height: 12),
              _CupertinoHairline(),
              const SizedBox(height: 12),
              _CupertinoEmergencyFollowUpAction(
                repository: repository,
                clinicLocationId: clinic.clinicLocationId,
                triageSessionId: triageDecision!.sessionId,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _callClinic(BuildContext context, String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    var launched = false;
    try {
      launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!launched) {
      await Clipboard.setData(ClipboardData(text: phone));
      if (context.mounted) {
        _showCupertinoEmergencyMessage(
          context,
          'Телефон клиники скопирован.',
        );
      }
    }
    await _recordRouteAction('CALL_STARTED');
  }

  Future<void> _openRoute(
    BuildContext context,
    Uri routeUri,
    String address,
  ) async {
    var launched = false;
    try {
      launched =
          await launchUrl(routeUri, mode: LaunchMode.externalApplication);
    } catch (_) {
      launched = false;
    }
    if (!launched) {
      await Clipboard.setData(ClipboardData(text: address));
      if (context.mounted) {
        _showCupertinoEmergencyMessage(
          context,
          'Не удалось открыть карты. Адрес клиники скопирован.',
        );
      }
    }
    await _recordRouteAction('ROUTE_OPENED');
  }

  Future<void> _recordRouteAction(String action) async {
    try {
      await repository.recordRouteAction(
        clinicLocationId: clinic.clinicLocationId,
        action: action,
        triageSessionId: triageDecision?.sessionId,
      );
    } catch (_) {
      // Emergency routing must stay usable even if analytics/follow-up logging is unavailable.
    }
  }
}

class _CupertinoBadge extends StatelessWidget {
  const _CupertinoBadge({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.tertiarySystemFill,
          context,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16),
            const SizedBox(width: 5),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _EmergencyFollowUpAction extends StatefulWidget {
  const _EmergencyFollowUpAction({
    required this.repository,
    required this.clinicLocationId,
    required this.triageSessionId,
  });

  final EmergencyRepository repository;
  final String clinicLocationId;
  final String triageSessionId;

  @override
  State<_EmergencyFollowUpAction> createState() =>
      _EmergencyFollowUpActionState();
}

class _EmergencyFollowUpActionState extends State<_EmergencyFollowUpAction> {
  bool _loading = false;
  DateTime? _dueAt;

  Future<void> _requestFollowUp() async {
    if (_loading || _dueAt != null) return;
    setState(() {
      _loading = true;
    });
    try {
      final result = await widget.repository.recordRouteAction(
        clinicLocationId: widget.clinicLocationId,
        triageSessionId: widget.triageSessionId,
        action: 'FOLLOW_UP_REQUESTED',
      );
      if (!mounted) return;
      setState(() {
        _dueAt = result.followUpDueAt ?? result.createdAt;
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось сохранить контроль.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (_dueAt != null) {
      return Row(
        children: [
          Icon(Icons.task_alt_outlined, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Контроль сохранён: ${_dateTime(context, _dueAt!)}',
              style: theme.textTheme.bodyMedium,
            ),
          ),
        ],
      );
    }
    return Row(
      children: [
        Expanded(
          child: Text(
            'После звонка можно сохранить контроль состояния питомца.',
            style: theme.textTheme.bodyMedium,
          ),
        ),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: _loading ? null : _requestFollowUp,
          icon: _loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.event_available_outlined),
          label: const Text('Контроль'),
        ),
      ],
    );
  }
}

class _CupertinoEmergencyFollowUpAction extends StatefulWidget {
  const _CupertinoEmergencyFollowUpAction({
    required this.repository,
    required this.clinicLocationId,
    required this.triageSessionId,
  });

  final EmergencyRepository repository;
  final String clinicLocationId;
  final String triageSessionId;

  @override
  State<_CupertinoEmergencyFollowUpAction> createState() =>
      _CupertinoEmergencyFollowUpActionState();
}

class _CupertinoEmergencyFollowUpActionState
    extends State<_CupertinoEmergencyFollowUpAction> {
  bool _loading = false;
  DateTime? _dueAt;

  Future<void> _requestFollowUp() async {
    if (_loading || _dueAt != null) return;
    setState(() {
      _loading = true;
    });
    try {
      final result = await widget.repository.recordRouteAction(
        clinicLocationId: widget.clinicLocationId,
        triageSessionId: widget.triageSessionId,
        action: 'FOLLOW_UP_REQUESTED',
      );
      if (!mounted) return;
      setState(() {
        _dueAt = result.followUpDueAt ?? result.createdAt;
      });
    } catch (_) {
      if (!mounted) return;
      _showCupertinoEmergencyMessage(
        context,
        'Не удалось сохранить контроль. Срочные клиники остаются доступны.',
      );
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_dueAt != null) {
      return Row(
        children: [
          const Icon(CupertinoIcons.check_mark_circled_solid),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Контроль сохранён: ${_cupertinoDateTime(_dueAt!)}'),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('После звонка можно сохранить контроль состояния питомца.'),
        const SizedBox(height: 8),
        CupertinoButton(
          minSize: 44,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.tertiarySystemFill,
            context,
          ),
          borderRadius: BorderRadius.circular(14),
          onPressed: _loading ? null : _requestFollowUp,
          child: _loading
              ? const CupertinoActivityIndicator()
              : const Text('Сохранить контроль'),
        ),
      ],
    );
  }
}

class _EmergencyError extends StatelessWidget {
  const _EmergencyError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_outlined,
                  size: 48, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 12),
              Text('Не удалось обновить срочные клиники',
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center),
              const SizedBox(height: 8),
              const Text(
                'Если состояние тяжёлое, звоните в ближайшую круглосуточную клинику напрямую.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Повторить'),
              ),
            ],
          ),
        ),
      );
}

class _CupertinoEmergencyError extends StatelessWidget {
  const _CupertinoEmergencyError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              CupertinoIcons.cloud,
              size: 44,
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.systemRed,
                context,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Не удалось обновить срочные клиники',
              style: CupertinoTheme.of(context)
                  .textTheme
                  .navTitleTextStyle
                  .copyWith(fontSize: 19),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Если состояние тяжёлое, звоните в ближайшую круглосуточную клинику напрямую.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            CupertinoButton.filled(
              minSize: 44,
              onPressed: onRetry,
              child: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencyEmpty extends StatelessWidget {
  const _EmergencyEmpty();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'По выбранным условиям проверенных срочных клиник не найдено. При тяжёлом состоянии звоните в ближайшую круглосуточную клинику напрямую.',
            textAlign: TextAlign.center,
          ),
        ),
      );
}

class _CupertinoEmergencyEmpty extends StatelessWidget {
  const _CupertinoEmergencyEmpty();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'По выбранным условиям проверенных срочных клиник не найдено. При тяжёлом состоянии звоните в ближайшую круглосуточную клинику напрямую.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

String _capabilityLabel(String code) => switch (code) {
      'OXYGEN_SUPPORT' => 'Кислород',
      'TRAUMA' => 'Травма',
      'TOXICOLOGY' => 'Отравление',
      'EMERGENCY_SURGERY' => 'Операционная',
      'INPATIENT_CARE' => 'Стационар',
      _ => code,
    };

String _safeCapabilityLabel(String code) {
  final label = _capabilityLabel(code);
  if (label == code) return 'Другая помощь';
  return label;
}

_TriageVisual _triageVisual(String outcome, ColorScheme colors) {
  return switch (outcome) {
    'EMERGENCY' => _TriageVisual(
        'Срочная помощь',
        Icons.warning_amber_rounded,
        colors.error,
        colors.errorContainer,
      ),
    'SAME_DAY_CLINIC' => _TriageVisual(
        'Лучше очно сегодня',
        Icons.today_outlined,
        colors.onSecondaryContainer,
        colors.secondaryContainer,
      ),
    'TELEMED_ELIGIBLE' => _TriageVisual(
        'Можно начать онлайн',
        Icons.video_call_outlined,
        colors.primary,
        colors.primaryContainer,
      ),
    'PLANNED_VISIT' => _TriageVisual(
        'Плановая помощь',
        Icons.event_available_outlined,
        colors.primary,
        colors.primaryContainer,
      ),
    _ => _TriageVisual(
        'Нужны уточнения',
        Icons.info_outline,
        colors.onSurfaceVariant,
        colors.surfaceContainerHighest,
      ),
  };
}

_CupertinoEmergencyVisual _cupertinoTriageVisual(
  BuildContext context,
  String outcome,
) {
  final red = CupertinoDynamicColor.resolve(CupertinoColors.systemRed, context);
  final blue =
      CupertinoDynamicColor.resolve(CupertinoColors.activeBlue, context);
  final orange =
      CupertinoDynamicColor.resolve(CupertinoColors.systemOrange, context);
  final secondary = CupertinoDynamicColor.resolve(
    CupertinoColors.secondaryLabel,
    context,
  );
  return switch (outcome) {
    'EMERGENCY' => _CupertinoEmergencyVisual(
        title: 'Срочная помощь',
        icon: CupertinoIcons.exclamationmark_triangle_fill,
        foreground: red,
        background: CupertinoColors.systemRed.withValues(alpha: 0.16),
        border: red,
      ),
    'SAME_DAY_CLINIC' => _CupertinoEmergencyVisual(
        title: 'Лучше очно сегодня',
        icon: CupertinoIcons.calendar,
        foreground: orange,
        background: CupertinoColors.systemOrange.withValues(alpha: 0.14),
        border: orange,
      ),
    'TELEMED_ELIGIBLE' => _CupertinoEmergencyVisual(
        title: 'Можно начать онлайн',
        icon: CupertinoIcons.videocam,
        foreground: blue,
        background: CupertinoColors.activeBlue.withValues(alpha: 0.12),
        border: blue,
      ),
    'PLANNED_VISIT' => _CupertinoEmergencyVisual(
        title: 'Плановая помощь',
        icon: CupertinoIcons.calendar_badge_plus,
        foreground: blue,
        background: CupertinoColors.activeBlue.withValues(alpha: 0.12),
        border: blue,
      ),
    _ => _CupertinoEmergencyVisual(
        title: 'Нужны уточнения',
        icon: CupertinoIcons.info_circle,
        foreground: secondary,
        background: CupertinoColors.tertiarySystemFill,
        border:
            CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
      ),
  };
}

class _TriageVisual {
  const _TriageVisual(
    this.title,
    this.icon,
    this.foreground,
    this.background,
  );

  final String title;
  final IconData icon;
  final Color foreground;
  final Color background;
}

class _CupertinoEmergencyVisual {
  const _CupertinoEmergencyVisual({
    required this.title,
    required this.icon,
    required this.foreground,
    required this.background,
    required this.border,
  });

  final String title;
  final IconData icon;
  final Color foreground;
  final Color background;
  final Color border;
}

String _dateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(local);
  final time = TimeOfDay.fromDateTime(local).format(context);
  return '$date, $time';
}

String _cupertinoDateTime(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final year = local.year.toString();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day.$month.$year, $hour:$minute';
}

bool _isEmergencyRedFlag(String code) => const <String>{
      'BREATHING_DISTRESS',
      'COLLAPSE_OR_UNCONSCIOUS',
      'SEIZURE',
      'SEVERE_BLEEDING',
      'MAJOR_TRAUMA',
      'TOXIN_INGESTION',
      'BLOAT_OR_BLOCKED_URINATION',
    }.contains(code);

String _safeEmergencyText(String value) {
  final hasTechnicalToken =
      RegExp(r'\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b').hasMatch(value);
  final hasHttpStatus = RegExp(r'\b[45]\d\d\b').hasMatch(value);
  if (hasTechnicalToken || hasHttpStatus) {
    return 'Откройте срочные клиники или позвоните, если состояние тяжёлое.';
  }
  return value;
}

class _CupertinoHairline extends StatelessWidget {
  const _CupertinoHairline();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
      child: const SizedBox(height: 0.5, width: double.infinity),
    );
  }
}

void _showCupertinoEmergencyMessage(BuildContext context, String message) {
  showCupertinoDialog<void>(
    context: context,
    builder: (context) => CupertinoAlertDialog(
      title: const Text('VetHelp'),
      content: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(message),
      ),
      actions: [
        CupertinoDialogAction(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Понятно'),
        ),
      ],
    ),
  );
}

Uri? _routeUri(EmergencyClinic clinic) {
  final latitude = clinic.latitude;
  final longitude = clinic.longitude;
  if (latitude != null && longitude != null) {
    return Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': '$latitude,$longitude',
    });
  }
  final address = clinic.address.trim();
  if (address.isEmpty) return null;
  return Uri.https('www.google.com', '/maps/search/', {
    'api': '1',
    'query': address,
  });
}
