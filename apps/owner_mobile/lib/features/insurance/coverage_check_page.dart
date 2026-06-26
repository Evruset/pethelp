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
  final _formKey = GlobalKey<FormState>();
  final _uuid = const Uuid();

  CoverageCheckSubmitState _submitState = CoverageCheckSubmitState.idle;
  CoverageCheckView? _check;
  String _partnerCode = 'VETHELP_INSURANCE_PILOT';
  bool _consentAccepted = false;
  String? _error;

  bool get _canSubmit =>
      _check == null &&
      _submitState != CoverageCheckSubmitState.loading &&
      _consentAccepted;

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
