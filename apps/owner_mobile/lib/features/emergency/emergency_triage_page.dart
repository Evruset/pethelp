import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../presentation/platform/owner_platform.dart';
import 'emergency_page.dart';
import 'emergency_repository.dart';

const double _spaceSmall = 8;
const double _space = 16;
const double _spaceLarge = 24;

class EmergencyTriagePage extends StatefulWidget {
  const EmergencyTriagePage({
    super.key,
    required this.repository,
    this.platformOverride,
  });

  final EmergencyRepository repository;
  final TargetPlatform? platformOverride;

  @override
  State<EmergencyTriagePage> createState() => _EmergencyTriagePageState();
}

class _EmergencyTriagePageState extends State<EmergencyTriagePage> {
  String _species = 'DOG';
  final Set<String> _signals = <String>{};
  bool _acknowledged = false;
  bool _loading = false;
  bool _draftRestored = false;
  bool _showTriage = false;
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
    final usesCupertino = _usesCupertino(context);
    Navigator.of(context).pushReplacement(
      ownerPageRoute<void>(
        context: context,
        platform: usesCupertino ? TargetPlatform.iOS : widget.platformOverride,
        builder: (_) => EmergencyPage(
          repository: widget.repository,
          initialSpecies: _species,
          initialCapabilities: capabilities == null || capabilities.isEmpty
              ? const <String>['OXYGEN_SUPPORT']
              : capabilities,
          triageDecision: decision,
          platformOverride:
              usesCupertino ? TargetPlatform.iOS : widget.platformOverride,
        ),
      ),
    );
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
    if (_usesCupertino(context)) {
      return _buildCupertino(context);
    }
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
        middle: Text('Срочная помощь'),
      ),
      child: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            const _CupertinoEmergencyWarning(),
            const SizedBox(height: _space),
            _CupertinoPrimaryEmergencyAction(
              onPressed: _loading ? null : () => _openClinics(),
            ),
            const SizedBox(height: _spaceSmall),
            CupertinoButton(
              minSize: 44,
              padding: const EdgeInsets.symmetric(vertical: 10),
              onPressed: _loading
                  ? null
                  : () => setState(() {
                        _showTriage = true;
                      }),
              child: const Text('Уточнить, какая помощь нужна'),
            ),
            if (_draftMessage != null && !_showTriage) ...[
              const SizedBox(height: _spaceSmall),
              _CupertinoDraftStatusBanner(
                message: _draftMessage!,
                restored: _draftRestored,
                onClear: _loading ? null : _clearDraft,
              ),
            ],
            if (_showTriage) ...[
              const SizedBox(height: _spaceLarge),
              _CupertinoTriageForm(
                species: _species,
                signals: _signals,
                acknowledged: _acknowledged,
                loading: _loading,
                error: _error,
                draftMessage: _draftMessage,
                draftRestored: _draftRestored,
                onSpeciesChanged: (value) {
                  setState(() => _species = value);
                  _saveDraft();
                },
                onSignalsChanged: (next) {
                  setState(() {
                    _signals
                      ..clear()
                      ..addAll(next);
                  });
                  _saveDraft();
                },
                onAcknowledgedChanged: (value) {
                  setState(() => _acknowledged = value);
                  _saveDraft();
                },
                onSubmit: _submit,
                onOpenClinics: () => _openClinics(),
                onClearDraft: _clearDraft,
              ),
            ],
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

class _CupertinoEmergencyWarning extends StatelessWidget {
  const _CupertinoEmergencyWarning({this.redFlag = false});

  final bool redFlag;

