import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';

import '../pets/owner_pet.dart';
import 'coverage_check_repository.dart';

class CoverageCheckPage extends StatefulWidget {
  const CoverageCheckPage({
    super.key,
    required this.pet,
    required this.repository,
  });

  final OwnerPet pet;
  final CoverageCheckRepository repository;

  @override
  State<CoverageCheckPage> createState() => _CoverageCheckPageState();
}

class _CoverageCheckPageState extends State<CoverageCheckPage> {
  static const _consentVersion = 'owner-mobile-v1';
  static const _policyConsentVersion = 'owner-mobile-policy-v1';
  final _formKey = GlobalKey<FormState>();
  final _uuid = const Uuid();

  CoverageCheckSubmitState _submitState = CoverageCheckSubmitState.idle;
  CoverageCheckView? _check;
  Future<List<InsuranceProfileView>>? _profilesRequest;
  String _partnerCode = 'VETHELP_INSURANCE_PILOT';
  bool _consentAccepted = false;
  String? _error;

  bool get _canSubmit =>
      _check == null &&
      _submitState != CoverageCheckSubmitState.loading &&
      _consentAccepted;

  @override
  void initState() {
    super.initState();
    _reloadProfiles();
  }

  void _reloadProfiles() {
    setState(() {
      _profilesRequest = widget.repository.listProfiles();
    });
  }

  Future<void> _addProfile() async {
    final profile = await showModalBottomSheet<InsuranceProfileView>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _InsuranceProfileForm(
        petId: widget.pet.id,
        consentVersion: _policyConsentVersion,
        onSubmit: widget.repository.createProfile,
      ),
    );
    if (profile == null || !mounted) return;
    _reloadProfiles();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Полис добавлен к профилю питомца.')),
    );
  }

  Future<void> _submit() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate() || !_canSubmit) return;
    setState(() {
      _submitState = CoverageCheckSubmitState.loading;
      _error = null;
    });
    try {
      final result = await widget.repository.create(
        petId: widget.pet.id,
        partnerCode: _partnerCode,
        consentVersion: _consentVersion,
        correlationId: _uuid.v4(),
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() {
        _check = result;
        _submitState = CoverageCheckSubmitState.success;
      });
    } on CoverageCheckApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitState = CoverageCheckSubmitState.failure;
        _error = _messageFor(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitState = CoverageCheckSubmitState.failure;
        _error =
            'Не удалось отправить проверку. Проверьте соединение и повторите попытку.';
      });
    }
  }

  Future<void> _refresh() async {
    final check = _check;
    if (check == null || _submitState == CoverageCheckSubmitState.loading) {
      return;
    }
    setState(() {
      _submitState = CoverageCheckSubmitState.loading;
      _error = null;
    });
    try {
      final result = await widget.repository.read(check.id);
      if (!mounted) return;
      setState(() {
        _check = result;
        _submitState = CoverageCheckSubmitState.success;
      });
    } on CoverageCheckApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitState = CoverageCheckSubmitState.failure;
        _error = _messageFor(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitState = CoverageCheckSubmitState.failure;
        _error =
            'Не удалось обновить проверку. Проверьте соединение и повторите попытку.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final check = _check;
    return Scaffold(
      appBar: AppBar(title: const Text('Страховое покрытие')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _PetHeader(pet: widget.pet),
            const SizedBox(height: 16),
            _InsuranceProfilesSection(
              request: _profilesRequest,
              petId: widget.pet.id,
              onRetry: _reloadProfiles,
              onAdd: _addProfile,
            ),
            const SizedBox(height: 16),
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Партнёр',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'VETHELP_INSURANCE_PILOT',
                        icon: Icon(Icons.verified_user_outlined),
                        label: Text('Pilot'),
                      ),
                      ButtonSegment(
                        value: 'DIRECT_BILLING',
                        icon: Icon(Icons.receipt_long_outlined),
                        label: Text('Direct'),
                      ),
                    ],
                    selected: {_partnerCode},
                    onSelectionChanged:
                        _submitState == CoverageCheckSubmitState.loading
                            ? null
                            : (value) =>
                                setState(() => _partnerCode = value.single),
                  ),
                  const SizedBox(height: 14),
                  FormField<bool>(
                    initialValue: _consentAccepted,
                    validator: (value) => value == true
                        ? null
                        : 'Подтвердите согласие на проверку покрытия.',
                    builder: (field) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CheckboxListTile(
                          value: _consentAccepted,
                          onChanged:
                              _submitState == CoverageCheckSubmitState.loading
                                  ? null
                                  : (value) {
                                      setState(() {
                                        _consentAccepted = value == true;
                                        field.didChange(_consentAccepted);
                                      });
                                    },
                          title: const Text('Согласие на проверку'),
                          subtitle: const Text(
                              'VetHelp отправит страховому партнёру только данные, необходимые для проверки покрытия.'),
                          controlAffinity: ListTileControlAffinity.leading,
                          contentPadding: EdgeInsets.zero,
                        ),
                        if (field.hasError)
                          Padding(
                            padding: const EdgeInsets.only(left: 16),
                            child: Text(field.errorText!,
                                style: TextStyle(
                                    color:
                                        Theme.of(context).colorScheme.error)),
                          ),
                      ],
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    _ErrorBanner(text: _error!),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _canSubmit ? _submit : null,
                    icon: _submitState == CoverageCheckSubmitState.loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.shield_outlined),
                    label: Text(_submitState == CoverageCheckSubmitState.loading
                        ? 'Отправляем'
                        : 'Проверить покрытие'),
                    style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(52)),
                  ),
                ],
              ),
            ),
            if (check != null) ...[
              const SizedBox(height: 16),
              _CoverageStatusCard(check: check, onRefresh: _refresh),
            ],
          ],
        ),
      ),
    );
  }

  String _messageFor(String code) {
    return switch (code) {
      'PET_OWNERSHIP_MISMATCH' =>
        'Выберите питомца из вашего профиля и повторите проверку.',
      'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
      'INSURANCE_COVERAGE_CHECK_NOT_FOUND' =>
        'Проверка больше недоступна. Запустите новую.',
      _ => 'Не удалось выполнить проверку. Повторите попытку.',
    };
  }
}

