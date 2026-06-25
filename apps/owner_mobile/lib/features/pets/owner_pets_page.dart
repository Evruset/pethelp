import 'package:flutter/material.dart';

import 'owner_pet.dart';
import 'owner_pet_repository.dart';

class OwnerPetsPage extends StatefulWidget {
  const OwnerPetsPage({
    super.key,
    required this.repository,
    required this.onPetSelected,
  });

  final OwnerPetRepository repository;
  final ValueChanged<OwnerPet> onPetSelected;

  @override
  State<OwnerPetsPage> createState() => _OwnerPetsPageState();
}

class _OwnerPetsPageState extends State<OwnerPetsPage> {
  Future<List<OwnerPet>>? _request;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() => _request = widget.repository.list());

  Future<void> _createPet() async {
    final result = await showModalBottomSheet<_PetDraft>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _PetForm(),
    );
    if (result == null || !mounted) return;
    try {
      final pet = await widget.repository.create(name: result.name, species: result.species);
      if (!mounted) return;
      widget.onPetSelected(pet);
      _reload();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${pet.name} добавлен и выбран для записи.')));
    } on OwnerPetApiException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Не удалось добавить питомца. Повторите попытку.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<OwnerPet>>(
      future: _request,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: FilledButton.icon(
              onPressed: _reload,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить загрузку'),
            ),
          );
        }
        final pets = snapshot.data ?? const <OwnerPet>[];
        return Scaffold(
          floatingActionButton: FloatingActionButton.extended(
            onPressed: _createPet,
            icon: const Icon(Icons.add),
            label: const Text('Добавить питомца'),
          ),
          body: pets.isEmpty
              ? const _PetsEmpty()
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 96),
                  itemCount: pets.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final pet = pets[index];
                    return Card(
                      child: ListTile(
                        onTap: () => widget.onPetSelected(pet),
                        leading: const CircleAvatar(child: Icon(Icons.pets)),
                        title: Text(pet.name),
                        subtitle: Text(_speciesTitle(pet.species)),
                        trailing: const Icon(Icons.chevron_right),
                      ),
                    );
                  },
                ),
        );
      },
    );
  }
}

class _PetsEmpty extends StatelessWidget {
  const _PetsEmpty();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('Добавьте питомца, чтобы продолжить запись в клинику.'),
        ),
      );
}

class _PetDraft {
  const _PetDraft(this.name, this.species);
  final String name;
  final String species;
}

class _PetForm extends StatefulWidget {
  const _PetForm();

  @override
  State<_PetForm> createState() => _PetFormState();
}

class _PetFormState extends State<_PetForm> {
  final _name = TextEditingController();
  String _species = 'DOG';

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Новый питомец', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Имя питомца'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'DOG', label: Text('Собака')),
              ButtonSegment(value: 'CAT', label: Text('Кошка')),
              ButtonSegment(value: 'OTHER', label: Text('Другое')),
            ],
            selected: {_species},
            onSelectionChanged: (value) => setState(() => _species = value.single),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _name.text.trim().isEmpty ? null : () => Navigator.of(context).pop(_PetDraft(_name.text.trim(), _species)),
            child: const Text('Сохранить'),
          ),
        ],
      ),
    );
  }
}

String _speciesTitle(String value) => switch (value) {
      'DOG' => 'Собака',
      'CAT' => 'Кошка',
      _ => 'Другой вид',
    };
