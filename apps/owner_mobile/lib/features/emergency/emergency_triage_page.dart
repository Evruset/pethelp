import 'package:flutter/material.dart';

import 'emergency_page.dart';
import 'emergency_repository.dart';

const double _spaceSmall = 8;
const double _space = 16;
const double _spaceLarge = 24;

class EmergencyTriagePage extends StatefulWidget {
  const EmergencyTriagePage({super.key, required this.repository});

  final EmergencyRepository repository;

  @override
  State<EmergencyTriagePage> createState() => _EmergencyTriagePageState();
}

class _EmergencyTriagePageState extends State<EmergencyTriagePage> {
  String _species = 'DOG';
  final Set<String> _signals = <String>{};
  bool _acknowledged = false;
  bool _loading = false;
  bool _draftRestored = false;
  String? _error;
  String? _draftMessage;

  @override
  void initState() {
    super.initState();
    _restoreDraft();
  }

  Future<void> _restoreDraft() async {
    final draft = await widget.repository.readTriageDraft();
    if (!mounted || draft == null || draft.isEmpty) return;
    setState(() {
      _species = draft.species;
      _signals
        ..clear()
        ..addAll(draft.signalCodes);
      _acknowledged = draft.disclaimerAccepted;
      _draftRestored = true;
      _draftMessage = 'Черновик восстановлен';
    });
  }

  Future<void> _submit() async {
    if (!_acknowledged || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final decision = await widget.repository.assessTriage(
        species: _species,
        signalCodes: _signals.toList(growable: false),
        disclaimerAccepted: _acknowledged,
      );
      if (!mounted) return;
      await widget.repository.clearTriageDraft();
      if (!mounted) return;
      _openClinics(decision: decision);
    } on EmergencyApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _messageFor(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Не удалось проверить симптомы. Можно открыть список срочных клиник сразу.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _openClinics({EmergencyTriageDecision? decision}) {
    final capabilities = decision?.requiredCapabilities;
    Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
      builder: (_) => EmergencyPage(
        repository: widget.repository,
        initialSpecies: _species,
        initialCapabilities: capabilities == null || capabilities.isEmpty
            ? const <String>['OXYGEN_SUPPORT']
            : capabilities,
        triageDecision: decision,
      ),
    ));
  }

  Future<void> _saveDraft() async {
    await widget.repository.saveTriageDraft(
      species: _species,
      signalCodes: _signals.toList(growable: false),
      disclaimerAccepted: _acknowledged,
    );
    if (!mounted) return;
    setState(() {
      _draftMessage = 'Черновик сохранён на устройстве';
    });
  }

