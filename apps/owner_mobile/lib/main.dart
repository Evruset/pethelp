import 'package:flutter/material.dart';

import 'features/booking/alternative_slot/alternative_slot_page.dart';
import 'features/booking/alternative_slot/alternative_slot_repository.dart';
import 'features/booking/marketplace/booking_marketplace_page.dart';
import 'features/booking/marketplace/booking_marketplace_repository.dart';
import 'features/telemed/waiting_room/telemed_waiting_room_page.dart';
import 'features/telemed/waiting_room/telemed_waiting_room_repository.dart';

void main() {
  runApp(const VetHelpOwnerApp());
}

class VetHelpOwnerApp extends StatelessWidget {
  const VetHelpOwnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VetHelp',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      home: const OwnerJourneyLauncher(),
    );
  }
}

class OwnerJourneyLauncher extends StatefulWidget {
  const OwnerJourneyLauncher({super.key});

  @override
  State<OwnerJourneyLauncher> createState() => _OwnerJourneyLauncherState();
}

class _OwnerJourneyLauncherState extends State<OwnerJourneyLauncher> {
  final _idController = TextEditingController();
  final _apiBaseUrl = const String.fromEnvironment(
    'VETHELP_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
  final _ownerJwt = const String.fromEnvironment('VETHELP_OWNER_JWT');
  final _demoLocationId = const String.fromEnvironment('VETHELP_DEMO_LOCATION_ID');
  final _demoPetId = const String.fromEnvironment(
    'VETHELP_DEMO_PET_ID',
    defaultValue: '22222222-2222-4222-8222-222222222222',
  );
  final _demoClinicName = const String.fromEnvironment(
    'VETHELP_DEMO_CLINIC_NAME',
    defaultValue: 'VetHelp Pilot',
  );
  final _demoPetName = const String.fromEnvironment(
    'VETHELP_DEMO_PET_NAME',
    defaultValue: 'Питомец',
  );

  @override
  void dispose() {
    _idController.dispose();
    super.dispose();
  }

  Future<String> _token() async {
    if (_ownerJwt.isEmpty) {
      throw StateError('Provide VETHELP_OWNER_JWT only for local development.');
    }
    return _ownerJwt;
  }

  bool get _canOpenMarketplace => _ownerJwt.isNotEmpty && _demoLocationId.isNotEmpty;

  void _openMarketplace() {
    if (!_canOpenMarketplace) {
      _showLocalSetup();
      return;
    }
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => BookingMarketplacePage(
        clinicName: _demoClinicName,
        petName: _demoPetName,
        clinicLocationId: _demoLocationId,
        petId: _demoPetId,
        repository: HttpBookingMarketplaceRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
      ),
    ));
  }

  void _openAlternative() {
    final holdId = _idController.text.trim();
    if (holdId.isEmpty) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => AlternativeSlotPage(
        holdId: holdId,
        repository: AlternativeSlotRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
      ),
    ));
  }

  void _openTelemed() {
    final sessionId = _idController.text.trim();
    if (sessionId.isEmpty) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => TelemedWaitingRoomPage(
        sessionId: sessionId,
        repository: HttpTelemedWaitingRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
      ),
    ));
  }

  void _showLocalSetup() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Нужно подключить local demo'),
        content: const Text(
          'Для записи передайте VETHELP_OWNER_JWT и VETHELP_DEMO_LOCATION_ID через --dart-define. '
          'В production эти значения будут приходить из авторизованного профиля и каталога клиник.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Понятно'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('VetHelp')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Поможем питомцу', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Выберите подходящий следующий шаг. VetHelp покажет только подтверждённые статусы.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            _JourneyCard(
              icon: Icons.video_call_outlined,
              title: 'Онлайн-консультация',
              subtitle: 'Быстрый контакт с ветеринаром и статус ожидания в реальном времени.',
              badge: 'Телемедицина',
              accentColor: colorScheme.primaryContainer,
              onTap: () => _showUnavailable('Онлайн-консультация откроется после создания обращения.'),
            ),
            const SizedBox(height: 12),
            _JourneyCard(
              icon: Icons.calendar_month_outlined,
              title: 'Записаться в клинику',
              subtitle: 'Выберите время — затем VetHelp подтвердит результат через клинику.',
              badge: 'Запись',
              accentColor: colorScheme.secondaryContainer,
              onTap: _openMarketplace,
            ),
            const SizedBox(height: 12),
            _JourneyCard(
              icon: Icons.shield_outlined,
              title: 'Страховое покрытие',
              subtitle: 'Проверка полиса и покрытия будет доступна после подключения страховщика.',
              badge: 'Страховка',
              accentColor: colorScheme.tertiaryContainer,
              onTap: () => _showUnavailable('Страховой контур готовится к подключению provider API.'),
            ),
            const SizedBox(height: 28),
            ExpansionTile(
              title: const Text('Инструменты local development'),
              subtitle: const Text('Альтернативный слот и ожидание телемедицины'),
              childrenPadding: const EdgeInsets.fromLTRB(0, 8, 0, 8),
              children: [
                TextField(
                  controller: _idController,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Hold или session UUID',
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _openAlternative,
                        child: const Text('Альтернатива'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _openTelemed,
                        child: const Text('Телемедицина'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('API: $_apiBaseUrl', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  void _showUnavailable(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _JourneyCard extends StatelessWidget {
  const _JourneyCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.accentColor,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String badge;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      color: accentColor,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, size: 32),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(subtitle),
                    const SizedBox(height: 10),
                    Chip(label: Text(badge), visualDensity: VisualDensity.compact),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}
