import 'package:flutter/material.dart';

import '../appointments/owner_appointments_page.dart';
import '../appointments/owner_appointments_repository.dart';
import '../booking/marketplace/booking_marketplace_repository.dart';
import '../pets/owner_pet.dart';
import '../pets/owner_pet_repository.dart';
import '../pets/owner_pets_page.dart';

class OwnerJourneyPage extends StatefulWidget {
  const OwnerJourneyPage({
    super.key,
    required this.onBrowseClinics,
    required this.onRequestTelemed,
    required this.petsRepository,
    required this.appointmentsRepository,
    required this.bookingRepository,
    required this.selectedPet,
    required this.onPetSelected,
  });

  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;
  final OwnerPetRepository petsRepository;
  final OwnerAppointmentsRepository appointmentsRepository;
  final BookingMarketplaceRepository bookingRepository;
  final OwnerPet? selectedPet;
  final ValueChanged<OwnerPet> onPetSelected;

  @override
  State<OwnerJourneyPage> createState() => _OwnerJourneyPageState();
}

class _OwnerJourneyPageState extends State<OwnerJourneyPage> {
  int _index = 0;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Главная'),
    NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Записи'),
    NavigationDestination(icon: Icon(Icons.pets_outlined), selectedIcon: Icon(Icons.pets), label: 'Питомец'),
    NavigationDestination(icon: Icon(Icons.video_call_outlined), selectedIcon: Icon(Icons.video_call), label: 'Онлайн'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('VetHelp'),
        actions: [
          IconButton(
            tooltip: 'Уведомления',
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Уведомления появятся здесь после входа по номеру телефона.')),
            ),
            icon: const Icon(Icons.notifications_none),
          ),
        ],
      ),
      body: SafeArea(child: _body()),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: _destinations,
      ),
    );
  }

  Widget _body() => switch (_index) {
        0 => _OwnerHome(
            selectedPet: widget.selectedPet,
            onBrowseClinics: widget.onBrowseClinics,
            onManagePets: () => setState(() => _index = 2),
            onRequestTelemed: widget.onRequestTelemed,
          ),
        1 => OwnerAppointmentsPage(
            repository: widget.appointmentsRepository,
            statusRepository: widget.bookingRepository,
          ),
        2 => OwnerPetsPage(
            repository: widget.petsRepository,
            onPetSelected: (pet) {
              widget.onPetSelected(pet);
              setState(() => _index = 0);
            },
          ),
        3 => _TelemedLanding(onRequestTelemed: widget.onRequestTelemed),
        _ => const SizedBox.shrink(),
      };
}

class _OwnerHome extends StatelessWidget {
  const _OwnerHome({
    required this.selectedPet,
    required this.onBrowseClinics,
    required this.onManagePets,
    required this.onRequestTelemed,
  });

  final OwnerPet? selectedPet;
  final VoidCallback onBrowseClinics;
  final VoidCallback onManagePets;
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final pet = selectedPet;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Помощь питомцу — в одном месте', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'Запись, онлайн-консультация и история питомца. Страховой контур появится после подключения партнёров.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 24),
        Card(
          color: colors.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.calendar_today_outlined, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Ближайшая запись', style: Theme.of(context).textTheme.titleMedium),
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
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.pets)),
            title: Text(pet?.name ?? 'Питомец ещё не добавлен'),
            subtitle: Text(pet == null ? 'Добавьте питомца перед записью.' : 'Выбран для новой записи.'),
            trailing: const Icon(Icons.chevron_right),
            onTap: onManagePets,
          ),
        ),
        const SizedBox(height: 12),
        Card(
          color: colors.secondaryContainer,
          child: InkWell(
            onTap: onRequestTelemed,
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
                        Text('Ветеринар онлайн', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 4),
                        const Text('Опишите вопрос, приложите файлы и получите следующий безопасный шаг.'),
                        const SizedBox(height: 8),
                        Text('От 790 ₽ · после подтверждения оплаты', style: Theme.of(context).textTheme.labelMedium),
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

class _TelemedLanding extends StatelessWidget {
  const _TelemedLanding({required this.onRequestTelemed});
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Ветеринар онлайн', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text('Для стабильного состояния: вопросы по симптомам, анализам, назначениям и контроль после визита.'),
        const SizedBox(height: 20),
        const Card(
          child: ListTile(
            leading: Icon(Icons.health_and_safety_outlined),
            title: Text('Важно'),
            subtitle: Text('При судорогах, потере сознания, тяжёлом дыхании, сильном кровотечении или выраженной боли выбирайте очную срочную помощь.'),
          ),
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: onRequestTelemed,
          icon: const Icon(Icons.arrow_forward),
          label: const Text('Описать вопрос'),
        ),
      ],
    );
  }
}
