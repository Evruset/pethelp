import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'features/appointments/owner_appointments_repository.dart';
import 'features/auth/owner_auth_repository.dart';
import 'features/auth/owner_session.dart';
import 'features/booking/alternative_slot/alternative_slot_repository.dart';
import 'features/booking/marketplace/booking_marketplace_page.dart';
import 'features/booking/marketplace/booking_marketplace_repository.dart';
import 'features/catalog/catalog_models.dart';
import 'features/catalog/public_catalog_page.dart';
import 'features/catalog/public_catalog_repository.dart';
import 'features/emergency/emergency_page.dart';
import 'features/emergency/emergency_repository.dart';
import 'features/insurance/coverage_check_page.dart';
import 'features/insurance/coverage_check_repository.dart';
import 'features/owner_journey/owner_journey_page.dart';
import 'features/owner_journey/phone_entry_page.dart';
import 'features/pets/owner_pet.dart';
import 'features/pets/owner_pet_repository.dart';
import 'features/telemed/owner_telemed_page.dart';
import 'features/telemed/owner_telemed_repository.dart';
import 'features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'features/telemed/waiting_room/telemed_waiting_room_repository.dart';
import 'ui/vethelp_ios_theme.dart';

void main() => runApp(const VetHelpOwnerJourneyApp());

class VetHelpOwnerJourneyApp extends StatelessWidget {
  const VetHelpOwnerJourneyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'VetHelp',
        theme: VetHelpTheme.light(),
        builder: VetHelpTheme.frameBuilder,
        locale: const Locale('ru'),
        supportedLocales: const [Locale('ru'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: const OwnerJourneyEntry(),
      );
}

class OwnerJourneyEntry extends StatefulWidget {
  const OwnerJourneyEntry({super.key});
  @override
  State<OwnerJourneyEntry> createState() => _OwnerJourneyEntryState();
}

class _OwnerJourneyEntryState extends State<OwnerJourneyEntry> {
  static const _configuredApiBaseUrl =
      String.fromEnvironment('VETHELP_API_BASE_URL');
  final _bootstrapOwnerJwt = const String.fromEnvironment('VETHELP_OWNER_JWT');
  OwnerSession? _session;
  OwnerPet? _selectedPet;
  CatalogBookingSelection? _pendingBooking;
  bool _petBootstrapInFlight = false;
  bool _petBootstrapCompleted = false;

  String get _apiBaseUrl => _configuredApiBaseUrl.isNotEmpty
      ? _configuredApiBaseUrl
      : (kIsWeb || defaultTargetPlatform != TargetPlatform.android)
          ? 'http://127.0.0.1:3000'
          : 'http://10.0.2.2:3000';
  String get _accessToken => _session?.accessToken ?? _bootstrapOwnerJwt;
  bool get _hasOwnerSession => _accessToken.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_bootstrapOwnerJwt.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _selectExistingPet();
      });
    }
  }

  Future<String> _token() async {
    if (_accessToken.isEmpty) {
      throw StateError('Owner access token is unavailable.');
    }
    return _accessToken;
  }

  Future<void> _selectExistingPet() async {
    if (!_hasOwnerSession ||
        _selectedPet != null ||
        _petBootstrapInFlight ||
        _petBootstrapCompleted) {
      return;
    }

    _petBootstrapInFlight = true;
    try {
      final pets = await HttpOwnerPetRepository(
        baseUrl: Uri.parse(_apiBaseUrl),
        accessToken: _token,
      ).list();
      if (!mounted || _selectedPet != null || pets.isEmpty) return;
      setState(() {
        _selectedPet = pets.first;
      });
    } finally {
      _petBootstrapInFlight = false;
      _petBootstrapCompleted = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_hasOwnerSession) {
      return OwnerJourneyPage(
        onBrowseClinics: _openCatalogForOwner,
        onRequestTelemed: _openTelemedIntake,
        onRequestInsurance: _openInsuranceCheck,
        onRequestEmergency: _openEmergency,
        petsRepository: HttpOwnerPetRepository(
            baseUrl: Uri.parse(_apiBaseUrl), accessToken: _token),
        appointmentsRepository: HttpOwnerAppointmentsRepository(
            baseUrl: Uri.parse(_apiBaseUrl), accessToken: _token),
        alternativeSlotRepository: AlternativeSlotRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
        selectedPet: _selectedPet,
        onPetSelected: _selectPet,
      );
    }
    return _GuestStartPage(
      onOpenPhoneEntry: _openPhoneEntry,
      onBrowseClinics: _openCatalogForGuest,
      onRequestTelemed: _openPhoneEntry,
      onRequestEmergency: _openEmergency,
    );
  }

  void _openPhoneEntry() => Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => PhoneEntryPage(
          onBack: () => Navigator.of(context).pop(),
          repository: HttpOwnerAuthRepository(baseUrl: Uri.parse(_apiBaseUrl)),
          onAuthenticated: _completeAuthentication,
        ),
      ));

  void _completeAuthentication(OwnerSession session) {
    final hasPendingBooking = _pendingBooking != null;
    setState(() {
      _session = session;
      _selectedPet = null;
      _petBootstrapCompleted = false;
    });
    Navigator.of(context).popUntil((route) => route.isFirst);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _selectExistingPet();
      if (hasPendingBooking && mounted) {
        _showMessage(
            'Добавьте или выберите питомца: запись всегда создаётся для конкретного питомца.');
      }
    });
  }

  void _selectPet(OwnerPet pet) {
    final pending = _pendingBooking;
    setState(() {
      _selectedPet = pet;
      _petBootstrapCompleted = true;
      _pendingBooking = null;
    });
    if (pending != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openBooking(pending);
      });
    }
  }

  void _openCatalogForGuest() => _openCatalog(onSelected: (selection) {
        setState(() {
          _pendingBooking = selection;
        });
        Navigator.of(context).pop();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _showMessage(
              'Подтвердите номер телефона, чтобы записать питомца в ${selection.location.clinicName}.');
          _openPhoneEntry();
        });
      });

  void _openCatalogForOwner() {
    if (_selectedPet == null) {
      _showMessage(
          'Сначала добавьте или выберите питомца на вкладке «Питомец».');
      return;
    }
    _openCatalog(onSelected: (selection) {
      Navigator.of(context).pop();
      _openBooking(selection);
    });
  }

  void _openCatalog(
          {required ValueChanged<CatalogBookingSelection> onSelected}) =>
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PublicCatalogPage(
            repository:
                HttpPublicCatalogRepository(baseUrl: Uri.parse(_apiBaseUrl)),
            onSelected: onSelected,
          ),
        ),
      );

  void _openBooking(CatalogBookingSelection selection) {
    final pet = _selectedPet;
    if (pet == null) {
      _showMessage('Для записи нужно выбрать питомца.');
      return;
    }
    final location = selection.location;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => BookingMarketplacePage(
        clinicName: location.clinicName,
        serviceName: selection.service.displayName,
        serviceId: selection.service.id,
        petName: pet.name,
        clinicLocationId: location.locationId,
        petId: pet.id,
        repository: HttpBookingMarketplaceRepository(
            baseUrl: Uri.parse(_apiBaseUrl), accessTokenProvider: _token),
      ),
    ));
  }

  void _openTelemedIntake() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => OwnerTelemedPage(
        repository: HttpOwnerTelemedRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
        waitingRepository: HttpTelemedWaitingRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
        roomAccessRepository: HttpTelemedRoomAccessRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
      ),
    ));
  }

  void _openInsuranceCheck() {
    final pet = _selectedPet;
    if (pet == null) {
      _showMessage(
          'Сначала добавьте или выберите питомца на вкладке «Питомец».');
      return;
    }
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => CoverageCheckPage(
        pet: pet,
        repository: CoverageCheckRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessTokenProvider: _token,
        ),
      ),
    ));
  }

  void _openEmergency() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => EmergencyPage(
        repository: EmergencyRepository(baseUrl: Uri.parse(_apiBaseUrl)),
      ),
    ));
  }

  void _showMessage(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}

