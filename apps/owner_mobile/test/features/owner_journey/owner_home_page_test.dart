import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/alternative_slot/alternative_slot_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';
import 'package:vethelp_owner_mobile/features/owner_journey/owner_journey_page.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';

void main() {
  testWidgets('iOS Home uses Cupertino presentation and real actions',
      (tester) async {
    var emergencyRequests = 0;
    var petRequests = 0;
    var telemedRequests = 0;

    await tester.pumpWidget(
      _cupertinoHarness(
        OwnerHomePage(
          platformOverride: TargetPlatform.iOS,
          selectedPet: null,
          appointmentsRepository: _FakeOwnerAppointmentsRepository(),
          onBrowseClinics: () {},
          onManagePets: () => petRequests++,
          onOpenAppointments: () {},
          onOpenCare: () {},
          onRequestTelemed: () => telemedRequests++,
          onRequestInsurance: () {},
          onRequestEmergency: () => emergencyRequests++,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(Card), findsNothing);
    expect(find.byType(ListTile), findsNothing);
    expect(find.byType(InkWell), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
    expect(find.textContaining('790'), findsNothing);
    expect(
      find.bySemanticsLabel(
        'Срочная помощь. Открыть список срочных клиник сейчас.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Срочная помощь'));
    await tester.pump();
    await tester.tap(find.text('Добавить питомца'));
    await tester.pump();
    await tester.drag(find.byType(ListView), const Offset(0, -520));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ветеринар онлайн'));
    await tester.pump();

    expect(emergencyRequests, 1);
    expect(petRequests, 1);
    expect(telemedRequests, 1);
  });

  testWidgets('iOS Home renders active appointments from repository',
      (tester) async {
    var openAppointments = 0;

    await tester.pumpWidget(
      _cupertinoHarness(
        OwnerHomePage(
          platformOverride: TargetPlatform.iOS,
          selectedPet: _pet,
          appointmentsRepository: _FakeOwnerAppointmentsRepository(
            active: true,
          ),
          onBrowseClinics: () {},
          onManagePets: () {},
          onOpenAppointments: () => openAppointments++,
          onOpenCare: () {},
          onRequestTelemed: () {},
          onRequestInsurance: () {},
          onRequestEmergency: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Активные записи'), findsOneWidget);
    expect(find.text('VetHelp Pilot'), findsOneWidget);
    expect(find.textContaining('Барс'), findsWidgets);

    await tester.tap(find.text('Все'));
    await tester.pump();
    expect(openAppointments, 1);
  });

  testWidgets('iOS Home keeps booking selection explicit when pet exists',
      (tester) async {
    var browseClinics = 0;

    await tester.pumpWidget(
      _cupertinoHarness(
        OwnerHomePage(
          platformOverride: TargetPlatform.iOS,
          selectedPet: _pet,
          appointmentsRepository: _FakeOwnerAppointmentsRepository(),
          onBrowseClinics: () => browseClinics++,
          onManagePets: () {},
          onOpenAppointments: () {},
          onOpenCare: () {},
          onRequestTelemed: () {},
          onRequestInsurance: () {},
          onRequestEmergency: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Найти клинику'), findsOneWidget);

    await tester.tap(find.text('Найти клинику'));
    await tester.pump();
    expect(browseClinics, 1);
  });

  testWidgets('Android Home keeps the existing Material presentation',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OwnerHomePage(
            platformOverride: TargetPlatform.android,
            selectedPet: null,
            appointmentsRepository: _FakeOwnerAppointmentsRepository(),
            onBrowseClinics: () {},
            onManagePets: () {},
            onOpenAppointments: () {},
            onOpenCare: () {},
            onRequestTelemed: () {},
            onRequestInsurance: () {},
            onRequestEmergency: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(Card), findsWidgets);
    expect(find.text('Добавить питомца'), findsOneWidget);
    expect(find.byType(CupertinoButton), findsNothing);
  });

  testWidgets('web desktop shell uses side rail and responsive Home hierarchy',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));

    await tester.pumpWidget(_materialHarness(
      OwnerJourneyPage(
        selectedPet: _pet,
        appointmentsRepository: _FakeOwnerAppointmentsRepository(),
        petsRepository: _FakeOwnerPetRepository(),
        alternativeSlotRepository: _alternativeSlots,
        onBrowseClinics: () {},
        onPetSelected: (_) {},
        onOpenCare: () {},
        onRequestTelemed: () {},
        onRequestInsurance: () {},
        onRequestEmergency: () {},
      ),
      size: const Size(1280, 900),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('Главное для питомца'), findsOneWidget);
    expect(find.text('Найти клинику'), findsOneWidget);
    expect(find.text('Выбранный питомец'), findsOneWidget);
    expect(find.text('Дополнительные сервисы'), findsOneWidget);
    expect(find.text('Срочная помощь'), findsOneWidget);
    expect(find.text('Медицинская карта'), findsNothing);
    expect(find.textContaining('790'), findsNothing);
  });

  testWidgets('tablet Home keeps side rail and usable constrained content',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1024, 768));

    await tester.pumpWidget(_materialHarness(
      OwnerJourneyPage(
        selectedPet: _pet,
        appointmentsRepository: _FakeOwnerAppointmentsRepository(active: true),
        petsRepository: _FakeOwnerPetRepository(),
        alternativeSlotRepository: _alternativeSlots,
        onBrowseClinics: () {},
        onPetSelected: (_) {},
        onOpenCare: () {},
        onRequestTelemed: () {},
        onRequestInsurance: () {},
        onRequestEmergency: () {},
      ),
      size: const Size(1024, 768),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.text('Активные записи'), findsOneWidget);
    expect(find.text('VetHelp Pilot'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile Material shell keeps bottom navigation', (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(390, 844));

    await tester.pumpWidget(_materialHarness(
      OwnerJourneyPage(
        selectedPet: null,
        appointmentsRepository: _FakeOwnerAppointmentsRepository(),
        petsRepository: _FakeOwnerPetRepository(),
        alternativeSlotRepository: _alternativeSlots,
        onBrowseClinics: () {},
        onPetSelected: (_) {},
        onOpenCare: () {},
        onRequestTelemed: () {},
        onRequestInsurance: () {},
        onRequestEmergency: () {},
      ),
      size: const Size(390, 844),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationRail), findsNothing);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Добавить питомца'), findsOneWidget);
  });

  testWidgets('web Home primary CTA and pet edit icon use real callbacks',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    var browseClinics = 0;
    var managePets = 0;
    var insurance = 0;
    var telemed = 0;
    var emergency = 0;

    await tester.pumpWidget(_materialHarness(
        OwnerHomePage(
          selectedPet: _pet,
          appointmentsRepository: _FakeOwnerAppointmentsRepository(),
          onBrowseClinics: () => browseClinics++,
          onManagePets: () => managePets++,
          onOpenAppointments: () {},
          onOpenCare: () {},
          onRequestTelemed: () => telemed++,
          onRequestInsurance: () => insurance++,
          onRequestEmergency: () => emergency++,
        ),
        size: const Size(1280, 900)));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Изменить питомца'), findsOneWidget);
    expect(find.text('Страхование'), findsOneWidget);
    expect(find.text('Ветеринар онлайн'), findsOneWidget);
    expect(find.text('Срочная помощь'), findsOneWidget);
    expect(find.text('Медицинская карта'), findsNothing);

    await tester.tap(find.text('Найти клинику'));
    await tester.tap(find.byTooltip('Изменить питомца'));
    await tester.tap(find.text('Страхование'));
    await tester.tap(find.text('Ветеринар онлайн'));
    await tester.tap(find.text('Срочная помощь'));

    expect(browseClinics, 1);
    expect(managePets, 1);
    expect(insurance, 1);
    expect(telemed, 1);
    expect(emergency, 1);
  });

  testWidgets('web Home survives browser zoom style text scaling',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(1280, 900));

    await tester.pumpWidget(_materialHarness(
      OwnerHomePage(
        selectedPet: _pet,
        appointmentsRepository: _FakeOwnerAppointmentsRepository(),
        onBrowseClinics: () {},
        onManagePets: () {},
        onOpenAppointments: () {},
        onOpenCare: () {},
        onRequestTelemed: () {},
        onRequestInsurance: () {},
        onRequestEmergency: () {},
      ),
      textScale: 2,
      size: const Size(1280, 900),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Главное для питомца'), findsOneWidget);
    expect(find.text('Найти клинику'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _materialHarness(
  Widget child, {
  double textScale = 1,
  Size? size,
}) {
  return MaterialApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    theme: ThemeData(useMaterial3: true),
    builder: (context, child) {
      final media = MediaQuery.of(context).copyWith(
        size: size,
        textScaler: TextScaler.linear(textScale),
      );
      return MediaQuery(data: media, child: child ?? const SizedBox.shrink());
    },
    home: child,
  );
}

Widget _cupertinoHarness(Widget child) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, child) {
      return Theme(
        data: ThemeData(useMaterial3: true),
        child: child ?? const SizedBox.shrink(),
      );
    },
    home: child,
  );
}

const _pet = OwnerPet(id: 'pet-1', name: 'Барс', species: 'CAT');

final _alternativeSlots = AlternativeSlotRepository(
  baseUrl: Uri.parse('http://127.0.0.1:3000'),
  accessTokenProvider: () async => 'token',
);

class _FakeOwnerAppointmentsRepository implements OwnerAppointmentsRepository {
  _FakeOwnerAppointmentsRepository({this.active = false});

  final bool active;

  static const _presentation = OwnerAppointmentPresentation(
    code: 'WAITING_FOR_CLINIC',
    label: 'Ожидаем подтверждения',
    description: 'Клиника проверяет возможность записи.',
    tone: 'info',
  );

  @override
  Future<List<OwnerAppointment>> list() async {
    if (!active) return const <OwnerAppointment>[];
    return [
      OwnerAppointment(
        holdId: '11111111-1111-4111-8111-111111111111',
        appointmentId: null,
        state: 'MANUAL_CONFIRM_PENDING',
        bucket: 'ACTIVE',
        presentation: _presentation,
        startsAt: DateTime.utc(2026, 7, 2, 10),
        endsAt: DateTime.utc(2026, 7, 2, 10, 30),
        clinicName: 'VetHelp Pilot',
        clinicAddress: 'Pilotnaya 1',
        petName: 'Барс',
      ),
    ];
  }

  @override
  Future<OwnerAppointmentDetail> readDetail(String holdId) {
    throw UnimplementedError();
  }

  @override
  Future<BookingHoldSnapshot> readHold(String holdId) {
    throw UnimplementedError();
  }

  @override
  Future<ReleasedBookingHold> releaseHold(String holdId) {
    throw UnimplementedError();
  }

  @override
  Future<RequestedBookingCancellation> requestCancellation(String holdId) {
    throw UnimplementedError();
  }
}

class _FakeOwnerPetRepository implements OwnerPetRepository {
  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async => _pet;

  @override
  Future<List<OwnerPet>> list() async => const [_pet];

  @override
  Future<List<OwnerPetProfileSyncState>> profileSyncStates(
          String petId) async =>
      const <OwnerPetProfileSyncState>[];

  @override
  Future<OwnerPet> read(String petId) async => _pet;

  @override
  Future<OwnerPetSaveResult> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) async =>
      const OwnerPetSaved(_pet);
}
