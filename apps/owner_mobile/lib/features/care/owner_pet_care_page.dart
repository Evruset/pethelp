import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../pets/owner_pet.dart';
import 'owner_pet_care_repository.dart';

class OwnerPetCarePage extends StatefulWidget {
  const OwnerPetCarePage({
    super.key,
    required this.pet,
    required this.repository,
  });

  final OwnerPet pet;
  final OwnerPetCareRepository repository;

  @override
  State<OwnerPetCarePage> createState() => _OwnerPetCarePageState();
}

class _OwnerPetCarePageState extends State<OwnerPetCarePage> {
  Future<OwnerPetCareSummary>? _request;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _request = widget.repository.readSummary(widget.pet.id);
    });
  }

  Future<void> _refresh() async {
    _reload();
    await _request;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Медицинская карта')),
      body: FutureBuilder<OwnerPetCareSummary>(
        future: _request,
        builder: (context, snapshot) {
          final summary = snapshot.data;
          if (snapshot.connectionState != ConnectionState.done &&
              summary == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (summary == null) {
            return _CareLoadError(onRetry: _reload);
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                if (snapshot.hasError) const _StaleCareBanner(),
                _CareHeader(pet: summary.pet),
                const SizedBox(height: 12),
                _HealthProfileCard(pet: summary.pet),
                const SizedBox(height: 12),
                _DocumentsCard(documents: summary.documents),
                const SizedBox(height: 12),
                _VisitHistoryCard(visits: summary.visits),
                const SizedBox(height: 12),
                _TelemedHistoryCard(sessions: summary.telemedSessions),
                const SizedBox(height: 12),
                Text(
                  'Обновлено: ${_dateTime(context, summary.serverNow)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CareLoadError extends StatelessWidget {
  const _CareLoadError({required this.onRetry});

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
            Text(
              'Не удалось загрузить карту',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Проверьте подключение и повторите попытку.',
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
}

class _StaleCareBanner extends StatelessWidget {
  const _StaleCareBanner();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: const ListTile(
        leading: Icon(Icons.cloud_off_outlined),
        title: Text('Показаны последние полученные данные'),
        subtitle: Text('Потяните экран вниз, чтобы обновить карту.'),
      ),
    );
  }
}

class _CareHeader extends StatelessWidget {
  const _CareHeader({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: colors.surface,
              child: const Icon(Icons.pets_outlined),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(pet.name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(_petSubtitle(context, pet)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HealthProfileCard extends StatelessWidget {
  const _HealthProfileCard({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final rows = <_CareFact>[
      _CareFact(Icons.scale_outlined, 'Вес', pet.weightKg ?? 'Не указан'),
      _CareFact(Icons.monitor_heart_outlined, 'Стерилизация',
          _sterilized(pet.sterilized)),
      _CareFact(Icons.warning_amber_outlined, 'Аллергии',
          _listOrEmpty(pet.allergies)),
      _CareFact(Icons.medical_information_outlined, 'Хронические состояния',
          _listOrEmpty(pet.chronicConditions)),
      _CareFact(Icons.vaccines_outlined, 'Вакцинация',
          pet.vaccinationNotes ?? 'Нет заметок'),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Профиль здоровья',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const Divider(height: 16),
              itemBuilder: (context, index) => _CareFactRow(fact: rows[index]),
            ),
          ],
        ),
      ),
    );
  }
}

class _CareFact {
  const _CareFact(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;
}

class _CareFactRow extends StatelessWidget {
  const _CareFactRow({required this.fact});

  final _CareFact fact;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(fact.icon, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fact.label, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 2),
              Text(fact.value),
            ],
          ),
        ),
      ],
    );
  }
}

class _DocumentsCard extends StatelessWidget {
  const _DocumentsCard({required this.documents});

  final List<OwnerPetCareDocument> documents;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Документы и ссылки',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (documents.isEmpty)
              const Text(
                'Добавьте фото, вакцинацию или ссылки на полисы в профиле питомца.',
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: documents.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) =>
                    _DocumentTile(document: documents[index]),
              ),
          ],
        ),
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.document});

  final OwnerPetCareDocument document;

  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(document.value);
    final canOpen = uri != null && uri.hasScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        leading: Icon(_documentIcon(document.type)),
        title: Text(document.label),
        subtitle: Text(
          document.value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Icon(canOpen ? Icons.open_in_new : Icons.copy),
        onTap: () => _openOrCopy(context, document.value),
      ),
    );
  }
}

class _VisitHistoryCard extends StatelessWidget {
  const _VisitHistoryCard({required this.visits});

  final List<OwnerPetCareVisit> visits;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('История помощи',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (visits.isEmpty)
              const Text(
                  'Здесь появятся записи, консультации и визиты питомца.')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: visits.length,
                separatorBuilder: (_, __) => const Divider(height: 18),
                itemBuilder: (context, index) =>
                    _VisitTile(visit: visits[index]),
              ),
          ],
        ),
      ),
    );
  }
}

class _TelemedHistoryCard extends StatelessWidget {
  const _TelemedHistoryCard({required this.sessions});

