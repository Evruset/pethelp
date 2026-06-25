import 'package:flutter/material.dart';

/// Initial owner-facing shell for the unified VetHelp journey.
///
/// This view contains no optimistic booking or payment state: every
/// irreversible action continues to the authoritative backend flow.
class OwnerJourneyPage extends StatefulWidget {
  const OwnerJourneyPage({
    super.key,
    required this.onBrowseClinics,
    required this.onRequestTelemed,
  });

  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;

  @override
  State<OwnerJourneyPage> createState() => _OwnerJourneyPageState();
}

class _OwnerJourneyPageState extends State<OwnerJourneyPage> {
  int _index = 0;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: 'Главная',
    ),
    NavigationDestination(
      icon: Icon(Icons.calendar_month_outlined),
      selectedIcon: Icon(Icons.calendar_month),
      label: 'Записи',
    ),
    NavigationDestination(
      icon: Icon(Icons.pets_outlined),
      selectedIcon: Icon(Icons.pets),
      label: 'Питомец',
    ),
    NavigationDestination(
      icon: Icon(Icons.video_call_outlined),
      selectedIcon: Icon(Icons.video_call),
      label: 'Онлайн',
    ),
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
              const SnackBar(
                content: Text('Уведомления появятся здесь после входа по номеру телефона.'),
              ),
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

  Widget _body() {
    switch (_index) {
      case 0:
        return _OwnerHome(
          onBrowseClinics: widget.onBrowseClinics,
          onRequestTelemed: widget.onRequestTelemed,
        );
      case 1:
        return const _AppointmentsPlaceholder();
      case 2:
        return const _PetPlaceholder();
      case 3:
        return _TelemedLanding(onRequestTelemed: widget.onRequestTelemed);
      default:
        return const SizedBox.shrink();
    }
  }
}

class _OwnerHome extends StatelessWidget {
  const _OwnerHome({
    required this.onBrowseClinics,
    required this.onRequestTelemed,
  });

  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Помощь питомцу — в одном месте',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
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
                      Text(
                        'Ближайшая запись',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Пока нет активных записей. Выберите клинику и время, чтобы создать заявку.',
                      ),
                      const SizedBox(height: 12),
                      FilledButton.tonalIcon(
                        onPressed: onBrowseClinics,
                        icon: const Icon(Icons.search),
                        label: const Text('Найти клинику'),
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
                        Text(
                          'Ветеринар онлайн',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Опишите вопрос, приложите файлы и получите следующий безопасный шаг.',
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'От 790 ₽ · после подтверждения оплаты',
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text('Питомцы', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        const Card(
          child: ListTile(
            leading: CircleAvatar(child: Icon(Icons.pets)),
            title: Text('Добавьте питомца'),
            subtitle: Text('Карточка питомца создаётся после входа по номеру телефона.'),
          ),
        ),
      ],
    );
  }
}

class _AppointmentsPlaceholder extends StatelessWidget {
  const _AppointmentsPlaceholder();

  @override
  Widget build(BuildContext context) => const _EmptyState(
        icon: Icons.event_available_outlined,
        title: 'Здесь появятся ваши записи',
        text: 'Статус каждой записи будет приходить с сервера VetHelp.',
      );
}

class _PetPlaceholder extends StatelessWidget {
  const _PetPlaceholder();

  @override
  Widget build(BuildContext context) => const _EmptyState(
        icon: Icons.pets_outlined,
        title: 'Карточка питомца',
        text: 'Имя, вид, возраст, аллергии и история будут доступны после входа.',
      );
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
        const Text(
          'Для стабильного состояния: вопросы по симптомам, анализам, назначениям и контроль после визита.',
        ),
        const SizedBox(height: 20),
        const Card(
          child: ListTile(
            leading: Icon(Icons.health_and_safety_outlined),
            title: Text('Важно'),
            subtitle: Text(
              'При судорогах, потере сознания, тяжёлом дыхании, сильном кровотечении или выраженной боли выбирайте очную срочную помощь.',
            ),
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

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48),
              const SizedBox(height: 12),
              Text(title, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(text, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}
