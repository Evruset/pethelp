import 'package:flutter/material.dart';

import 'features/booking/marketplace/booking_marketplace_page.dart';
import 'features/booking/marketplace/booking_marketplace_repository.dart';
import 'features/owner_journey/owner_journey_page.dart';
import 'features/owner_journey/phone_entry_page.dart';

void main() {
  runApp(const VetHelpOwnerJourneyApp());
}

class VetHelpOwnerJourneyApp extends StatelessWidget {
  const VetHelpOwnerJourneyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VetHelp',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      home: const OwnerJourneyEntry(),
    );
  }
}

class OwnerJourneyEntry extends StatefulWidget {
  const OwnerJourneyEntry({super.key});

  @override
  State<OwnerJourneyEntry> createState() => _OwnerJourneyEntryState();
}

class _OwnerJourneyEntryState extends State<OwnerJourneyEntry> {
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

  bool get _hasLocalOwner => _ownerJwt.isNotEmpty;
  bool get _canCreateBooking => _hasLocalOwner && _demoLocationId.isNotEmpty;

  Future<String> _token() async {
    if (_ownerJwt.isEmpty) {
      throw StateError('Owner access token is unavailable.');
    }
    return _ownerJwt;
  }

  @override
  Widget build(BuildContext context) {
    if (_hasLocalOwner) {
      return OwnerJourneyPage(
        onBrowseClinics: _openBooking,
        onRequestTelemed: _openTelemedIntake,
      );
    }
    return _GuestStartPage(
      onOpenPhoneEntry: _openPhoneEntry,
      onBrowseClinics: _openPhoneEntry,
      onRequestTelemed: _openPhoneEntry,
    );
  }

  void _openPhoneEntry() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => PhoneEntryPage(onBack: () => Navigator.of(context).pop()),
    ));
  }

  void _openBooking() {
    if (!_canCreateBooking) {
      _showMessage(
        'Выбор клиники будет подключён к публичному каталогу. Для local smoke передайте VETHELP_DEMO_LOCATION_ID.',
      );
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

  void _openTelemedIntake() {
    _showMessage(
      'Экран создания телемедицинского обращения будет подключён к серверному payment/session flow. Нельзя создавать сессию или показывать оплату только локально.',
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _GuestStartPage extends StatelessWidget {
  const _GuestStartPage({
    required this.onOpenPhoneEntry,
    required this.onBrowseClinics,
    required this.onRequestTelemed,
  });

  final VoidCallback onOpenPhoneEntry;
  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('VetHelp'),
        actions: [
          TextButton(onPressed: onOpenPhoneEntry, child: const Text('Войти')),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Помощь питомцу без лишних звонков', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text('Начните без регистрации. Номер телефона потребуется только для сохранения обращения, записи или оплаты консультации.'),
            const SizedBox(height: 24),
            Card(
              color: colors.errorContainer,
              child: const ListTile(
                leading: Icon(Icons.warning_amber_rounded),
                title: Text('Нужна срочная помощь'),
                subtitle: Text('При тяжёлых симптомах не ждите онлайн-ответ: выбирайте очную срочную помощь.'),
              ),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.video_call_outlined,
              title: 'Ветеринар онлайн',
              subtitle: 'Оценка состояния, разбор анализов и следующий безопасный шаг.',
              badge: 'От 790 ₽',
              color: colors.secondaryContainer,
              onTap: onRequestTelemed,
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.calendar_month_outlined,
              title: 'Записаться в клинику',
              subtitle: 'Клиника, услуга и время. Финальный статус всегда подтверждает сервер.',
              badge: 'Запись',
              color: colors.primaryContainer,
              onTap: onBrowseClinics,
            ),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                enabled: false,
                leading: const Icon(Icons.shield_outlined),
                title: const Text('Страховка питомца'),
                subtitle: const Text('Скоро: полисы и проверка покрытия визита.'),
                trailing: Chip(label: const Text('Скоро')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String badge;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, size: 32),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(subtitle),
                    const SizedBox(height: 8),
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
