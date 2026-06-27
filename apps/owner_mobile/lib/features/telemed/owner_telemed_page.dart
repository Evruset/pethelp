import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'owner_telemed_repository.dart';
import 'waiting_room/telemed_room_access_repository.dart';
import 'waiting_room/telemed_waiting_room_bloc.dart';
import 'waiting_room/telemed_waiting_room_page.dart';

class OwnerTelemedPage extends StatefulWidget {
  const OwnerTelemedPage({
    super.key,
    required this.repository,
    required this.waitingRepository,
    required this.roomAccessRepository,
    this.onCreateConsultation,
    this.onRequestEmergency,
    this.onBrowseClinics,
  });

  final OwnerTelemedRepository repository;
  final TelemedWaitingRepository waitingRepository;
  final TelemedRoomAccessRepository roomAccessRepository;

  /// Kept temporarily for call-site compatibility. Telemedicine intake is not
  /// now opens the safety intake instead of directly entering payment/queue.
  final VoidCallback? onCreateConsultation;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;

  @override
  State<OwnerTelemedPage> createState() => _OwnerTelemedPageState();
}

class _OwnerTelemedPageState extends State<OwnerTelemedPage> {
  Future<List<OwnerTelemedSession>>? _request;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    final request = widget.repository.list();
    setState(() {
      _request = request;
    });
  }

  Future<void> _refresh() async {
    _reload();
    await _request;
  }

  Future<void> _openWaitingRoom(OwnerTelemedSession session) async {
    if (session.bucket != 'ACTIVE') return;
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TelemedWaitingRoomPage(
        sessionId: session.sessionId,
        repository: widget.waitingRepository,
        roomAccessRepository: widget.roomAccessRepository,
        onBrowseClinics: widget.onBrowseClinics,
      ),
    ));
    if (mounted) _reload();
  }

  void _openConsultationAvailability() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => _TelemedIntakePage(
        repository: widget.repository,
        onRequestEmergency: widget.onRequestEmergency,
        onBrowseClinics: widget.onBrowseClinics,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Онлайн-консультации')),
      body: FutureBuilder<List<OwnerTelemedSession>>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _TelemedError(onRetry: _reload);
          }

          final rows = snapshot.data ?? const <OwnerTelemedSession>[];
          final active = rows
              .where((session) => session.bucket == 'ACTIVE')
              .toList(growable: false);
          final history = rows
              .where((session) => session.bucket != 'ACTIVE')
              .toList(growable: false);

          return DefaultTabController(
            length: 2,
            child: Column(
              children: [
                const TabBar(tabs: [
                  Tab(text: 'Активные'),
                  Tab(text: 'История'),
                ]),
                Expanded(
                  child: TabBarView(
                    children: [
                      _TelemedSessionList(
                        rows: active,
                        emptyTitle: 'Нет активных консультаций',
                        emptyText:
                            'Онлайн-консультация появится здесь после оформления и подтверждения.',
                        onRefresh: _refresh,
                        onOpen: _openWaitingRoom,
                        onCreateConsultation: _openConsultationAvailability,
                      ),
                      _TelemedSessionList(
                        rows: history,
                        emptyTitle: 'История консультаций пуста',
                        emptyText:
                            'Завершённые и отменённые консультации появятся здесь.',
                        onRefresh: _refresh,
                        onBrowseClinics: widget.onBrowseClinics,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TelemedSessionList extends StatelessWidget {
  const _TelemedSessionList({
    required this.rows,
    required this.emptyTitle,
    required this.emptyText,
    required this.onRefresh,
    this.onOpen,
    this.onCreateConsultation,
    this.onBrowseClinics,
  });

  final List<OwnerTelemedSession> rows;
  final String emptyTitle;
  final String emptyText;
  final Future<void> Function() onRefresh;
  final ValueChanged<OwnerTelemedSession>? onOpen;
  final VoidCallback? onCreateConsultation;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 72),
            Icon(
              Icons.video_call_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 12),
            Text(
              emptyTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(emptyText, textAlign: TextAlign.center),
            if (onCreateConsultation != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onCreateConsultation,
                icon: const Icon(Icons.video_call_outlined),
                label: const Text('Выбрать онлайн-консультацию'),
              ),
            ],
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => _TelemedSessionCard(
          session: rows[index],
          onOpen: onOpen == null ? null : () => onOpen!(rows[index]),
          onBrowseClinics: onBrowseClinics,
        ),
      ),
    );
  }
}

class _TelemedSessionCard extends StatelessWidget {
  const _TelemedSessionCard({
    required this.session,
    this.onOpen,
    this.onBrowseClinics,
  });

  final OwnerTelemedSession session;
  final VoidCallback? onOpen;
  final VoidCallback? onBrowseClinics;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final state = _state(session.state, colors);
    final canOpen = onOpen != null;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(state.icon, color: state.color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      state.label,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  if (canOpen) const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 8),
              Text(session.serviceName ?? 'Онлайн-консультация'),
              const SizedBox(height: 4),
              Text(
                '${session.petName} · ${session.clinicName}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              Text(_range(context, session.startsAt, session.endsAt)),
              if (state.description != null) ...[
                const SizedBox(height: 8),
                Text(
                  state.description!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              if (session.refundState != null) ...[
                const SizedBox(height: 8),
                Text(
                  _paymentActionLabel(session.refundState!),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.onSurfaceVariant,
                      ),
                ),
              ],
              if (session.state == 'WAITING_FOR_DOCTOR') ...[
                const SizedBox(height: 8),
                Text(
                  'Врач должен подключиться до ${_dateTime(context, session.doctorJoinDeadlineAt)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              if (session.recommendationText != null) ...[
                const SizedBox(height: 12),
                _TelemedResultBlock(
                  icon: Icons.fact_check_outlined,
                  title: 'Рекомендация врача',
                  text: session.recommendationText!,
                ),
              ],
              if (session.followUpNotes != null) ...[
                const SizedBox(height: 12),
                _TelemedResultBlock(
                  icon: Icons.event_available_outlined,
                  title: 'Следующий шаг',
                  text: session.followUpNotes!,
                ),
              ],
              if (session.safetyEscalation == true) ...[
                const SizedBox(height: 12),
                _TelemedResultBlock(
                  icon: Icons.local_hospital_outlined,
                  title: 'Нужен очный осмотр',
                  text:
                      'Врач отметил, что безопаснее продолжить помощь в клинике.',
                ),
              ],
              if ((session.followUpNotes != null ||
                      session.safetyEscalation == true) &&
                  onBrowseClinics != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onBrowseClinics,
                  icon: const Icon(Icons.local_hospital_outlined),
                  label: const Text('Выбрать клинику'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TelemedResultBlock extends StatelessWidget {
  const _TelemedResultBlock({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: theme.colorScheme.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.labelLarge),
              const SizedBox(height: 4),
              Text(text, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

class _TelemedIntakePage extends StatefulWidget {
  const _TelemedIntakePage({
    required this.repository,
    this.onRequestEmergency,
    this.onBrowseClinics,
  });

  final OwnerTelemedRepository repository;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;

  @override
  State<_TelemedIntakePage> createState() => _TelemedIntakePageState();
}

class _TelemedIntakePageState extends State<_TelemedIntakePage> {
  static const _consentVersion = 'owner-mobile-telemed-v1';
  static const _space = 16.0;
  static const _spaceSmall = 8.0;

  late Future<List<TelemedPet>> _petsRequest;
  String? _petId;
  String _category = 'SKIN_EAR_EYE';
  String _duration = 'ONE_TO_THREE_DAYS';
  bool _priorClinicVisit = false;
  bool _consent = false;
  bool _loading = false;
  bool _paymentLoading = false;
  String? _error;
  String? _paymentError;
  TelemedIntakeResult? _result;
  TelemedPaymentIntent? _paymentIntent;

  final Set<String> _redFlags = <String>{};

  @override
  void initState() {
    super.initState();
    _reloadPets();
  }

  void _reloadPets() {
    _petsRequest = _loadPets();
  }

  Future<List<TelemedPet>> _loadPets() async {
    final pets = await widget.repository.listPets();
    if (mounted && pets.isNotEmpty && _petId == null) {
      setState(() {
        _petId = pets.first.id;
      });
    }
    return pets;
  }

  Future<void> _submit() async {
    final petId = _petId;
    if (petId == null || !_consent || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.repository.createIntake(
        TelemedIntakeInput(
          petId: petId,
          category: _category,
          symptomDuration: _duration,
          priorClinicVisit: _priorClinicVisit,
          emergencyRedFlags: _redFlags.toList(growable: false),
          consentVersion: _consentVersion,
        ),
      );
      if (!mounted) return;
      setState(() {
        _result = result;
      });
    } on OwnerTelemedApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = _intakeError(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Не удалось проверить, подходит ли онлайн-консультация.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _openEmergency() {
    Navigator.of(context).pop();
    widget.onRequestEmergency?.call();
  }

  void _openClinics() {
    Navigator.of(context).pop();
    widget.onBrowseClinics?.call();
  }

  Future<void> _createPaymentIntent() async {
    final result = _result;
    if (result == null || _paymentLoading) return;
    setState(() {
      _paymentLoading = true;
      _paymentError = null;
    });
    try {
      final intent =
          await widget.repository.createPaymentIntent(result.intakeId);
      if (!mounted) return;
      setState(() {
        _paymentIntent = intent;
      });
      final checkoutUrl = intent.checkoutUrl;
      if (checkoutUrl != null && checkoutUrl.isNotEmpty) {
        final launched = await launchUrl(
          Uri.parse(checkoutUrl),
          mode: LaunchMode.externalApplication,
        );
        if (!launched && mounted) {
          setState(() {
            _paymentError = 'Checkout создан, но не удалось открыть ссылку.';
          });
        }
      }
    } on OwnerTelemedApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _paymentError = _paymentErrorFor(error.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _paymentError = 'Не удалось открыть оплату онлайн-консультации.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _paymentLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Онлайн-консультация')),
        body: SafeArea(
          child: FutureBuilder<List<TelemedPet>>(
            future: _petsRequest,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return _TelemedIntakeError(onRetry: () {
                  setState(() {
                    _error = null;
                    _reloadPets();
                  });
                });
              }
              final pets = snapshot.data ?? const <TelemedPet>[];
              if (pets.isEmpty) return const _TelemedNoPets();
              final result = _result;
              if (result != null) {
                return _TelemedIntakeResultView(
                  result: result,
                  onRequestEmergency:
                      widget.onRequestEmergency == null ? null : _openEmergency,
                  onBrowseClinics:
                      widget.onBrowseClinics == null ? null : _openClinics,
                  onBack: () => Navigator.of(context).pop(),
                  paymentIntent: _paymentIntent,
                  paymentLoading: _paymentLoading,
                  paymentError: _paymentError,
                  onCreatePayment:
                      result.routingTarget == 'TELEMED_PAYMENT_QUEUE'
                          ? _createPaymentIntent
                          : null,
                );
              }
              return _TelemedIntakeForm(
                pets: pets,
                selectedPetId: _petId,
                category: _category,
                duration: _duration,
                priorClinicVisit: _priorClinicVisit,
                consent: _consent,
                loading: _loading,
                error: _error,
                redFlags: _redFlags,
                onPetChanged: (value) => setState(() => _petId = value),
                onCategoryChanged: (value) => setState(() => _category = value),
                onDurationChanged: (value) => setState(() => _duration = value),
                onPriorClinicVisitChanged: (value) =>
                    setState(() => _priorClinicVisit = value),
                onConsentChanged: (value) => setState(() => _consent = value),
                onRedFlagsChanged: (value) {
                  setState(() {
                    _redFlags
                      ..clear()
                      ..addAll(value);
                  });
                },
                onSubmit: _submit,
              );
            },
          ),
        ),
      );
}

class _TelemedIntakeForm extends StatelessWidget {
  const _TelemedIntakeForm({
    required this.pets,
    required this.selectedPetId,
    required this.category,
    required this.duration,
    required this.priorClinicVisit,
    required this.consent,
    required this.loading,
    required this.error,
    required this.redFlags,
    required this.onPetChanged,
    required this.onCategoryChanged,
    required this.onDurationChanged,
    required this.onPriorClinicVisitChanged,
    required this.onConsentChanged,
    required this.onRedFlagsChanged,
    required this.onSubmit,
  });

  final List<TelemedPet> pets;
  final String? selectedPetId;
  final String category;
  final String duration;
  final bool priorClinicVisit;
  final bool consent;
  final bool loading;
  final String? error;
  final Set<String> redFlags;
  final ValueChanged<String?> onPetChanged;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onDurationChanged;
  final ValueChanged<bool> onPriorClinicVisitChanged;
  final ValueChanged<bool> onConsentChanged;
  final ValueChanged<Set<String>> onRedFlagsChanged;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(_TelemedIntakePageState._space),
      children: [
        Text('Сначала проверим безопасность',
            style: theme.textTheme.titleLarge),
        const SizedBox(height: _TelemedIntakePageState._spaceSmall),
        const Text(
          'Онлайн-консультация не используется при срочных симптомах и не заменяет очный осмотр.',
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: selectedPetId,
          decoration: const InputDecoration(labelText: 'Питомец'),
          items: [
            for (final pet in pets)
              DropdownMenuItem(
                value: pet.id,
                child: Text('${pet.name} · ${_speciesLabel(pet.species)}'),
              ),
          ],
          onChanged: loading ? null : onPetChanged,
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: category,
          decoration: const InputDecoration(labelText: 'Тема вопроса'),
          items: [
            for (final option in _telemedCategories)
              DropdownMenuItem(value: option.code, child: Text(option.label)),
          ],
          onChanged: loading || selectedPetId == null
              ? null
              : (value) => onCategoryChanged(value ?? category),
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        DropdownButtonFormField<String>(
          // ignore: deprecated_member_use
          value: duration,
          decoration: const InputDecoration(labelText: 'Как давно'),
          items: const [
            DropdownMenuItem(
                value: 'NO_SYMPTOMS', child: Text('Нет симптомов')),
            DropdownMenuItem(
                value: 'LESS_THAN_24H', child: Text('Меньше 24 часов')),
            DropdownMenuItem(
                value: 'ONE_TO_THREE_DAYS', child: Text('1-3 дня')),
            DropdownMenuItem(
                value: 'MORE_THAN_THREE_DAYS', child: Text('Больше 3 дней')),
          ],
          onChanged:
              loading ? null : (value) => onDurationChanged(value ?? duration),
        ),
        const SizedBox(height: _TelemedIntakePageState._space),
        Text('Есть срочные признаки?', style: theme.textTheme.titleMedium),
        const SizedBox(height: _TelemedIntakePageState._spaceSmall),
        _TelemedRedFlagChips(
          selected: redFlags,
          enabled: !loading,
          onChanged: onRedFlagsChanged,
        ),
        const SizedBox(height: _TelemedIntakePageState._spaceSmall),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: priorClinicVisit,
          onChanged: loading ? null : onPriorClinicVisitChanged,
          title: const Text('Уже были в клинике по этому вопросу'),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: consent,
          onChanged:
              loading ? null : (value) => onConsentChanged(value == true),
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text(
            'Понимаю ограничения: это не экстренная помощь, не диагноз, не рецепт и не страховое решение.',
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: _TelemedIntakePageState._spaceSmall),
          Text(
            error!,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.error),
          ),
        ],
        const SizedBox(height: _TelemedIntakePageState._space),
        FilledButton.icon(
          onPressed:
              consent && selectedPetId != null && !loading ? onSubmit : null,
          icon: loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.health_and_safety_outlined),
          label: Text(loading ? 'Проверяем' : 'Проверить возможность онлайн'),
        ),
      ],
    );
  }
}

class _TelemedRedFlagChips extends StatelessWidget {
  const _TelemedRedFlagChips({
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final Set<String> selected;
  final bool enabled;
  final ValueChanged<Set<String>> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final option in _telemedRedFlags)
            FilterChip(
              avatar: Icon(option.icon, size: 18),
              label: Text(option.label),
              selected: selected.contains(option.code),
              onSelected: enabled
                  ? (value) {
                      final next = Set<String>.from(selected);
                      value ? next.add(option.code) : next.remove(option.code);
                      onChanged(next);
                    }
                  : null,
            ),
        ],
      );
}

class _TelemedIntakeResultView extends StatelessWidget {
  const _TelemedIntakeResultView({
    required this.result,
    required this.onBack,
    required this.paymentIntent,
    required this.paymentLoading,
    required this.paymentError,
    this.onRequestEmergency,
    this.onBrowseClinics,
    this.onCreatePayment,
  });

  final TelemedIntakeResult result;
  final VoidCallback onBack;
  final TelemedPaymentIntent? paymentIntent;
  final bool paymentLoading;
  final String? paymentError;
  final VoidCallback? onRequestEmergency;
  final VoidCallback? onBrowseClinics;
  final VoidCallback? onCreatePayment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final view = _eligibilityView(result.outcome, theme.colorScheme);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: view.background,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(view.icon, color: view.foreground),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(view.title, style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Text(view.description),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ограничения', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final guardrail in result.guardrails.take(5))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text('• ${_guardrailLabel(guardrail)}'),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (result.routingTarget == 'EMERGENCY_ROUTE' &&
            onRequestEmergency != null)
          FilledButton.icon(
            onPressed: onRequestEmergency,
            icon: const Icon(Icons.warning_amber_rounded),
            label: const Text('Открыть срочный маршрут'),
          )
        else if (result.routingTarget == 'CLINIC_BOOKING' &&
            onBrowseClinics != null)
          FilledButton.icon(
            onPressed: onBrowseClinics,
            icon: const Icon(Icons.local_hospital_outlined),
            label: const Text('Выбрать клинику'),
          )
        else if (result.routingTarget == 'TELEMED_PAYMENT_QUEUE')
          FilledButton.icon(
            onPressed: paymentLoading ? null : onCreatePayment,
            icon: paymentLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.payments_outlined),
            label: Text(paymentLoading ? 'Создаём оплату' : 'Перейти к оплате'),
          ),
        if (paymentIntent != null) ...[
          const SizedBox(height: 8),
          Text(
            'Оплата создана: ${paymentIntent!.amount} ${paymentIntent!.currency}. Правила отмены оплаты: ${paymentIntent!.refundPolicyVersion}.',
            style: theme.textTheme.bodySmall,
          ),
        ],
        if (paymentError != null) ...[
          const SizedBox(height: 8),
          Text(
            paymentError!,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.error),
          ),
        ],
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: onBack,
          child: const Text('Вернуться'),
        ),
      ],
    );
  }
}

