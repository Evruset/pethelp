import 'package:flutter/material.dart';

import '../../core/e2e/owner_e2e_hooks.dart';
import '../appointments/owner_appointments_page.dart';
import '../appointments/owner_appointments_repository.dart';
import '../booking/alternative_slot/alternative_slot_repository.dart';
import '../pets/owner_pet.dart';
import '../pets/owner_pet_repository.dart';
import '../pets/owner_pets_page.dart';
import '../../presentation/pages/owner_adaptive_shell.dart';

class OwnerJourneyPage extends StatefulWidget {
  const OwnerJourneyPage({
    super.key,
    required this.onBrowseClinics,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
    required this.onOpenCare,
    required this.petsRepository,
    required this.appointmentsRepository,
    required this.alternativeSlotRepository,
    required this.selectedPet,
    required this.onPetSelected,
  });

  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;
  final VoidCallback onOpenCare;
  final OwnerPetRepository petsRepository;
  final OwnerAppointmentsRepository appointmentsRepository;
  final AlternativeSlotRepository alternativeSlotRepository;
  final OwnerPet? selectedPet;
  final ValueChanged<OwnerPet> onPetSelected;

  @override
  State<OwnerJourneyPage> createState() => _OwnerJourneyPageState();
}

class _OwnerJourneyPageState extends State<OwnerJourneyPage> {
  int _index = 0;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home),
        label: 'Главная'),
    NavigationDestination(
        icon: Icon(Icons.calendar_month_outlined),
        selectedIcon: Icon(Icons.calendar_month),
        label: 'Записи'),
    NavigationDestination(
        icon: Icon(Icons.pets_outlined),
        selectedIcon: Icon(Icons.pets),
        label: 'Питомец'),
    NavigationDestination(
        icon: Icon(Icons.video_call_outlined),
        selectedIcon: Icon(Icons.video_call),
        label: 'Онлайн'),
  ];

  @override
  void initState() {
    super.initState();
    registerOwnerE2EHook('openHome', () => _selectTab(0));
    registerOwnerE2EHook('openAppointments', () => _selectTab(1));
    registerOwnerE2EHook('openPet', () => _selectTab(2));
    registerOwnerE2EHook('openOnline', () => _selectTab(3));
  }

  @override
  void dispose() {
    unregisterOwnerE2EHook('openHome');
    unregisterOwnerE2EHook('openAppointments');
    unregisterOwnerE2EHook('openPet');
    unregisterOwnerE2EHook('openOnline');
    super.dispose();
  }

  void _selectTab(int index) {
    if (!mounted) return;
    setState(() => _index = index);
  }

  @override
  Widget build(BuildContext context) {
    if (Theme.of(context).platform == TargetPlatform.iOS) {
      return OwnerAdaptiveShell(
        home: _homeBody(),
        clinics: _ClinicsLanding(onBrowseClinics: widget.onBrowseClinics),
        appointments: OwnerAppointmentsPage(
          repository: widget.appointmentsRepository,
          alternativeSlotRepository: widget.alternativeSlotRepository,
        ),
        pets: OwnerPetsPage(
          repository: widget.petsRepository,
          onPetSelected: widget.onPetSelected,
        ),
        profile: const _OwnerProfileLanding(),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('VetHelp'),
        actions: [
          IconButton(
            tooltip: 'Уведомления',
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text(
                      'Уведомления появятся здесь после входа по номеру телефона.')),
            ),
            icon: const Icon(Icons.notifications_none),
          ),
        ],
      ),
      body: SafeArea(child: _body()),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _selectTab,
        destinations: _destinations,
      ),
    );
  }

  Widget _homeBody() => _OwnerHome(
        selectedPet: widget.selectedPet,
        appointmentsRepository: widget.appointmentsRepository,
        onBrowseClinics: widget.onBrowseClinics,
        onManagePets: () => setState(() => _index = 2),
        onOpenAppointments: () => setState(() => _index = 1),
        onOpenCare: widget.onOpenCare,
        onRequestTelemed: widget.onRequestTelemed,
        onRequestInsurance: widget.onRequestInsurance,
        onRequestEmergency: widget.onRequestEmergency,
      );

  Widget _body() => switch (_index) {
        0 => _homeBody(),
        1 => OwnerAppointmentsPage(
            repository: widget.appointmentsRepository,
            alternativeSlotRepository: widget.alternativeSlotRepository,
          ),
        2 => OwnerPetsPage(
            repository: widget.petsRepository,
            onPetSelected: (pet) {
              widget.onPetSelected(pet);
              setState(() {
                _index = 0;
              });
            },
          ),
        3 => _TelemedLanding(onRequestTelemed: widget.onRequestTelemed),
        _ => const SizedBox.shrink(),
      };
}