  final List<OwnerPetCareTelemedSession> sessions;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Онлайн-консультации',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (sessions.isEmpty)
              const Text(
                  'Здесь появятся онлайн-консультации, связанные с питомцем.')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: sessions.length,
                separatorBuilder: (_, __) => const Divider(height: 18),
                itemBuilder: (context, index) =>
                    _TelemedTile(session: sessions[index]),
              ),
          ],
        ),
      ),
    );
  }
}

class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit});

  final OwnerPetCareVisit visit;

  @override
  Widget build(BuildContext context) {
    final service = visit.serviceName ?? 'Услуга не указана';
    final price = visit.priceAmount == null
        ? null
        : '${visit.priceAmount} ${visit.currency ?? ''}'.trim();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(_visitIcon(visit.presentation.tone)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(visit.presentation.label,
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(_range(context, visit.startsAt, visit.endsAt)),
              const SizedBox(height: 2),
              Text(visit.clinicName),
              Text(price == null ? service : '$service · $price',
                  style: Theme.of(context).textTheme.bodySmall),
              if (visit.clinicalSummary != null &&
                  visit.clinicalSummary!.trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text('Заключение врача',
                    style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 2),
                Text(visit.clinicalSummary!),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _TelemedTile extends StatelessWidget {
  const _TelemedTile({required this.session});

  final OwnerPetCareTelemedSession session;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(_telemedIcon(session.state)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_telemedLabel(session.state),
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(_range(context, session.startsAt, session.endsAt)),
              const SizedBox(height: 2),
              Text(session.clinicName),
              Text(session.serviceName ?? 'Онлайн-консультация',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

String _petSubtitle(BuildContext context, OwnerPet pet) {
  final parts = <String>[
    _species(pet.species),
    if (pet.breed != null) pet.breed!,
    if (pet.birthDate != null) _ageOrBirthDate(context, pet.birthDate!),
    if (pet.sex != null) _sex(pet.sex!),
  ];
  return parts.join(' · ');
}

String _ageOrBirthDate(BuildContext context, DateTime birthDate) {
  final date = MaterialLocalizations.of(context).formatMediumDate(birthDate);
  return 'рожд. $date';
}

String _species(String value) => switch (value.toUpperCase()) {
      'DOG' => 'Собака',
      'CAT' => 'Кошка',
      _ => 'Питомец',
    };

String _sex(String value) => switch (value.toUpperCase()) {
      'MALE' => 'самец',
      'FEMALE' => 'самка',
      _ => 'пол не указан',
    };

String _sterilized(bool? value) {
  return switch (value) {
    true => 'Да',
    false => 'Нет',
    null => 'Не указано',
  };
}

String _listOrEmpty(List<String> value) {
  return value.isEmpty ? 'Не указано' : value.join(', ');
}

IconData _documentIcon(String type) => switch (type) {
      'PHOTO' => Icons.image_outlined,
      'VACCINATION_NOTES' => Icons.vaccines_outlined,
      'INSURANCE_POLICY_LINK' => Icons.policy_outlined,
      _ => Icons.description_outlined,
    };

IconData _visitIcon(String tone) => switch (tone) {
      'success' => Icons.check_circle_outline,
      'warning' => Icons.schedule_outlined,
      'danger' => Icons.event_busy_outlined,
      _ => Icons.history_outlined,
    };

IconData _telemedIcon(String state) => switch (state) {
      'WAITING_FOR_DOCTOR' => Icons.schedule_outlined,
      'CONNECTED' => Icons.video_call_outlined,
      'COMPLETED' => Icons.check_circle_outline,
      'DOCTOR_TIMEOUT' => Icons.event_busy_outlined,
      _ => Icons.history_outlined,
    };

String _telemedLabel(String state) => switch (state) {
      'WAITING_FOR_DOCTOR' => 'Ожидание врача',
      'CONNECTED' => 'Врач подключился',
      'COMPLETED' => 'Консультация завершена',
      'DOCTOR_TIMEOUT' => 'Врач не подключился',
      'CANCELLED' => 'Консультация отменена',
      _ => 'Онлайн-консультация',
    };

String _range(BuildContext context, DateTime from, DateTime to) {
  final date = MaterialLocalizations.of(context).formatMediumDate(from);
  final start = TimeOfDay.fromDateTime(from).format(context);
  final end = TimeOfDay.fromDateTime(to).format(context);
  return '$date, $start-$end';
}

String _dateTime(BuildContext context, DateTime value) {
  final date = MaterialLocalizations.of(context).formatMediumDate(value);
  final time = TimeOfDay.fromDateTime(value).format(context);
  return '$date, $time';
}

Future<void> _openOrCopy(BuildContext context, String value) async {
  final uri = Uri.tryParse(value);
  if (uri != null && uri.hasScheme) {
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (opened) return;
    } catch (_) {
      // Fallback below keeps the document reference accessible.
    }
  }
  await Clipboard.setData(ClipboardData(text: value));
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ссылка скопирована.')),
    );
  }
}