class _TelemedIntakeError extends StatelessWidget {
  const _TelemedIntakeError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 44),
              const SizedBox(height: 12),
              const Text(
                'Не удалось загрузить питомцев для онлайн-консультации.',
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

class _TelemedNoPets extends StatelessWidget {
  const _TelemedNoPets();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Для онлайн-консультации нужно добавить питомца в профиль.',
            textAlign: TextAlign.center,
          ),
        ),
      );
}

class _TelemedOption {
  const _TelemedOption(this.code, this.label, this.icon);

  final String code;
  final String label;
  final IconData icon;
}

class _EligibilityView {
  const _EligibilityView(
    this.title,
    this.description,
    this.icon,
    this.foreground,
    this.background,
  );

  final String title;
  final String description;
  final IconData icon;
  final Color foreground;
  final Color background;
}

const List<_TelemedOption> _telemedCategories = [
  _TelemedOption(
      'SKIN_EAR_EYE', 'Кожа, уши или глаза', Icons.visibility_outlined),
  _TelemedOption('NUTRITION', 'Питание', Icons.restaurant_outlined),
  _TelemedOption('BEHAVIOR', 'Поведение', Icons.psychology_outlined),
  _TelemedOption(
      'MEDICATION_QUESTION', 'Вопрос по назначению', Icons.medication_outlined),
  _TelemedOption('POST_VISIT_FOLLOW_UP', 'Контроль после визита',
      Icons.event_available_outlined),
  _TelemedOption('VOMITING_DIARRHEA', 'Рвота или диарея', Icons.sick_outlined),
  _TelemedOption('PAIN_LAMENESS', 'Боль или хромота', Icons.healing_outlined),
  _TelemedOption('GENERAL_QUESTION', 'Общий вопрос', Icons.help_outline),
  _TelemedOption('OTHER', 'Другое', Icons.more_horiz),
];