class _ClinicsLanding extends StatelessWidget {
  const _ClinicsLanding({required this.onBrowseClinics});

  final VoidCallback onBrowseClinics;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Клиники', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text(
              'Выберите клинику, услугу и удобное время для очного визита.'),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: onBrowseClinics,
            icon: const Icon(Icons.search),
            label: const Text('Найти клинику'),
          ),
        ],
      );
}

class _OwnerProfileLanding extends StatelessWidget {
  const _OwnerProfileLanding();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Профиль', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text(
              'Личные данные, уведомления и настройки аккаунта появятся в следующих шагах.'),
        ],
      );
}

class _OwnerHome extends StatefulWidget {
  const _OwnerHome({
    required this.selectedPet,
    required this.appointmentsRepository,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onOpenAppointments,
    required this.onOpenCare,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
  });

  final OwnerPet? selectedPet;
  final OwnerAppointmentsRepository appointmentsRepository;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onOpenAppointments;
  final VoidCallback onOpenCare;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;

  @override
  State<_OwnerHome> createState() => _OwnerHomeState();
}

class _OwnerHomeState extends State<_OwnerHome> {
  Future<List<OwnerAppointment>>? _appointmentsRequest;

  @override
  void initState() {
    super.initState();
    _reloadAppointments();
  }

