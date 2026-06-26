import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'emergency_repository.dart';

class EmergencyPage extends StatefulWidget {
  const EmergencyPage({super.key, required this.repository});

  final EmergencyRepository repository;

  @override
  State<EmergencyPage> createState() => _EmergencyPageState();
}

class _EmergencyPageState extends State<EmergencyPage> {
  String _species = 'DOG';
  final Set<String> _capabilities = <String>{'OXYGEN_SUPPORT'};
  Future<List<EmergencyClinic>>? _request;

  @override
  void initState() {
    super.initState();
    _search();
  }

  void _search() {
    setState(() {
      _request = widget.repository.search(EmergencyClinicFilters(
        species: _species,
        requiredCapabilities: _capabilities.toList(growable: false),
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
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
              child: FutureBuilder<List<EmergencyClinic>>(
                future: _request,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return _EmergencyError(onRetry: _search);
                  }
                  final clinics = snapshot.data ?? const <EmergencyClinic>[];
                  if (clinics.isEmpty) {
                    return const _EmergencyEmpty();
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: clinics.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) =>
                        _EmergencyClinicCard(clinic: clinics[index]),
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

class _EmergencyClinicCard extends StatelessWidget {
  const _EmergencyClinicCard({required this.clinic});

  final EmergencyClinic clinic;

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

String _capabilityLabel(String code) => switch (code) {
      'OXYGEN_SUPPORT' => 'Кислород',
      'TRAUMA' => 'Травма',
      'TOXICOLOGY' => 'Отравление',
      'EMERGENCY_SURGERY' => 'Операционная',
      'INPATIENT_CARE' => 'Стационар',
      _ => code,
    };

String _dateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(local);
  final time = TimeOfDay.fromDateTime(local).format(context);
  return '$date, $time';
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