const List<_TelemedOption> _telemedRedFlags = [
  _TelemedOption('BREATHING_DISTRESS', 'Тяжёлое дыхание', Icons.air_outlined),
  _TelemedOption('COLLAPSE_OR_UNCONSCIOUS', 'Потеря сознания',
      Icons.warning_amber_rounded),
  _TelemedOption('SEIZURE', 'Судороги', Icons.flash_on_outlined),
  _TelemedOption(
      'SEVERE_BLEEDING', 'Сильное кровотечение', Icons.bloodtype_outlined),
  _TelemedOption('MAJOR_TRAUMA', 'Травма', Icons.personal_injury_outlined),
  _TelemedOption('TOXIN_INGESTION', 'Отравление', Icons.science_outlined),
  _TelemedOption('BLOAT_OR_BLOCKED_URINATION', 'Вздутие или не мочится',
      Icons.emergency_outlined),
];

String _speciesLabel(String value) => switch (value) {
      'DOG' => 'собака',
      'CAT' => 'кошка',
      _ => 'питомец',
    };

String _intakeError(String code) {
  return switch (code) {
    'TELEMED_CONSENT_REQUIRED' =>
      'Подтвердите ограничения онлайн-консультации.',
    'OWNER_PET_NOT_FOUND' =>
      'Питомец не найден в текущем профиле. Обновите список и попробуйте снова.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось проверить, подходит ли онлайн-консультация.',
  };
}

