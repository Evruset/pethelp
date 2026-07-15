import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/services.dart';

import 'core/e2e/owner_e2e_hooks.dart';
import 'core/offline/outbox_repository.dart';
import 'features/appointments/owner_appointments_page.dart';
import 'features/appointments/owner_appointments_repository.dart';
import 'features/auth/owner_auth_repository.dart';
import 'features/auth/owner_session.dart';
import 'features/booking/alternative_slot/alternative_slot_repository.dart';
import 'features/booking/marketplace/booking_marketplace_page.dart';
import 'features/booking/marketplace/booking_marketplace_repository.dart';
import 'features/care/owner_pet_care_page.dart';
import 'features/care/owner_pet_care_repository.dart';
import 'features/care/owner_pet_diary_v50_page.dart';
import 'features/catalog/catalog_models.dart';
import 'features/catalog/public_catalog_page.dart';
import 'features/catalog/public_catalog_repository.dart';
import 'features/emergency/emergency_repository.dart';
import 'features/emergency/emergency_triage_page.dart';
import 'features/insurance/coverage_check_page.dart';
import 'features/insurance/coverage_check_repository.dart';
import 'features/owner_journey/owner_journey_page.dart';
import 'features/owner_journey/owner_home_feature_flag.dart';
import 'features/owner_journey/owner_home_repository.dart';
import 'features/owner_journey/owner_home_v50_page.dart';
import 'features/owner_journey/owner_selected_pet_preference.dart';
import 'features/owner_journey/phone_entry_page.dart';
import 'features/pets/owner_pet.dart';
import 'features/pets/owner_pet_deep_link.dart';
import 'features/pets/owner_pet_repository.dart';
import 'features/pets/owner_pet_profile_v50_page.dart';
import 'features/pets/owner_pets_page.dart';
import 'features/pets/owner_pets_v50_feature_flags.dart';
import 'features/telemed/owner_telemed_page.dart';
import 'features/telemed/owner_telemed_repository.dart';
import 'features/telemed/waiting_room/telemed_room_access_repository.dart';
import 'features/telemed/waiting_room/telemed_waiting_room_repository.dart';
import 'presentation/pages/owner_adaptive_shell.dart';
import 'presentation/platform/owner_platform.dart';
import 'presentation/shell/owner_shell_feature_flag.dart';
import 'ui/vethelp_ios_theme.dart';

void main() => runApp(const VetHelpOwnerJourneyApp());

class VetHelpOwnerJourneyApp extends StatelessWidget {
  const VetHelpOwnerJourneyApp({super.key, this.platformOverride});

  final TargetPlatform? platformOverride;