enum CoverageCheckSubmitState { idle, loading, success, failure }

class _InsuranceProfilesSection extends StatelessWidget {
  const _InsuranceProfilesSection({
    required this.request,
    required this.petId,
    required this.onRetry,
    required this.onAdd,
  });

  final Future<List<InsuranceProfileView>>? request;
  final String petId;
  final VoidCallback onRetry;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<List<InsuranceProfileView>>(
          future: request,
          builder: (context, snapshot) {
            final profiles = (snapshot.data ?? const <InsuranceProfileView>[])
                .where((profile) => profile.petId == petId)
                .toList(growable: false);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.policy_outlined),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('Полисы питомца',
                          style: Theme.of(context).textTheme.titleMedium),
                    ),
                    TextButton.icon(
                      onPressed: onAdd,
                      icon: const Icon(Icons.add),
                      label: const Text('Добавить'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (snapshot.connectionState != ConnectionState.done)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  _InlineRetry(
                    text: 'Не удалось загрузить полисы.',
                    onRetry: onRetry,
                  )
                else if (profiles.isEmpty)
                  const Text(
                    'Добавьте полис, чтобы быстрее заполнять проверки покрытия. VetHelp хранит только скрытый номер полиса.',
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: profiles.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) =>
                        _InsuranceProfileTile(profile: profiles[index]),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _InlineRetry extends StatelessWidget {
  const _InlineRetry({required this.text, required this.onRetry});

  final String text;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(text)),
        TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('Повторить'),
        ),
      ],
    );
  }
}

class _InsuranceProfileTile extends StatelessWidget {
  const _InsuranceProfileTile({required this.profile});

  final InsuranceProfileView profile;

  @override
  Widget build(BuildContext context) {
    final validity = _validity(profile.validFrom, profile.validUntil);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        leading: const Icon(Icons.shield_outlined),
        title:
            Text('${profile.insurerCode} · ${profile.policyReferenceMasked}'),
        subtitle: Text([
          _relation(profile.petRelation),
          if (validity != null) validity,
          _verification(profile.verificationState),
        ].join('\n')),
        isThreeLine: validity != null,
      ),
    );
  }
}