String _paymentErrorFor(String code) {
  return switch (code) {
    'TELEMED_INTAKE_NOT_ELIGIBLE' =>
      'Оплата доступна только после безопасного результата онлайн-консультации.',
    'ACQUIRING_PROVIDER_UNAVAILABLE' =>
      'Платёжный провайдер временно недоступен. Попробуйте позже.',
    'TELEMED_PAYMENT_NOT_CREATABLE' =>
      'Оплата уже находится в другом состоянии. Обновите консультации.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось открыть оплату онлайн-консультации.',
  };
}

_EligibilityView _eligibilityView(String outcome, ColorScheme colors) {
  return switch (outcome) {
    'EMERGENCY' => _EligibilityView(
        'Нужна срочная помощь',
        'Онлайн-консультация не подходит. Откройте срочный маршрут и звоните в проверенную клинику.',
        Icons.warning_amber_rounded,
        colors.error,
        colors.errorContainer,
      ),
    'SAME_DAY_CLINIC' => _EligibilityView(
        'Лучше очный визит сегодня',
        'По этим симптомам безопаснее выбрать клинику, а не ждать онлайн-очередь.',
        Icons.local_hospital_outlined,
        colors.onSecondaryContainer,
        colors.secondaryContainer,
      ),
    'TELEMED_ELIGIBLE' => _EligibilityView(
        'Онлайн-консультация подходит',
        'Можно продолжить к оплате и очереди, когда этот шаг будет доступен.',
        Icons.video_call_outlined,
        colors.primary,
        colors.primaryContainer,
      ),
    _ => _EligibilityView(
        'Нужны уточнения',
        'Ответов недостаточно для безопасного онлайн-маршрута. Уточните симптомы или выберите клинику.',
        Icons.info_outline,
        colors.onSurfaceVariant,
        colors.surfaceContainerHighest,
      ),
  };
}