  Future<void> _clearDraft() async {
    await widget.repository.clearTriageDraft();
    if (!mounted) return;
    setState(() {
      _draftRestored = false;
      _draftMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Срочная помощь')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(_space),
          children: [
            _SafetyCard(theme: theme),
            const SizedBox(height: _space),
            Text('Питомец', style: theme.textTheme.titleMedium),
            const SizedBox(height: _spaceSmall),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'DOG',
                    icon: Icon(Icons.pets),
                    label: Text('Собака')),
                ButtonSegment(
                    value: 'CAT', icon: Icon(Icons.pets), label: Text('Кошка')),
                ButtonSegment(
                    value: 'OTHER',
                    icon: Icon(Icons.more_horiz),
                    label: Text('Другой')),
              ],
              selected: {_species},
              onSelectionChanged: _loading
                  ? null
                  : (value) {
                      setState(() {
                        _species = value.single;
                      });
                      _saveDraft();
                    },
            ),
            const SizedBox(height: _spaceLarge),
            Text('Что происходит сейчас', style: theme.textTheme.titleMedium),
            const SizedBox(height: _spaceSmall),
            _SignalGrid(
              selected: _signals,
              enabled: !_loading,
              onChanged: (next) {
                setState(() {
                  _signals
                    ..clear()
                    ..addAll(next);
                });
                _saveDraft();
              },
            ),
            const SizedBox(height: _space),
            CheckboxListTile(
              value: _acknowledged,
              onChanged: _loading
                  ? null
                  : (value) {
                      setState(() {
                        _acknowledged = value == true;
                      });
                      _saveDraft();
                    },
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: const Text(
                  'Понимаю: это не диагноз. При тяжёлом состоянии нужно звонить в клинику сразу.'),
            ),
            if (_error != null) ...[
              const SizedBox(height: _spaceSmall),
              Text(_error!,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.error)),
            ],
            if (_draftMessage != null) ...[
              const SizedBox(height: _spaceSmall),
              _DraftStatusBanner(
                message: _draftMessage!,
                restored: _draftRestored,
                onClear: _loading ? null : _clearDraft,
              ),
            ],
            const SizedBox(height: _space),
            FilledButton.icon(
              onPressed: _acknowledged && !_loading ? _submit : null,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.health_and_safety_outlined),
              label: Text(_loading ? 'Проверяем' : 'Проверить симптомы'),
            ),
            const SizedBox(height: _spaceSmall),
            TextButton.icon(
              onPressed: _loading ? null : () => _openClinics(),
              icon: const Icon(Icons.local_hospital_outlined),
              label: const Text('Показать срочные клиники сразу'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SafetyCard extends StatelessWidget {
  const _SafetyCard({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: theme.colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(_space),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.warning_amber_rounded, color: theme.colorScheme.error),
            const SizedBox(width: _spaceSmall),
            const Expanded(
              child: Text(
                  'Если питомец задыхается, потерял сознание, идёт сильное кровотечение или были судороги, не ждите: звоните в срочную клинику.'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignalGrid extends StatelessWidget {
  const _SignalGrid({
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final Set<String> selected;
  final bool enabled;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: _spaceSmall,
      runSpacing: _spaceSmall,
      children: _signalChips(),
    );
  }

  List<Widget> _signalChips() {
    final chips = <Widget>[];
    for (final signal in _signals) {
      chips.add(FilterChip(
        avatar: Icon(signal.icon, size: 18),
        label: Text(signal.label),
        selected: selected.contains(signal.code),
        onSelected: enabled
            ? (value) {
                final next = Set<String>.from(selected);
                if (value) {
                  next.add(signal.code);
                } else {
                  next.remove(signal.code);
                }
                onChanged(next);
              }
            : null,
      ));
    }
    return chips;
  }
}

class _DraftStatusBanner extends StatelessWidget {
  const _DraftStatusBanner({
    required this.message,
    required this.restored,
    required this.onClear,
  });

  final String message;
  final bool restored;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Card(
      color: colors.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(_spaceSmall),
        child: Row(
          children: [
            Icon(Icons.edit_note_outlined, color: colors.onSurfaceVariant),
            const SizedBox(width: _spaceSmall),
            Expanded(
              child: Text(
                restored ? '$message. Это не медицинское заключение.' : message,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: colors.onSurfaceVariant),
              ),
            ),
            IconButton(
              tooltip: 'Очистить черновик',
              onPressed: onClear,
              icon: const Icon(Icons.close),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignalOption {
  const _SignalOption(this.code, this.label, this.icon);

  final String code;
  final String label;
  final IconData icon;
}

const List<_SignalOption> _signals = [
  _SignalOption('BREATHING_DISTRESS', 'Тяжёлое дыхание', Icons.air_outlined),
  _SignalOption('COLLAPSE_OR_UNCONSCIOUS', 'Потеря сознания',
      Icons.warning_amber_rounded),
  _SignalOption('SEIZURE', 'Судороги', Icons.flash_on_outlined),
  _SignalOption(
      'SEVERE_BLEEDING', 'Сильное кровотечение', Icons.bloodtype_outlined),
  _SignalOption('MAJOR_TRAUMA', 'Травма', Icons.personal_injury_outlined),
  _SignalOption(
      'TOXIN_INGESTION', 'Возможное отравление', Icons.science_outlined),
  _SignalOption('BLOAT_OR_BLOCKED_URINATION', 'Вздутие или не мочится',
      Icons.emergency_outlined),
  _SignalOption(
      'PERSISTENT_VOMITING_DIARRHEA', 'Рвота или диарея', Icons.sick_outlined),
  _SignalOption('PAIN_OR_LAMENESS', 'Боль или хромота', Icons.healing_outlined),
  _SignalOption(
      'SKIN_EAR_EYE', 'Кожа, уши или глаза', Icons.visibility_outlined),
  _SignalOption(
      'ROUTINE_QUESTION', 'Плановый вопрос', Icons.event_note_outlined),
];

String _messageFor(String code) {
  return switch (code) {
    'TRIAGE_DISCLAIMER_REQUIRED' =>
      'Подтвердите, что понимаете ограничение проверки.',
    'TRIAGE_RULE_SET_MISSING' =>
      'Проверка временно недоступна. Можно открыть список срочных клиник сразу.',
    _ =>
      'Не удалось проверить симптомы. Можно открыть список срочных клиник сразу.',
  };
}