  @override
  Widget build(BuildContext context) {
    final message = redFlag
        ? 'Не ждите онлайн-ответа. Откройте срочные клиники или позвоните.'
        : 'Если питомец задыхается, потерял сознание, идёт сильное кровотечение или были судороги, не ждите онлайн-ответа.';
    return Semantics(
      liveRegion: true,
      label: 'Важное предупреждение. $message',
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
            width: 1.2,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                CupertinoIcons.exclamationmark_triangle_fill,
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.systemRed,
                  context,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            fontWeight: FontWeight.w600,
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

class _CupertinoPrimaryEmergencyAction extends StatelessWidget {
  const _CupertinoPrimaryEmergencyAction({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Найти срочную клинику сейчас',
      child: CupertinoButton(
        minSize: 52,
        color: CupertinoColors.systemRed,
        borderRadius: BorderRadius.circular(16),
        onPressed: onPressed,
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(CupertinoIcons.location_fill, color: CupertinoColors.white),
            SizedBox(width: 8),
            Flexible(
              child: Text(
                'Найти срочную клинику сейчас',
                style: TextStyle(
                  color: CupertinoColors.white,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoTriageForm extends StatelessWidget {
  const _CupertinoTriageForm({
    required this.species,
    required this.signals,
    required this.acknowledged,
    required this.loading,
    required this.error,
    required this.draftMessage,
    required this.draftRestored,
    required this.onSpeciesChanged,
    required this.onSignalsChanged,
    required this.onAcknowledgedChanged,
    required this.onSubmit,
    required this.onOpenClinics,
    required this.onClearDraft,
  });

  final String species;
  final Set<String> signals;
  final bool acknowledged;
  final bool loading;
  final String? error;
  final String? draftMessage;
  final bool draftRestored;
  final ValueChanged<String> onSpeciesChanged;
  final ValueChanged<Set<String>> onSignalsChanged;
  final ValueChanged<bool> onAcknowledgedChanged;
  final VoidCallback onSubmit;
  final VoidCallback onOpenClinics;
  final VoidCallback onClearDraft;

  @override
  Widget build(BuildContext context) {
    final hasRedFlag = signals.any(_isRedFlagSignal);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Уточнить помощь',
          style: CupertinoTheme.of(context)
              .textTheme
              .navTitleTextStyle
              .copyWith(fontSize: 22),
        ),
        const SizedBox(height: _spaceSmall),
        Text(
          'Ответы помогут подобрать профиль клиники. Это не диагноз.',
          style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.secondaryLabel,
                  context,
                ),
              ),
        ),
        if (hasRedFlag) ...[
          const SizedBox(height: _space),
          const _CupertinoEmergencyWarning(redFlag: true),
        ],
        const SizedBox(height: _space),
        _CupertinoGroupedPanel(
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
              if (loading || value == null) return;
              onSpeciesChanged(value);
            },
          ),
        ),
        const SizedBox(height: _space),
        _CupertinoGroupedPanel(
          title: 'Что происходит сейчас',
          child: _CupertinoSignalList(
            selected: signals,
            enabled: !loading,
            onChanged: onSignalsChanged,
          ),
        ),
        const SizedBox(height: _space),
        _CupertinoDisclaimerRow(
          acknowledged: acknowledged,
          enabled: !loading,
          onChanged: onAcknowledgedChanged,
        ),
        if (error != null) ...[
          const SizedBox(height: _spaceSmall),
          _CupertinoTriageError(message: error!),
        ],
        if (draftMessage != null) ...[
          const SizedBox(height: _spaceSmall),
          _CupertinoDraftStatusBanner(
            message: draftMessage!,
            restored: draftRestored,
            onClear: loading ? null : onClearDraft,
          ),
        ],
        const SizedBox(height: _space),
        CupertinoButton(
          minSize: 52,
          color: acknowledged
              ? CupertinoColors.activeBlue
              : CupertinoDynamicColor.resolve(
                  CupertinoColors.tertiarySystemFill,
                  context,
                ),
          borderRadius: BorderRadius.circular(16),
          onPressed: acknowledged && !loading ? onSubmit : null,
          child: loading
              ? const CupertinoActivityIndicator(color: CupertinoColors.white)
              : Text(
                  acknowledged
                      ? 'Проверить симптомы'
                      : 'Подтвердите дисклеймер',
                  style: TextStyle(
                    color: acknowledged
                        ? CupertinoColors.white
                        : CupertinoDynamicColor.resolve(
                            CupertinoColors.secondaryLabel,
                            context,
                          ),
                  ),
                ),
        ),
        const SizedBox(height: _spaceSmall),
        _CupertinoPrimaryEmergencyAction(
          onPressed: loading ? null : onOpenClinics,
        ),
      ],
    );
  }
}

class _CupertinoGroupedPanel extends StatelessWidget {
  const _CupertinoGroupedPanel({
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
        padding: const EdgeInsets.all(16),
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
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _CupertinoSignalList extends StatelessWidget {
  const _CupertinoSignalList({
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final Set<String> selected;
  final bool enabled;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var index = 0; index < _signals.length; index++) ...[
          if (index > 0)
            Padding(
              padding: const EdgeInsets.only(left: 34),
              child: ColoredBox(
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.separator,
                  context,
                ),
                child: const SizedBox(height: 0.5, width: double.infinity),
              ),
            ),
          _CupertinoSignalRow(
            signal: _signals[index],
            selected: selected.contains(_signals[index].code),
            enabled: enabled,
            onChanged: (value) {
              final next = Set<String>.from(selected);
              if (value) {
                next.add(_signals[index].code);
              } else {
                next.remove(_signals[index].code);
              }
              onChanged(next);
            },
          ),
        ],
      ],
    );
  }
}

class _CupertinoSignalRow extends StatelessWidget {
  const _CupertinoSignalRow({
    required this.signal,
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final _SignalOption signal;
  final bool selected;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      toggled: selected,
      enabled: enabled,
      label: signal.label,
      child: CupertinoButton(
        minSize: 44,
        padding: const EdgeInsets.symmetric(vertical: 10),
        onPressed: enabled ? () => onChanged(!selected) : null,
        child: Row(
          children: [
            Icon(
              _cupertinoSignalIcon(signal.code),
              size: 22,
              color: CupertinoDynamicColor.resolve(
                _isRedFlagSignal(signal.code)
                    ? CupertinoColors.systemRed
                    : CupertinoColors.activeBlue,
                context,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                signal.label,
                style: CupertinoTheme.of(context).textTheme.textStyle,
              ),
            ),
            Icon(
              selected
                  ? CupertinoIcons.check_mark_circled_solid
                  : CupertinoIcons.circle,
              color: selected
                  ? CupertinoColors.activeBlue
                  : CupertinoDynamicColor.resolve(
                      CupertinoColors.tertiaryLabel,
                      context,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoDisclaimerRow extends StatelessWidget {
  const _CupertinoDisclaimerRow({
    required this.acknowledged,
    required this.enabled,
    required this.onChanged,
  });

  final bool acknowledged;
  final bool enabled;
  final ValueChanged<bool> onChanged;

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
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CupertinoSwitch(
              value: acknowledged,
              onChanged: enabled ? onChanged : null,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Понимаю: это не диагноз. При тяжёлом состоянии нужно звонить в клинику сразу.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoTriageError extends StatelessWidget {
  const _CupertinoTriageError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Text(
        _safeEmergencyMessage(message),
        style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.systemRed,
                context,
              ),
            ),
      ),
    );
  }
}

class _CupertinoDraftStatusBanner extends StatelessWidget {
  const _CupertinoDraftStatusBanner({
    required this.message,
    required this.restored,
    required this.onClear,
  });

  final String message;
  final bool restored;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.tertiarySystemFill,
          context,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(CupertinoIcons.doc_text),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                restored ? '$message. Это не медицинское заключение.' : message,
                style: CupertinoTheme.of(context).textTheme.textStyle,
              ),
            ),
            CupertinoButton(
              minSize: 44,
              padding: EdgeInsets.zero,
              onPressed: onClear,
              child: const Icon(CupertinoIcons.xmark_circle),
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

bool _isRedFlagSignal(String code) => const <String>{
      'BREATHING_DISTRESS',
      'COLLAPSE_OR_UNCONSCIOUS',
      'SEIZURE',
      'SEVERE_BLEEDING',
      'MAJOR_TRAUMA',
      'TOXIN_INGESTION',
      'BLOAT_OR_BLOCKED_URINATION',
    }.contains(code);

IconData _cupertinoSignalIcon(String code) => switch (code) {
      'BREATHING_DISTRESS' => CupertinoIcons.wind,
      'COLLAPSE_OR_UNCONSCIOUS' => CupertinoIcons.exclamationmark_triangle_fill,
      'SEIZURE' => CupertinoIcons.bolt,
      'SEVERE_BLEEDING' => CupertinoIcons.drop,
      'MAJOR_TRAUMA' => CupertinoIcons.bandage,
      'TOXIN_INGESTION' => CupertinoIcons.lab_flask,
      'BLOAT_OR_BLOCKED_URINATION' => CupertinoIcons.exclamationmark_circle,
      'PERSISTENT_VOMITING_DIARRHEA' => CupertinoIcons.drop_triangle,
      'PAIN_OR_LAMENESS' => CupertinoIcons.bandage,
      'SKIN_EAR_EYE' => CupertinoIcons.eye,
      'ROUTINE_QUESTION' => CupertinoIcons.calendar,
      _ => CupertinoIcons.question_circle,
    };

String _safeEmergencyMessage(String message) {
  final hasTechnicalToken =
      RegExp(r'\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b').hasMatch(message);
  final hasHttpStatus = RegExp(r'\b[45]\d\d\b').hasMatch(message);
  if (hasTechnicalToken || hasHttpStatus) {
    return 'Не удалось проверить симптомы. Можно открыть список срочных клиник сразу.';
  }
  return message;
}