String _guardrailLabel(String value) {
  return switch (value) {
    'Telemedicine does not replace emergency care.' =>
      'Телемедицина не заменяет срочную помощь.',
    'VetHelp does not promise a diagnosis in telemedicine intake.' =>
      'VetHelp не обещает диагноз на этапе intake.',
    'Telemedicine intake does not create prescriptions.' =>
      'Intake не создаёт рецепт.',
    'Telemedicine intake does not confirm insurance coverage.' =>
      'Intake не подтверждает страховое покрытие.',
    'A veterinarian may still recommend an in-person examination.' =>
      'Ветеринар может рекомендовать очный осмотр.',
    _ => value,
  };
}

class _TelemedError extends StatelessWidget {
  const _TelemedError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 44),
            const SizedBox(height: 12),
            const Text(
              'Не удалось загрузить консультации. Проверьте соединение и повторите попытку.',
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

class _StateView {
  const _StateView(this.label, this.icon, this.color, {this.description});

  final String label;
  final IconData icon;
  final Color color;
  final String? description;
}

_StateView _state(String value, ColorScheme colors) => switch (value) {
      'WAITING_FOR_DOCTOR' => _StateView(
          'Ожидаем врача',
          Icons.hourglass_top_outlined,
          colors.primary,
        ),
      'CONNECTED' => _StateView(
          'Врач подключился',
          Icons.video_call,
          colors.tertiary,
        ),
      'COMPLETED' => _StateView(
          'Консультация завершена',
          Icons.check_circle_outline,
          colors.primary,
        ),
      'DOCTOR_TIMEOUT' => _StateView(
          'Врач не подключился',
          Icons.schedule_outlined,
          colors.error,
          description:
              'Консультация не состоялась. Статус оплаты проверяется автоматически.',
        ),
      _ => _StateView(
          'Статус обновляется',
          Icons.sync_outlined,
          colors.primary,
        ),
    };

String _paymentActionLabel(String value) => switch (value) {
      'VOID_REQUESTED' => 'Отмена оплаты поставлена в очередь.',
      'VOIDED' => 'Оплата отменена, списания не будет.',
      'REFUND_PENDING' => 'Возврат поставлен в очередь.',
      'REFUNDED' => 'Возврат выполнен.',
      'NOT_REQUIRED' => 'Дополнительных действий по оплате не требуется.',
      _ => 'Статус оплаты обновляется.',
    };

String _dateTime(BuildContext context, DateTime value) {
  final local = value.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(local);
  final time = TimeOfDay.fromDateTime(local).format(context);
  return '$date, $time';
}

String _range(BuildContext context, DateTime from, DateTime to) {
  final first = from.toLocal();
  final last = to.toLocal();
  final date = MaterialLocalizations.of(context).formatMediumDate(first);
  final start = TimeOfDay.fromDateTime(first).format(context);
  final end = TimeOfDay.fromDateTime(last).format(context);
  return '$date · $start-$end';
}