  @override
  Widget build(BuildContext context) {
    if (ownerUsesCupertino(platform: platformOverride)) {
      return CupertinoApp(
        title: 'VetHelp',
        restorationScopeId: 'vethelp-owner',
        locale: const Locale('ru'),
        supportedLocales: const [Locale('ru'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        builder: (context, child) {
          final brightness = MediaQuery.platformBrightnessOf(context);
          return CupertinoTheme(
            data: VetHelpCupertinoTheme.data(context),
            child: Theme(
              data: brightness == Brightness.dark
                  ? VetHelpTheme.dark()
                  : VetHelpTheme.light(),
              child: child ?? const SizedBox.shrink(),
            ),
          );
        },
        home: OwnerJourneyEntry(platformOverride: platformOverride),
      );
    }

    return MaterialApp(
      title: 'VetHelp',
      restorationScopeId: 'vethelp-owner',
      theme: VetHelpTheme.light(),
      builder: VetHelpTheme.frameBuilder,
      locale: const Locale('ru'),
      supportedLocales: const [Locale('ru'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: OwnerJourneyEntry(platformOverride: platformOverride),
    );
  }
}

class OwnerJourneyEntry extends StatefulWidget {
  const OwnerJourneyEntry({super.key, this.platformOverride});

  final TargetPlatform? platformOverride;

  @override
  State<OwnerJourneyEntry> createState() => _OwnerJourneyEntryState();
}

class _OwnerJourneyEntryState extends State<OwnerJourneyEntry> {
  static const _configuredApiBaseUrl =
      String.fromEnvironment('VETHELP_API_BASE_URL');
  static const _e2eClinicId = String.fromEnvironment('VETHELP_E2E_CLINIC_ID');
  static const _e2eClinicName =
      String.fromEnvironment('VETHELP_E2E_CLINIC_NAME');
  static const _e2eLocationId =
      String.fromEnvironment('VETHELP_E2E_LOCATION_ID');
  static const _e2eServiceId = String.fromEnvironment('VETHELP_E2E_SERVICE_ID');
  static const _e2eServiceName =
      String.fromEnvironment('VETHELP_E2E_SERVICE_NAME');
  final _bootstrapOwnerJwt = const String.fromEnvironment('VETHELP_OWNER_JWT');
  OwnerSession? _session;
  OwnerPet? _selectedPet;
  CatalogBookingSelection? _pendingBooking;
  late final OutboxRepository _ownerOutbox;
  late final OwnerHomeRepository _ownerHomeRepository;
  late final OwnerSelectedPetPreference _selectedPetPreference;
  late final String _ownerDeviceId;
  int _ownerDeviceSequence = 0;
  int _iosSelectedTab = 0;
  bool _petBootstrapInFlight = false;
  bool _petBootstrapCompleted = false;
  int _ownerSessionGeneration = 0;

  String get _apiBaseUrl => _configuredApiBaseUrl.isNotEmpty
      ? _configuredApiBaseUrl
      : (kIsWeb || defaultTargetPlatform != TargetPlatform.android)
          ? 'http://127.0.0.1:3000'
          : 'http://10.0.2.2:3000';
  String get _accessToken => _session?.accessToken ?? _bootstrapOwnerJwt;
  bool get _hasOwnerSession => _accessToken.isNotEmpty;
  bool get _usesCupertino =>
      ownerUsesCupertino(platform: widget.platformOverride);

  @override
  void initState() {
    super.initState();
    _ownerOutbox = OutboxRepository(InMemoryOfflineCommandStore());
    _ownerHomeRepository = _createOwnerHomeRepository();
    _selectedPetPreference = SharedPreferencesOwnerSelectedPetPreference();
    _ownerDeviceId = 'owner-mobile-${DateTime.now().microsecondsSinceEpoch}';
    _registerE2EHooks();
    if (_bootstrapOwnerJwt.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _selectExistingPet();
      });
    }
  }

  @override
  void dispose() {
    unregisterOwnerE2EHook('openEmergency');
    unregisterOwnerE2EHook('openInsurance');
    unregisterOwnerE2EHook('openBooking');
    unregisterOwnerE2EHook('back');
    super.dispose();
  }

  void _registerE2EHooks() {
    registerOwnerE2EHook('openEmergency', _openEmergency);
    registerOwnerE2EHook('openInsurance', _openInsuranceCheck);
    registerOwnerE2EHook('openBooking', _openE2EBooking);
    registerOwnerE2EHook('back', () {
      if (mounted) Navigator.of(context).maybePop();
    });
  }

  Future<String> _token() async {
    if (_accessToken.isEmpty) {
      throw StateError('Owner access token is unavailable.');
    }
    return _accessToken;
  }

  Future<void> _selectExistingPet() async {
    if (isOwnerV50HomeEnabled(
      shellEnabled: isOwnerV50ShellEnabled(),
    )) {
      return;
    }
    if (!_hasOwnerSession ||
        _selectedPet != null ||
        _petBootstrapInFlight ||
        _petBootstrapCompleted) {
      return;
    }

    _petBootstrapInFlight = true;
    try {
      final pets = await _petsRepository().list();
      if (!mounted || _selectedPet != null || pets.isEmpty) return;
      setState(() {
        _selectedPet = pets.first;
      });
    } finally {
      _petBootstrapInFlight = false;
      _petBootstrapCompleted = true;
    }
  }

  OwnerPetRepository _petsRepository() => OfflineCapableOwnerPetRepository(
        remote: HttpOwnerPetRepository(
          baseUrl: Uri.parse(_apiBaseUrl),
          accessToken: _token,
        ),
        outbox: _ownerOutbox,
        deviceId: _ownerDeviceId,
        nextDeviceSequence: () => ++_ownerDeviceSequence,
      );

  OwnerHomeRepository _createOwnerHomeRepository() => HttpOwnerHomeRepository(
        baseUrl: Uri.parse(_apiBaseUrl),
        accessToken: _token,
      );

  @override
  Widget build(BuildContext context) {
    if (_hasOwnerSession) {
      final shellEnabled = isOwnerV50ShellEnabled();
      final homeEnabled = isOwnerV50HomeEnabled(shellEnabled: shellEnabled);
      final petsV50Flags = ownerPetsV50Flags(shellEnabled: shellEnabled);
      final preferenceOwnerId =
          _session?.ownerId ?? safeOwnerSubjectFromJwt(_accessToken);
      final appointmentsRepository = HttpOwnerAppointmentsRepository(
        baseUrl: Uri.parse(_apiBaseUrl),
        accessToken: _token,
      );
      final alternativeSlotRepository = AlternativeSlotRepository(
        baseUrl: Uri.parse(_apiBaseUrl),
        accessTokenProvider: _token,
      );
      final petsRepository = _petsRepository();

      if (shellEnabled) {
        return _OwnerV50AuthenticatedShell(
          platformOverride: widget.platformOverride,
          onBrowseClinics: _openCatalogForOwner,
          onCatalogSelection: _openBooking,
          onRequestTelemed: _openTelemedIntake,
          onRequestInsurance: _openInsuranceCheck,
          onRequestEmergency: _openEmergency,
          onOpenCare: _openCare,
          petsRepository: petsRepository,
          appointmentsRepository: appointmentsRepository,
          alternativeSlotRepository: alternativeSlotRepository,
          catalogRepository:
              HttpPublicCatalogRepository(baseUrl: Uri.parse(_apiBaseUrl)),
          selectedPet: _selectedPet,
          onPetSelected: _selectPet,
          ownerHomeRepository: _ownerHomeRepository,
          selectedPetPreference: _selectedPetPreference,
          preferenceOwnerId: preferenceOwnerId,
          v50HomeEnabled: homeEnabled && preferenceOwnerId != null,
          onSignIn: _openPhoneEntry,
          sessionGeneration: _ownerSessionGeneration,
          petsV50Flags: petsV50Flags,
          onOpenPetProfile: _openV50PetProfile,
          onOpenPetDeepLink: _openV50PetDeepLink,
        );
      }

      if (_usesCupertino) {
        return _OwnerIosAuthenticatedShell(
          onBrowseClinics: _openCatalogForOwner,
          onCatalogSelection: _openBooking,
          onRequestTelemed: _openTelemedIntake,
          onRequestInsurance: _openInsuranceCheck,
          onRequestEmergency: _openEmergency,
          onOpenCare: _openCare,
          petsRepository: petsRepository,
          appointmentsRepository: appointmentsRepository,
          alternativeSlotRepository: alternativeSlotRepository,
          catalogRepository:
              HttpPublicCatalogRepository(baseUrl: Uri.parse(_apiBaseUrl)),
          selectedPet: _selectedPet,
          onPetSelected: _selectPet,
          selectedTabIndex: _iosSelectedTab,
        );
      }

      return OwnerJourneyPage(
        onBrowseClinics: _openCatalogForOwner,
        onRequestTelemed: _openTelemedIntake,
        onRequestInsurance: _openInsuranceCheck,
        onRequestEmergency: _openEmergency,
        onOpenCare: _openCare,
        petsRepository: petsRepository,
        appointmentsRepository: appointmentsRepository,
        alternativeSlotRepository: alternativeSlotRepository,
        selectedPet: _selectedPet,
        onPetSelected: _selectPet,
      );
    }
    return _GuestStartPage(
      onOpenPhoneEntry: _openPhoneEntry,
      onBrowseClinics: _openCatalogForGuest,
      onRequestTelemed: _openPhoneEntry,
      onRequestEmergency: _openEmergency,
      onRequestInsurance: _openPhoneEntry,
    );
  }

  void _openPhoneEntry() => Navigator.of(context).push(
        ownerPageRoute<void>(
          context: context,
          platform: widget.platformOverride,
          builder: (_) => PhoneEntryPage(
            onBack: () => Navigator.of(context).pop(),
            repository:
                HttpOwnerAuthRepository(baseUrl: Uri.parse(_apiBaseUrl)),
            onAuthenticated: _completeAuthentication,
          ),
        ),
      );

  void _completeAuthentication(OwnerSession session) {
    final hasPendingBooking = _pendingBooking != null;
    setState(() {
      _session = session;
      _ownerSessionGeneration++;
      _selectedPet = null;
      _petBootstrapCompleted = false;
    });
    Navigator.of(context).popUntil((route) => route.isFirst);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _selectExistingPet();
      if (hasPendingBooking && mounted) {
        _showMessage(
          'Добавьте или выберите питомца: запись всегда создаётся для конкретного питомца.',
        );
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
          {required ValueChanged<CatalogBookingSelection> onSelected,
          String? contextNote}) =>
      Navigator.of(context).push(
        ownerPageRoute<void>(
          context: context,
          platform: widget.platformOverride,
          builder: (_) => PublicCatalogPage(
            repository:
                HttpPublicCatalogRepository(baseUrl: Uri.parse(_apiBaseUrl)),
            onSelected: onSelected,
            platformOverride: widget.platformOverride,
            bookingPetName: _selectedPet?.name,
            bookingContextNote: contextNote,
            onChangePet: _selectedPet == null
                ? null
                : () {
                    Navigator.of(context).maybePop();
                    _showMessage(
                      'Вы можете изменить питомца во вкладке «Питомцы», затем вернуться к записи.',
                    );
                  },
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
    Navigator.of(context).push(
      ownerPageRoute<void>(
        context: context,
        platform: widget.platformOverride,
        builder: (_) => BookingMarketplacePage(
          clinicName: location.clinicName,
          locationAddress: location.address,
          serviceName: selection.service.displayName,
          serviceId: selection.service.id,
          petName: pet.name,
          clinicLocationId: location.locationId,
          petId: pet.id,
          repository: HttpBookingMarketplaceRepository(
            baseUrl: Uri.parse(_apiBaseUrl),
            accessTokenProvider: _token,
          ),
          platformOverride: widget.platformOverride,
          onOpenAppointments: _openAppointmentsTab,
        ),
      ),
    );
  }

  void _openE2EBooking() {
    if (_e2eClinicId.isEmpty ||
        _e2eLocationId.isEmpty ||
        _e2eServiceId.isEmpty) {
      _showMessage(
        'Local E2E booking requires VETHELP_E2E_CLINIC_ID, VETHELP_E2E_LOCATION_ID and VETHELP_E2E_SERVICE_ID.',
      );
      return;
    }
    _openBooking(CatalogBookingSelection(
      location: CatalogLocation(
        clinicId: _e2eClinicId,
        clinicName:
            _e2eClinicName.isNotEmpty ? _e2eClinicName : 'VetHelp Pilot',
        locationId: _e2eLocationId,
        address: 'Moscow, Pilotnaya 1',
        phone: null,
        latitude: null,
        longitude: null,
        hasOpenSlots: true,
        observedAt: DateTime.now(),
      ),
      service: CatalogService(
        id: _e2eServiceId,
        code: 'CONSULTATION',
        displayName:
            _e2eServiceName.isNotEmpty ? _e2eServiceName : 'Первичный приём',
        durationMinutes: 30,
        priceAmount: '1500.00',
        currency: 'RUB',
      ),
    ));
  }

  void _openAppointmentsTab() {
    setState(() {
      _iosSelectedTab = 2;
    });
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _openTelemedIntake() {
    Navigator.of(context).push(
      ownerPageRoute<void>(
        context: context,
        platform: widget.platformOverride,
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
          onRequestEmergency: _openEmergency,
          onBrowseClinics: _openCatalogForOwner,
          platformOverride: widget.platformOverride,
        ),
      ),
    );
  }

  void _openInsuranceCheck() {
    final pet = _selectedPet;
    if (pet == null) {
      _showMessage(
          'Сначала добавьте или выберите питомца на вкладке «Питомец».');
      return;
    }
    Navigator.of(context).push(
      ownerPageRoute<void>(
        context: context,
        platform: widget.platformOverride,
        builder: (_) => CoverageCheckPage(
          pet: pet,
          repository: CoverageCheckRepository(
            baseUrl: Uri.parse(_apiBaseUrl),
            accessTokenProvider: _token,
          ),
        ),
      ),
    );
  }

  void _openCare() {
    final pet = _selectedPet;
    if (pet == null) {
      _showMessage(
          'Сначала добавьте или выберите питомца на вкладке «Питомец».');
      return;
    }
    Navigator.of(context).push(
      ownerPageRoute<void>(
        context: context,
        platform: widget.platformOverride,
        builder: (_) => OwnerPetCarePage(
          pet: pet,
          repository: HttpOwnerPetCareRepository(
            baseUrl: Uri.parse(_apiBaseUrl),
            accessTokenProvider: _token,
          ),
          onRebookVisit: _openRepeatBookingFromCare,
          platformOverride: widget.platformOverride,
        ),
      ),
    );
  }

  void _openV50PetProfile(OwnerPet pet) {
    final repository = _petsRepository();
    final flags = ownerPetsV50Flags(shellEnabled: isOwnerV50ShellEnabled());
    final diaryRepository = HttpOwnerPetCareRepository(
      baseUrl: Uri.parse(_apiBaseUrl),
      accessTokenProvider: _token,
    );
    Navigator.of(context).push(ownerPageRoute<void>(
      context: context,
      platform: widget.platformOverride,
      builder: (_) => OwnerPetProfileV50Page(
        pet: pet,
        repository: repository,
        onPetChanged: _selectPet,
        onOpenDiary: flags.diary
            ? () => Navigator.of(context).push(ownerPageRoute<void>(
                  context: context,
                  platform: widget.platformOverride,
                  builder: (_) => OwnerPetDiaryV50Page(
                    pet: pet,
                    repository: diaryRepository,
                  ),
                ))
            : null,
        onArchiveResolved: _resolveSelectionAfterLifecycle,
      ),
    ));
  }

  void _openV50PetDeepLink(OwnerPetDeepLink link) {
    final flags = ownerPetsV50Flags(shellEnabled: isOwnerV50ShellEnabled());
    if (!flags.profile ||
        (link.kind != OwnerPetDeepLinkKind.profile && !flags.diary)) {
      return;
    }
    final pets = _petsRepository();
    final diary = HttpOwnerPetCareRepository(
      baseUrl: Uri.parse(_apiBaseUrl),
      accessTokenProvider: _token,
    );
    Navigator.of(context).push(ownerPageRoute<void>(
      context: context,
      platform: widget.platformOverride,
      builder: (_) => OwnerPetDeepLinkDestination(
        link: link,
        resolver: OwnerPetDeepLinkResolver(pets: pets, diary: diary),
        sessionGeneration: _ownerSessionGeneration,
        petRepository: pets,
        diaryRepository: diary,
        safeSnapshot: _selectedPet?.id == link.petId ? _selectedPet : null,
        onPetChanged: _selectPet,
        onArchiveResolved: _resolveSelectionAfterLifecycle,
      ),
    ));
  }

  Future<void> _resolveSelectionAfterLifecycle(OwnerPet changed) async {
    final ownerId = _session?.ownerId ?? safeOwnerSubjectFromJwt(_accessToken);
    final active = (await _petsRepository().list())
        .where((pet) => !pet.isArchived)
        .toList(growable: false);
    if (!mounted) return;
    final selected =
        changed.isArchived ? (active.isEmpty ? null : active.first) : changed;
    setState(() {
      _selectedPet = selected;
      _petBootstrapCompleted = true;
    });
    if (ownerId != null) {
      if (selected == null) {
        await _selectedPetPreference.clear(ownerId);
      } else {
        await _selectedPetPreference.write(ownerId, selected.id);
      }
    }
  }

  void _openRepeatBookingFromCare(OwnerPetCareRebookIntent intent) {
    setState(() {
      _selectedPet = intent.pet;
      _petBootstrapCompleted = true;
    });
    _showMessage(
      'Выберите удобное время для ${intent.pet.name}. Слот не бронируется до подтверждения.',
    );
    _openCatalog(
      contextNote:
          'Это повторная запись по контексту прошлого визита. Клиника и услуга выбираются заново, а время будет проверено отдельно.',
      onSelected: (selection) {
        Navigator.of(context).pop();
        _openBooking(selection);
      },
    );
  }

  void _openEmergency() {
    Navigator.of(context).push(
      ownerPageRoute<void>(
        context: context,
        platform: widget.platformOverride,
        builder: (_) => EmergencyTriagePage(
          repository: EmergencyRepository(baseUrl: Uri.parse(_apiBaseUrl)),
          platformOverride: widget.platformOverride,
        ),
      ),
    );
  }

  void _showMessage(String text) {
    unawaited(
      showOwnerMessage(
        context,
        text,
        platform: widget.platformOverride,
      ),
    );
  }
}

class _OwnerV50AuthenticatedShell extends StatefulWidget {
  const _OwnerV50AuthenticatedShell({
    required this.onBrowseClinics,
    required this.onCatalogSelection,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
    required this.onOpenCare,
    required this.petsRepository,
    required this.appointmentsRepository,
    required this.alternativeSlotRepository,
    required this.catalogRepository,
    required this.selectedPet,
    required this.onPetSelected,
    required this.ownerHomeRepository,
    required this.selectedPetPreference,
    required this.preferenceOwnerId,
    required this.v50HomeEnabled,
    required this.onSignIn,
    required this.sessionGeneration,
    required this.petsV50Flags,
    required this.onOpenPetProfile,
    required this.onOpenPetDeepLink,
    this.platformOverride,
  });

  final VoidCallback onBrowseClinics;
  final ValueChanged<CatalogBookingSelection> onCatalogSelection;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;
  final VoidCallback onOpenCare;
  final OwnerPetRepository petsRepository;
  final OwnerAppointmentsRepository appointmentsRepository;
  final AlternativeSlotRepository alternativeSlotRepository;
  final PublicCatalogRepository catalogRepository;
  final OwnerPet? selectedPet;
  final ValueChanged<OwnerPet> onPetSelected;
  final OwnerHomeRepository ownerHomeRepository;
  final OwnerSelectedPetPreference selectedPetPreference;
  final String? preferenceOwnerId;
  final bool v50HomeEnabled;
  final VoidCallback onSignIn;
  final int sessionGeneration;
  final OwnerPetsV50Flags petsV50Flags;
  final ValueChanged<OwnerPet> onOpenPetProfile;
  final ValueChanged<OwnerPetDeepLink> onOpenPetDeepLink;
  final TargetPlatform? platformOverride;

  @override
  State<_OwnerV50AuthenticatedShell> createState() =>
      _OwnerV50AuthenticatedShellState();
}

class _OwnerV50AuthenticatedShellState
    extends State<_OwnerV50AuthenticatedShell> with RestorationMixin {
  late final RestorableInt _selectedIndex;
  bool _sessionExpired = false;
  int _handledDeepLinkGeneration = -1;

  @override
  String? get restorationId => 'owner-v50-authenticated-shell';

  @override
  void initState() {
    super.initState();
    _selectedIndex = RestorableInt(
      OwnerV50AdaptiveShell.indexForLocation(
        WidgetsBinding.instance.platformDispatcher.defaultRouteName,
      ),
    );
    registerOwnerE2EHook('openHome', () => _selectDestination(0));
    registerOwnerE2EHook('openAppointments', () => _selectDestination(2));
    registerOwnerE2EHook('openPet', () => _selectDestination(3));
    WidgetsBinding.instance.addPostFrameCallback((_) => _openInitialDeepLink());
  }

  @override
  void restoreState(RestorationBucket? oldBucket, bool initialRestore) {
    registerForRestoration(_selectedIndex, 'selected-destination');
  }

  @override
  void didUpdateWidget(covariant _OwnerV50AuthenticatedShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.preferenceOwnerId != widget.preferenceOwnerId ||
        oldWidget.sessionGeneration != widget.sessionGeneration) {
      _sessionExpired = false;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _openInitialDeepLink());
    }
  }

  void _openInitialDeepLink() {
    if (!mounted || _handledDeepLinkGeneration == widget.sessionGeneration) {
      return;
    }
    _handledDeepLinkGeneration = widget.sessionGeneration;
    final link = OwnerPetDeepLink.tryParse(
      WidgetsBinding.instance.platformDispatcher.defaultRouteName,
    );
    if (link != null) widget.onOpenPetDeepLink(link);
  }

  @override
  void dispose() {
    unregisterOwnerE2EHook('openHome');
    unregisterOwnerE2EHook('openAppointments');
    unregisterOwnerE2EHook('openPet');
    _selectedIndex.dispose();
    super.dispose();
  }

  void _selectDestination(int index) {
    if (!mounted || index == _selectedIndex.value) return;
    setState(() => _selectedIndex.value = index);
    if (kIsWeb) {
      SystemNavigator.routeInformationUpdated(
        uri: Uri.parse(OwnerV50AdaptiveShell.locationForIndex(index)),
        replace: true,
      );
    }
  }

  void _showNotifications() {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger != null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Новых уведомлений пока нет.')),
      );
      return;
    }
    unawaited(
      showCupertinoDialog<void>(
        context: context,
        builder: (dialogContext) => CupertinoAlertDialog(
          title: const Text('Уведомления'),
          content: const Text('Новых уведомлений пока нет.'),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Понятно'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return OwnerV50AdaptiveShell(
      viewState: _sessionExpired
          ? OwnerShellViewState.sessionExpired
          : OwnerShellViewState.content,
      onSignIn: widget.onSignIn,
      selectedIndex: _selectedIndex.value,
      onDestinationSelected: _sessionExpired ? (_) {} : _selectDestination,
      selectedPetName: _sessionExpired ? null : widget.selectedPet?.name,
      onPetContextPressed: _sessionExpired ? null : () => _selectDestination(3),
      onNotifications: _sessionExpired ? null : _showNotifications,
      onEmergency: widget.onRequestEmergency,
      home: widget.v50HomeEnabled
          ? OwnerHomeV50Page(
              repository: widget.ownerHomeRepository,
              preference: widget.selectedPetPreference,
              ownerId: widget.preferenceOwnerId!,
              sessionGeneration: widget.sessionGeneration,
              onPetSelected: (pet) => widget.onPetSelected(
                OwnerPet(
                  id: pet.id,
                  name: pet.name,
                  species: pet.species,
                  breed: pet.breed,
                  photoUrl: pet.photoUrl,
                ),
              ),
              onBrowseClinics: () => _selectDestination(1),
              onManagePets: () => _selectDestination(3),
              onOpenAppointments: () => _selectDestination(2),
              onOpenCare: widget.onOpenCare,
              onRequestTelemed: widget.onRequestTelemed,
              onRequestInsurance: widget.onRequestInsurance,
              onRequestEmergency: widget.onRequestEmergency,
              onSessionExpired: () {
                if (mounted && !_sessionExpired) {
                  setState(() => _sessionExpired = true);
                }
              },
            )
          : OwnerHomePage(
              selectedPet: widget.selectedPet,
              appointmentsRepository: widget.appointmentsRepository,
              petsRepository: widget.petsRepository,
              onBrowseClinics: () => _selectDestination(1),
              onManagePets: () => _selectDestination(3),
              onPetSelected: widget.onPetSelected,
              onOpenAppointments: () => _selectDestination(2),
              onOpenCare: widget.onOpenCare,
              onRequestTelemed: widget.onRequestTelemed,
              onRequestInsurance: widget.onRequestInsurance,
              onRequestEmergency: widget.onRequestEmergency,
            ),
      clinics: PublicCatalogPage(
        platformOverride: widget.platformOverride,
        repository: widget.catalogRepository,
        onSelected: widget.onCatalogSelection,
        bookingPetName: widget.selectedPet?.name,
        onChangePet: () => _selectDestination(3),
      ),
      appointments: OwnerAppointmentsPage(
        repository: widget.appointmentsRepository,
        alternativeSlotRepository: widget.alternativeSlotRepository,
        platformOverride: widget.platformOverride,
        onRebookAppointment: () => _selectDestination(1),
        onOpenPetDiary: widget.selectedPet == null ? null : widget.onOpenCare,
      ),
      pets: OwnerPetsPage(
        repository: widget.petsRepository,
        platformOverride: widget.platformOverride,
        selectedPetId: widget.petsV50Flags.pets ? widget.selectedPet?.id : null,
        onOpenPetProfile:
            widget.petsV50Flags.profile ? widget.onOpenPetProfile : null,
        onPetSelected: (pet) {
          widget.onPetSelected(pet);
          _selectDestination(0);
        },
        onOpenPetCare: (pet) {
          widget.onPetSelected(pet);
          widget.onOpenCare();
        },
      ),
    );
  }
}

class _OwnerIosAuthenticatedShell extends StatefulWidget {
  const _OwnerIosAuthenticatedShell({
    required this.onBrowseClinics,
    required this.onCatalogSelection,
    required this.onRequestTelemed,
    required this.onRequestInsurance,
    required this.onRequestEmergency,
    required this.onOpenCare,
    required this.petsRepository,
    required this.appointmentsRepository,
    required this.alternativeSlotRepository,
    required this.catalogRepository,
    required this.selectedPet,
    required this.onPetSelected,
    required this.selectedTabIndex,
  });

  final VoidCallback onBrowseClinics;
  final ValueChanged<CatalogBookingSelection> onCatalogSelection;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestInsurance;
  final VoidCallback onRequestEmergency;
  final VoidCallback onOpenCare;
  final OwnerPetRepository petsRepository;
  final OwnerAppointmentsRepository appointmentsRepository;
  final AlternativeSlotRepository alternativeSlotRepository;
  final PublicCatalogRepository catalogRepository;
  final OwnerPet? selectedPet;
  final ValueChanged<OwnerPet> onPetSelected;
  final int selectedTabIndex;

  @override
  State<_OwnerIosAuthenticatedShell> createState() =>
      _OwnerIosAuthenticatedShellState();
}

class _OwnerIosAuthenticatedShellState
    extends State<_OwnerIosAuthenticatedShell> {
  late final CupertinoTabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController =
        CupertinoTabController(initialIndex: widget.selectedTabIndex);
    registerOwnerE2EHook('openHome', () => _selectTab(0));
    registerOwnerE2EHook('openAppointments', () => _selectTab(2));
    registerOwnerE2EHook('openPet', () => _selectTab(3));
  }

  @override
  void didUpdateWidget(covariant _OwnerIosAuthenticatedShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_tabController.index != widget.selectedTabIndex) {
      _tabController.index = widget.selectedTabIndex;
    }
  }

  @override
  void dispose() {
    unregisterOwnerE2EHook('openHome');
    unregisterOwnerE2EHook('openAppointments');
    unregisterOwnerE2EHook('openPet');
    _tabController.dispose();
    super.dispose();
  }

  void _selectTab(int index) {
    setState(() {
      _tabController.index = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return OwnerAdaptiveShell(
      platformOverride: TargetPlatform.iOS,
      controller: _tabController,
      home: _OwnerIosHomeTab(
        selectedPet: widget.selectedPet,
        appointmentsRepository: widget.appointmentsRepository,
        onBrowseClinics: widget.onBrowseClinics,
        onManagePets: () => _selectTab(3),
        onOpenAppointments: () => _selectTab(2),
        onOpenCare: widget.onOpenCare,
        onRequestTelemed: widget.onRequestTelemed,
        onRequestInsurance: widget.onRequestInsurance,
        onRequestEmergency: widget.onRequestEmergency,
      ),
      clinics: PublicCatalogPage(
        platformOverride: TargetPlatform.iOS,
        repository: widget.catalogRepository,
        onSelected: widget.onCatalogSelection,
        bookingPetName: widget.selectedPet?.name,
        onChangePet: widget.selectedPet == null ? null : () => _selectTab(3),
      ),
      appointments: OwnerAppointmentsPage(
        repository: widget.appointmentsRepository,
        alternativeSlotRepository: widget.alternativeSlotRepository,
        platformOverride: TargetPlatform.iOS,
        onOpenPetDiary: widget.selectedPet == null ? null : widget.onOpenCare,
        onRebookAppointment:
            widget.selectedPet == null ? null : widget.onBrowseClinics,
      ),
      pets: OwnerPetsPage(
        repository: widget.petsRepository,
        platformOverride: TargetPlatform.iOS,
        onPetSelected: (pet) {
          widget.onPetSelected(pet);
          _selectTab(0);
        },
        onOpenPetCare: (pet) {
          widget.onPetSelected(pet);
          widget.onOpenCare();
        },
      ),
    );
  }
}

class _OwnerIosHomeTab extends StatelessWidget {
  const _OwnerIosHomeTab({
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
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: const CupertinoNavigationBar(
        middle: Text('VetHelp'),
        transitionBetweenRoutes: false,
      ),
      child: SafeArea(
        bottom: false,
        child: OwnerHomePage(
          platformOverride: TargetPlatform.iOS,
          selectedPet: selectedPet,
          appointmentsRepository: appointmentsRepository,
          onBrowseClinics: onBrowseClinics,
          onManagePets: onManagePets,
          onOpenAppointments: onOpenAppointments,
          onOpenCare: onOpenCare,
          onRequestTelemed: onRequestTelemed,
          onRequestInsurance: onRequestInsurance,
          onRequestEmergency: onRequestEmergency,
        ),
      ),
    );
  }
}

class _GuestStartPage extends StatelessWidget {
  const _GuestStartPage(
      {required this.onOpenPhoneEntry,
      required this.onBrowseClinics,
      required this.onRequestTelemed,
      required this.onRequestEmergency,
      required this.onRequestInsurance});
  final VoidCallback onOpenPhoneEntry;
  final VoidCallback onBrowseClinics;
  final VoidCallback onRequestTelemed;
  final VoidCallback onRequestEmergency;
  final VoidCallback onRequestInsurance;

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
            _ActionCard(
                icon: Icons.shield_outlined,
                title: 'Страховое покрытие',
                subtitle:
                    'После входа выберите питомца и отправьте предварительную проверку партнёру.',
                badge: 'Нужен вход',
                color: colors.tertiaryContainer,
                onTap: onRequestInsurance),
            const SizedBox(height: 12),
            const Card(
                child: ListTile(
                    enabled: false,
                    leading: Icon(Icons.health_and_safety_outlined),
                    title: Text('Медицинская карта'),
                    subtitle: Text('Профиль питомца откроется после входа.'))),
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
