import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pet_repository.dart';
import 'package:vethelp_owner_mobile/features/pets/owner_pets_page.dart';

void main() {
  testWidgets('validates pet profile before submit', (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = _FakeOwnerPetRepository();

    await tester.pumpWidget(MaterialApp(
      home: OwnerPetsPage(
        repository: repository,
        onPetSelected: (_) {},
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Добавить питомца'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), '!');
    await tester.enterText(find.byType(TextFormField).at(2), '2999-01-01');
    await tester.enterText(find.byType(TextFormField).at(3), '999');
    final submitButton = find.byType(FilledButton).last;
    await tester.ensureVisible(submitButton);
    await tester.pump();
    await tester.tap(submitButton);
    await tester.pump();

    expect(find.text('Введите имя питомца'), findsOneWidget);
    expect(find.text('Дата рождения не может быть в будущем'), findsOneWidget);
    expect(find.text('Укажите вес от 0,1 до 200 кг'), findsOneWidget);
    expect(repository.created, isFalse);
  });
}

class _FakeOwnerPetRepository implements OwnerPetRepository {
  bool created = false;

  @override
  Future<List<OwnerPet>> list() async => const <OwnerPet>[];

  @override
  Future<OwnerPet> read(String petId) {
    throw UnimplementedError();
  }

  @override
  Future<OwnerPet> create(OwnerPetProfileInput input) async {
    created = true;
    return OwnerPet(id: 'pet-1', name: input.name, species: input.species);
  }

  @override
  Future<OwnerPet> update({
    required String petId,
    required int profileVersion,
    required OwnerPetProfileInput input,
  }) {
    throw UnimplementedError();
  }
}