  void _reloadAppointments() {
    setState(() {
      _appointmentsRequest = widget.appointmentsRepository.list();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final pet = widget.selectedPet;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Помощь питомцу — в одном месте',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
            'Запись, онлайн-консультация, страховая проверка и история питомца.',
            style: Theme.of(context).textTheme.bodyLarge),
        const SizedBox(height: 24),
        Card(
          color: colors.errorContainer,
          child: ListTile(
            leading: const Icon(Icons.warning_amber_rounded),
            title: const Text('Срочная помощь'),
            subtitle: const Text(
                'Покажем проверенные клиники, которые принимают срочные случаи сейчас.'),
            trailing: const Icon(Icons.chevron_right),
            onTap: widget.onRequestEmergency,
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: colors.primaryContainer,
          child: InkWell(
            onTap: pet == null ? widget.onManagePets : widget.onBrowseClinics,
            borderRadius: BorderRadius.circular(12),
            child: Semantics(
              button: true,
              label: pet == null
                  ? 'Добавить питомца для записи'
                  : 'Найти клинику для записи',
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.search, size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Найти клинику',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text(pet == null
                              ? 'Сначала добавьте питомца, затем выберите клинику, услугу и время.'
                              : 'Выберите клинику, услугу и ближайшее доступное время для ${pet.name}.'),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: colors.tertiaryContainer,
          child: InkWell(
            onTap: widget.onRequestInsurance,
            borderRadius: BorderRadius.circular(12),
            child: Semantics(
              button: true,
              label: 'Открыть проверку страхового покрытия',
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 32),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Страховое покрытие'),
                          SizedBox(height: 4),
                          Text('Проверьте покрытие после согласия владельца.'),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        _ActiveAppointmentsPreview(
          request: _appointmentsRequest,
          selectedPet: pet,
          onRetry: _reloadAppointments,
          onBrowseClinics: widget.onBrowseClinics,
          onManagePets: widget.onManagePets,
          onOpenAppointments: widget.onOpenAppointments,
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.pets)),
            title: Text(pet?.name ?? 'Питомец ещё не добавлен'),
            subtitle: Text(pet == null
                ? 'Добавьте питомца перед записью.'
                : 'Выбран для новой записи.'),
            trailing: const Icon(Icons.chevron_right),
            onTap: widget.onManagePets,
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: colors.surfaceContainerHigh,
          child: InkWell(
            onTap: pet == null ? widget.onManagePets : widget.onOpenCare,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.health_and_safety_outlined, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Медицинская карта',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 4),
                        Text(pet == null
                            ? 'Добавьте питомца, чтобы видеть профиль здоровья, документы и историю помощи.'
                            : 'Профиль здоровья, документы и история помощи для ${pet.name}.'),
                        const SizedBox(height: 8),
                        Text('Данные берутся из профиля и записей VetHelp',
                            style: Theme.of(context).textTheme.labelMedium),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: colors.tertiaryContainer,
          child: InkWell(
            onTap: widget.onRequestInsurance,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.shield_outlined, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Страховое покрытие',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 4),
                        const Text(
                            'Проверьте покрытие у партнёра после согласия владельца.'),
                        const SizedBox(height: 8),
                        Text('Статус приходит от страхового партнёра',
                            style: Theme.of(context).textTheme.labelMedium),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: colors.secondaryContainer,
          child: InkWell(
            onTap: widget.onRequestTelemed,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.video_call_outlined, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Ветеринар онлайн',
                            style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 4),
                        const Text(
                            'Опишите вопрос, приложите файлы и получите следующий безопасный шаг.'),
                        const SizedBox(height: 8),
                        Text('От 790 ₽ · после подтверждения оплаты',
                            style: Theme.of(context).textTheme.labelMedium),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActiveAppointmentsPreview extends StatelessWidget {
  const _ActiveAppointmentsPreview({
    required this.request,
    required this.selectedPet,
    required this.onRetry,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onOpenAppointments,
  });

  final Future<List<OwnerAppointment>>? request;
  final OwnerPet? selectedPet;
  final VoidCallback onRetry;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onOpenAppointments;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<List<OwnerAppointment>>(
          future: request,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                height: 96,
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              return _ActiveAppointmentsError(onRetry: onRetry);
            }
            final active = (snapshot.data ?? const <OwnerAppointment>[])
                .where((appointment) => appointment.bucket == 'ACTIVE')
                .take(2)
                .toList(growable: false);
            if (active.isEmpty) {
              return _ActiveAppointmentsEmpty(
                selectedPet: selectedPet,
                onBrowseClinics: onBrowseClinics,
                onManagePets: onManagePets,
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 28),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('Активные записи',
                          style: Theme.of(context).textTheme.titleMedium),
                    ),
                    TextButton(
                        onPressed: onOpenAppointments,
                        child: const Text('Все')),
                  ],
                ),
                const SizedBox(height: 10),
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: active.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) =>
                      _ActiveAppointmentRow(appointment: active[index]),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ActiveAppointmentsEmpty extends StatelessWidget {
  const _ActiveAppointmentsEmpty({
    required this.selectedPet,
    required this.onBrowseClinics,
    required this.onManagePets,
  });

  final OwnerPet? selectedPet;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;

  @override
  Widget build(BuildContext context) {
    final pet = selectedPet;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.calendar_today_outlined, size: 32),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Активных записей нет',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(pet == null
                  ? 'Сначала добавьте питомца: запись всегда создаётся для конкретного владельца и питомца.'
                  : 'Питомец для новой записи: ${pet.name}. Выберите клинику и время.'),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: pet == null ? onManagePets : onBrowseClinics,
                icon: Icon(pet == null ? Icons.pets : Icons.search),
                label: Text(pet == null ? 'Добавить питомца' : 'Найти клинику'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ActiveAppointmentsError extends StatelessWidget {
  const _ActiveAppointmentsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Не удалось обновить записи',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              const Text('Проверьте подключение и повторите попытку.'),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Повторить'),
              ),
            ]),
          ),
        ],
      );
}

class _ActiveAppointmentRow extends StatelessWidget {
  const _ActiveAppointmentRow({required this.appointment});

  final OwnerAppointment appointment;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.event_available_outlined),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(appointment.clinicName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    '${appointment.petName} · ${_appointmentRange(context, appointment)}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _appointmentRange(BuildContext context, OwnerAppointment appointment) {
  final date =
      MaterialLocalizations.of(context).formatMediumDate(appointment.startsAt);
  final start = TimeOfDay.fromDateTime(appointment.startsAt).format(context);
  final end = TimeOfDay.fromDateTime(appointment.endsAt).format(context);
  return '$date, $start–$end';
}

class _TelemedLanding extends StatelessWidget {
  const _TelemedLanding({required this.onRequestTelemed});
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Ветеринар онлайн',
              style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text(
              'Для стабильного состояния: вопросы по симптомам, анализам, назначениям и контроль после визита.'),
          const SizedBox(height: 20),
          const Card(
            child: ListTile(
              leading: Icon(Icons.health_and_safety_outlined),
              title: Text('Важно'),
              subtitle: Text(
                  'При судорогах, потере сознания, тяжёлом дыхании, сильном кровотечении или выраженной боли выбирайте очную срочную помощь.'),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
              onPressed: onRequestTelemed,
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Описать вопрос')),
        ],
      );
}