class _InsuranceProfileForm extends StatefulWidget {
  const _InsuranceProfileForm({
    required this.petId,
    required this.consentVersion,
    required this.onSubmit,
  });

  final String petId;
  final String consentVersion;
  final Future<InsuranceProfileView> Function(InsuranceProfileInput input)
      onSubmit;

  @override
  State<_InsuranceProfileForm> createState() => _InsuranceProfileFormState();
}

class _InsuranceProfileFormState extends State<_InsuranceProfileForm> {
  final _formKey = GlobalKey<FormState>();
  final _insurer = TextEditingController(text: 'VETHELP_INSURANCE_PILOT');
  final _policy = TextEditingController();
  final _validFrom = TextEditingController();
  final _validUntil = TextEditingController();
  String _relation = 'POLICY_HOLDER_PET';
  bool _consent = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _insurer.dispose();
    _policy.dispose();
    _validFrom.dispose();
    _validUntil.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading ||
        !(_formKey.currentState?.validate() ?? false) ||
        !_consent) {
      setState(() {
        if (!_consent) {
          _error = 'Подтвердите согласие на сохранение полиса.';
        }
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await widget.onSubmit(InsuranceProfileInput(
        petId: widget.petId,
        insurerCode: _insurer.text.trim(),
        policyReference: _policy.text.trim(),
        petRelation: _relation,
        consentVersion: widget.consentVersion,
        validFrom: _parseDate(_validFrom.text),
        validUntil: _parseDate(_validUntil.text),
      ));
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(profile);
    } on CoverageCheckApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _profileError(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось сохранить полис. Проверьте соединение.';
      });
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
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottom),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Полис питомца',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              const Text(
                'VetHelp сохранит скрытый номер полиса и не будет принимать решение о покрытии.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _insurer,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Страховой партнёр',
                ),
                validator: _requiredText,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _policy,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Номер полиса',
                  helperText: 'На экране будет видна только скрытая форма',
                ),
                validator: _requiredText,
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                      value: 'POLICY_HOLDER_PET', label: Text('Основной')),
                  ButtonSegment(
                      value: 'DEPENDENT_PET', label: Text('В полисе')),
                  ButtonSegment(value: 'UNKNOWN', label: Text('Не знаю')),
                ],
                selected: {_relation},
                onSelectionChanged: _loading
                    ? null
                    : (value) => setState(() => _relation = value.single),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _validFrom,
                      keyboardType: TextInputType.datetime,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Действует с',
                        hintText: 'ГГГГ-ММ-ДД',
                      ),
                      validator: _optionalDate,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _validUntil,
                      keyboardType: TextInputType.datetime,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        labelText: 'Действует до',
                        hintText: 'ГГГГ-ММ-ДД',
                      ),
                      validator: _optionalDate,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              CheckboxListTile(
                value: _consent,
                onChanged: _loading
                    ? null
                    : (value) => setState(() => _consent = value == true),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
                title: const Text('Согласие на сохранение данных полиса'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                _ErrorBanner(text: _error!),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Сохранить полис'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PetHeader extends StatelessWidget {
  const _PetHeader({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) => Card(
        color: Theme.of(context).colorScheme.primaryContainer,
        child: ListTile(
          leading: const Icon(Icons.pets_outlined),
          title: Text(pet.name),
          subtitle: Text(_species(pet.species)),
        ),
      );
}

class _CoverageStatusCard extends StatelessWidget {
  const _CoverageStatusCard({required this.check, required this.onRefresh});

  final CoverageCheckView check;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final status = _status(check.state);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(status.icon, color: status.color(context)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(status.title,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(status.message),
            const SizedBox(height: 8),
            Text('Обновлено: ${_dateTime(context, check.serverNow)}',
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Обновить статус'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.errorContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              const Icon(Icons.error_outline),
              const SizedBox(width: 10),
              Expanded(child: Text(text)),
            ],
          ),
        ),
      );
}

class _CoverageStatus {
  const _CoverageStatus(this.title, this.message, this.icon, this.color);

  final String title;
  final String message;
  final IconData icon;
  final Color Function(BuildContext context) color;
}

_CoverageStatus _status(String state) => switch (state) {
      'REQUESTED' => _CoverageStatus(
          'Проверка отправлена',
          'Страховой партнёр получил запрос. Итоговый статус появится после обработки.',
          Icons.hourglass_top_outlined,
          (context) => Theme.of(context).colorScheme.primary),
      'PROCESSING' => _CoverageStatus(
          'Партнёр проверяет покрытие',
          'VetHelp обновит статус после ответа партнёра.',
          Icons.sync_outlined,
          (context) => Theme.of(context).colorScheme.primary),
      'COVERED' => _CoverageStatus(
          'Покрытие подтверждено',
          'Покажите этот статус клинике перед визитом.',
          Icons.check_circle_outline,
          (context) => Theme.of(context).colorScheme.tertiary),
      'NOT_COVERED' => _CoverageStatus(
          'Покрытие не подтверждено',
          'Можно уточнить условия у страхового партнёра или выбрать оплату напрямую.',
          Icons.info_outline,
          (context) => Theme.of(context).colorScheme.error),
      'MANUAL_REVIEW' => _CoverageStatus(
          'Нужна ручная проверка',
          'Партнёр проверит данные вручную. Обновите статус позже.',
          Icons.manage_search_outlined,
          (context) => Theme.of(context).colorScheme.primary),
      'FAILED' => _CoverageStatus(
          'Проверка не выполнена',
          'Повторите попытку позже или выберите оплату напрямую.',
          Icons.error_outline,
          (context) => Theme.of(context).colorScheme.error),
      'EXPIRED' => _CoverageStatus(
          'Проверка истекла',
          'Запустите новую проверку перед визитом.',
          Icons.event_busy_outlined,
          (context) => Theme.of(context).colorScheme.error),
      _ => _CoverageStatus(
          'Нужно согласие',
          'Подтвердите согласие, чтобы отправить запрос страховому партнёру.',
          Icons.privacy_tip_outlined,
          (context) => Theme.of(context).colorScheme.primary),
    };

String _species(String value) => switch (value.toUpperCase()) {
      'CAT' => 'Кошка',
      'DOG' => 'Собака',
      _ => 'Питомец',
    };

String _dateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(local);
  final time = TimeOfDay.fromDateTime(local).format(context);
  return '$date, $time';
}