class _GuestStartPage extends StatelessWidget {
  const _GuestStartPage(
      {required this.onOpenPhoneEntry,
      required this.onBrowseClinics,
      required this.onRequestTelemed,
      required this.onRequestEmergency});
  final VoidCallback onOpenPhoneEntry;
  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestEmergency;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('VetHelp'), actions: [
        TextButton(onPressed: onOpenPhoneEntry, child: const Text('Войти'))
      ]),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text('Помощь питомцу без лишних звонков',
                style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text(
                'Начните без регистрации. Номер телефона потребуется только для сохранения обращения, записи или оплаты консультации.'),
            const SizedBox(height: 24),
            Card(
              color: colors.errorContainer,
              child: ListTile(
                leading: const Icon(Icons.warning_amber_rounded),
                title: const Text('Нужна срочная помощь'),
                subtitle: const Text(
                    'При тяжёлых симптомах не ждите онлайн-ответ: выбирайте очную срочную помощь.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: onRequestEmergency,
              ),
            ),
            const SizedBox(height: 12),
            _ActionCard(
                icon: Icons.video_call_outlined,
                title: 'Ветеринар онлайн',
                subtitle:
                    'Оценка состояния, разбор анализов и следующий безопасный шаг.',
                badge: 'От 790 ₽',
                color: colors.secondaryContainer,
                onTap: onRequestTelemed),
            const SizedBox(height: 12),
            _ActionCard(
                icon: Icons.calendar_month_outlined,
                title: 'Записаться в клинику',
                subtitle:
                    'Выберите клинику и время. VetHelp покажет подтверждённый статус.',
                badge: 'Запись',
                color: colors.primaryContainer,
                onTap: onBrowseClinics),
            const SizedBox(height: 12),
            const Card(
                child: ListTile(
                    enabled: false,
                    leading: Icon(Icons.shield_outlined),
                    title: Text('Страховка питомца'),
                    subtitle: Text('Скоро: полисы и проверка покрытия визита.'),
                    trailing: Chip(label: Text('Скоро')))),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard(
      {required this.icon,
      required this.title,
      required this.subtitle,
      required this.badge,
      required this.color,
      required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final String badge;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        color: color,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
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
                    Chip(
                        label: Text(badge),
                        visualDensity: VisualDensity.compact),
                  ])),
              const Icon(Icons.chevron_right),
            ]),
          ),
        ),
      );
}
