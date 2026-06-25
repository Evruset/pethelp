import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'features/auth/owner_auth_repository.dart';
import 'features/auth/owner_session.dart';
import 'features/booking/marketplace/booking_marketplace_page.dart';
import 'features/booking/marketplace/booking_marketplace_repository.dart';
import 'features/catalog/catalog_models.dart';
import 'features/catalog/public_catalog_page.dart';
import 'features/catalog/public_catalog_repository.dart';
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
  static const _configuredApiBaseUrl = String.fromEnvironment('VETHELP_API_BASE_URL');
  final _bootstrapOwnerJwt = const String.fromEnvironment('VETHELP_OWNER_JWT');
  final _demoPetId = const String.fromEnvironment(
    'VETHELP_DEMO_PET_ID',
    defaultValue: '22222222-2222-4222-8222-222222222222',
  );
  final _demoPetName = const String.fromEnvironment(
    'VETHELP_DEMO_PET_NAME',
    defaultValue: 'Питомец',
  );

  OwnerSession? _session;
  CatalogLocation? _pendingLocation;

  String get _apiBaseUrl {
    if (_configuredApiBaseUrl.isNotEmpty) return _configuredApiBaseUrl;
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return 'http://127.0.0.1:3000';
    return 'http://10.0.2.2:3000';
  }

  String get _accessToken => _session?.accessToken ?? _bootstrapOwnerJwt;
  bool get _hasOwnerSession => _accessToken.isNotEmpty;

  Future<String> _token() async {
    if (_accessToken.isEmpty) {
      throw StateError('Owner access token is unavailable.');
    }
    return _accessToken;
  }

  @override
  Widget build(BuildContext context) {
    if (_hasOwnerSession) {
      return OwnerJourneyPage(
        onBrowseClinics: _openCatalogForOwner,
        onRequestTelemed: _openTelemedIntake,
      );
    }
    return _GuestStartPage(
      onOpenPhoneEntry: _openPhoneEntry,
      onBrowseClinics: _openCatalogForGuest,
      onRequestTelemed: _openPhoneEntry,
    );
  }

  void _openPhoneEntry() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => PhoneEntryPage(
        onBack: () => Navigator.of(context).pop(),
        repository: HttpOwnerAuthRepository(baseUrl: Uri.parse(_apiBaseUrl)),
        onAuthenticated: _completeAuthentication,
      ),
    ));
  }

  void _completeAuthentication(OwnerSession session) {
    final pendingLocation = _pendingLocation;
    setState(() {
      _session = session;
      _pendingLocation = null;
    });
    Navigator.of(context).popUntil((route) => route.isFirst);
    if (pendingLocation != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openBooking(pendingLocation);
      });
    }
  }

  void _openCatalogForGuest() {
    _openCatalog(onSelected: (location) {
      setState(() => _pendingLocation = location);
      Navigator.of(context).pop();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showMessage('Подтвердите номер телефона, чтобы записать питомца в ${location.clinicName}.');
        _openPhoneEntry();
      });
    });
  }

  void _openCatalogForOwner() {
    _openCatalog(onSelected: (location) {
      Navigator.of(context).pop();
      _openBooking(location);
    });
  }

  void _openCatalog({required ValueChanged<CatalogLocation> onSelected}) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => PublicCatalogPage(
        repository: HttpPublicCatalogRepository(baseUrl: Uri.parse(_apiBaseUrl)),
        onSelected: onSelected,
      ),
    ));
  }

  void _openBooking(CatalogLocation location) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => BookingMarketplacePage(
        clinicName: location.clinicName,
        petName: _demoPetName,
        clinicLocationId: location.locationId,
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
              subtitle: 'Выберите клинику и время. Финальный статус всегда подтверждает сервер.',
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