String? _validity(DateTime? from, DateTime? until) {
  if (from == null && until == null) return null;
  if (from != null && until != null) {
    return 'Действует: ${_dateOnly(from)} - ${_dateOnly(until)}';
  }
  if (from != null) return 'Действует с ${_dateOnly(from)}';
  return 'Действует до ${_dateOnly(until!)}';
}

String _relation(String value) => switch (value) {
      'POLICY_HOLDER_PET' => 'Основной питомец в полисе',
      'DEPENDENT_PET' => 'Питомец добавлен в полис',
      _ => 'Связь с полисом не уточнена',
    };

String _verification(String value) => switch (value) {
      'VERIFIED' => 'Проверен партнёром',
      'REJECTED' => 'Отклонён партнёром',
      'EXPIRED' => 'Срок действия истёк',
      _ => 'Ожидает проверки партнёром',
    };

String? _requiredText(String? value) {
  if (value == null || value.trim().isEmpty) return 'Заполните поле.';
  return null;
}

String? _optionalDate(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  return _parseDate(value) == null
      ? 'Введите дату в формате ГГГГ-ММ-ДД.'
      : null;
}

DateTime? _parseDate(String value) {
  final normalized = value.trim();
  if (normalized.isEmpty) return null;
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(normalized);
  if (match == null) return null;
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  final parsed = DateTime(year, month, day);
  if (parsed.year != year || parsed.month != month || parsed.day != day) {
    return null;
  }
  return parsed;
}

String _dateOnly(DateTime value) {
  final local = value.toLocal();
  return '${local.year.toString().padLeft(4, '0')}-'
      '${local.month.toString().padLeft(2, '0')}-'
      '${local.day.toString().padLeft(2, '0')}';
}

String _profileError(String code) {
  return switch (code) {
    'PET_OWNERSHIP_MISMATCH' =>
      'Выберите питомца из вашего профиля и повторите сохранение.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось сохранить полис. Проверьте данные и повторите попытку.',
  };
}
