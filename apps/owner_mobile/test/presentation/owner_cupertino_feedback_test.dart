import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_page.dart';
import 'package:vethelp_owner_mobile/features/appointments/owner_appointments_repository.dart';
import 'package:vethelp_owner_mobile/features/booking/marketplace/booking_marketplace_repository.dart';
import 'package:vethelp_owner_mobile/features/catalog/catalog_models.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_page.dart';
import 'package:vethelp_owner_mobile/features/catalog/public_catalog_repository.dart';
import 'package:vethelp_owner_mobile/presentation/widgets/owner_cupertino_feedback.dart';
import 'package:vethelp_owner_mobile/ui/vethelp_ios_theme.dart';

void main() {
  testWidgets('empty catalog uses shared empty state without raw values',
      (tester) async {
    await tester.pumpWidget(_harness(PublicCatalogPage(
      platformOverride: TargetPlatform.iOS,
      repository: _EmptyCatalogRepository(),
      onSelected: (_) {},
    )));
    await tester.pumpAndSettle();

    expect(find.text('Ничего не найдено'), findsOneWidget);
    expect(find.textContaining('HTTP'), findsNothing);
    expect(find.textContaining('SLOT_ALREADY_TAKEN'), findsNothing);
  });

  testWidgets('empty appointments use shared empty state', (tester) async {
    await tester.pumpWidget(_harness(OwnerAppointmentsPage(
      platformOverride: TargetPlatform.iOS,
      repository: _EmptyAppointmentsRepository(),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Активных записей нет'), findsOneWidget);
    expect(
      find.text('Новая заявка появится здесь после отправки в клинику.'),
      findsOneWidget,
    );
  });

  testWidgets('retry action explains what will be repeated', (tester) async {
    final repository = _FailThenEmptyCatalogRepository();
    await tester.pumpWidget(_harness(PublicCatalogPage(
      platformOverride: TargetPlatform.iOS,
      repository: repository,
      onSelected: (_) {},
    )));
    await tester.pumpAndSettle();

    expect(find.text('Не удалось загрузить каталог'), findsOneWidget);
    expect(find.text('Обновить каталог'), findsOneWidget);

    await tester.tap(find.text('Обновить каталог'));
    await tester.pumpAndSettle();

    expect(repository.calls, 2);
    expect(find.text('Ничего не найдено'), findsOneWidget);
  });

  testWidgets('warning and destructive banners expose text and actions',
      (tester) async {
    var warningRetries = 0;
    var destructiveActions = 0;
    await tester.pumpWidget(_harness(ListView(
      children: [
        OwnerCupertinoStatusBanner(
          tone: OwnerCupertinoFeedbackTone.warning,
          title: 'Нужно обновить',
          message: 'Расписание изменилось. Обновление повторит запрос слотов.',
          actionLabel: 'Обновить расписание',
          onAction: () => warningRetries++,
        ),
        OwnerCupertinoStatusBanner(
          tone: OwnerCupertinoFeedbackTone.destructive,
          title: 'Отмена записи',
          message: 'Клиника должна подтвердить отмену.',
          actionLabel: 'Запросить отмену',
          destructiveAction: true,
          onAction: () => destructiveActions++,
        ),
      ],
    )));

    expect(
        find.text('Расписание изменилось. Обновление повторит запрос слотов.'),
        findsOneWidget);
    expect(find.text('Клиника должна подтвердить отмену.'), findsOneWidget);

    await tester.tap(find.text('Обновить расписание'));
    await tester.tap(find.text('Запросить отмену'));
    expect(warningRetries, 1);
    expect(destructiveActions, 1);
  });

  testWidgets('shared feedback suppresses raw technical strings',
      (tester) async {
    await tester.pumpWidget(_harness(const OwnerCupertinoStatusBanner(
      tone: OwnerCupertinoFeedbackTone.warning,
      title: 'SLOT_ALREADY_TAKEN',
      message: 'HTTP 409 queue_abcd WAITING_FOR_DOCTOR',
    )));

    expect(find.textContaining('SLOT_ALREADY_TAKEN'), findsNothing);
    expect(find.textContaining('HTTP 409'), findsNothing);
    expect(find.textContaining('WAITING_FOR_DOCTOR'), findsNothing);
    expect(find.textContaining('Состояние обновляется'), findsWidgets);
  });

  testWidgets('dark mode resolves banner and empty state', (tester) async {
    await tester.pumpWidget(_harness(
      ListView(
        children: const [
          OwnerCupertinoStatusBanner(
            tone: OwnerCupertinoFeedbackTone.warning,
            message: 'Причина предупреждения показана текстом.',
          ),
          OwnerCupertinoEmptyState(
            title: 'Пока ничего нет',
            message: 'Данные появятся после первого действия.',
          ),
        ],
      ),
      brightness: Brightness.dark,
    ));

    expect(
      CupertinoTheme.of(tester.element(find.text('Пока ничего нет')))
          .brightness,
      Brightness.dark,
    );
    expect(
        find.text('Причина предупреждения показана текстом.'), findsOneWidget);
  });

  testWidgets('Dynamic Type 200 percent keeps empty and error states usable',
      (tester) async {
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(_harness(
      ListView(
        children: const [
          OwnerCupertinoEmptyState(
            title: 'Нет свободного времени',
            message:
                'Выберите другой день или обновите расписание, чтобы проверить новые окна.',
          ),
          OwnerCupertinoInlineError(
            title: 'Не удалось обновить данные',
            message: 'Повторная попытка обновит текущий список.',
            retryLabel: 'Обновить список',
            onRetry: _noop,
          ),
        ],
      ),
      textScale: 2,
    ));

    expect(find.text('Нет свободного времени'), findsOneWidget);
    expect(find.text('Обновить список'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

void _noop() {}

Widget _harness(
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1,
}) {
  return CupertinoApp(
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    supportedLocales: const [Locale('ru'), Locale('en')],
    builder: (context, appChild) {
      final media = MediaQuery.of(context).copyWith(
        platformBrightness: brightness,
        textScaler: TextScaler.linear(textScale),
      );
      return MediaQuery(
        data: media,
        child: Builder(
          builder: (context) => CupertinoTheme(
            data: VetHelpCupertinoTheme.data(context),
            child: Theme(
              data: (brightness == Brightness.dark
                      ? VetHelpTheme.dark()
                      : VetHelpTheme.light())
                  .copyWith(platform: TargetPlatform.iOS),
              child: appChild ?? const SizedBox.shrink(),
            ),
          ),
        ),
      );
    },
    home: child,
  );
}

class _EmptyCatalogRepository extends PublicCatalogRepository {
  @override
  Future<List<CatalogClinic>> listClinics({
    String? query,
    CatalogClinicFilters? filters,
  }) async {
    return const <CatalogClinic>[];
  }

  @override
  Future<CatalogClinicDetail> readClinic(String clinicId) {
    throw UnimplementedError();
  }

  @override
  Future<List<CatalogLocation>> listLocations({String? query}) async {
    return const <CatalogLocation>[];
  }

  @override
  Future<List<CatalogService>> listLocationServices(String locationId) {
    throw UnimplementedError();
  }

  @override
  Future<List<CatalogAvailabilitySlot>> readAvailability({
    required String locationId,
    required DateTime from,
    required DateTime to,
  }) {
    throw UnimplementedError();
  }
}

class _FailThenEmptyCatalogRepository extends _EmptyCatalogRepository {
  int calls = 0;

  @override
  Future<List<CatalogClinic>> listClinics({
    String? query,
    CatalogClinicFilters? filters,
  }) async {
    calls++;
    if (calls == 1) {
      throw StateError('HTTP 500 CATALOG_DOWN');
    }
    return const <CatalogClinic>[];
  }
}

class _EmptyAppointmentsRepository implements OwnerAppointmentsRepository {
  @override
  Future<List<OwnerAppointment>> list() async => const <OwnerAppointment>[];

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
