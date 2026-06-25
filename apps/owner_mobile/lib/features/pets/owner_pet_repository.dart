import 'owner_pet.dart';

abstract class OwnerPetRepository {
  Future<List<OwnerPet>> list();
  Future<OwnerPet> create({required String name, required String species});
}
