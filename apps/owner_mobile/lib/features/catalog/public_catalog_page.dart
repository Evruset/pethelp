import 'package:flutter/material.dart';

import 'catalog_models.dart';
import 'public_catalog_repository.dart';

class PublicCatalogPage extends StatefulWidget {
  const PublicCatalogPage({
    super.key,
    required this.repository,
    required this.onSelected,
  });

  final PublicCatalogRepository repository;
  final ValueChanged<CatalogLocation> onSelected;

  @override
  State<PublicCatalogPage> createState() => _PublicCatalogPageState();
}

class _PublicCatalogPageState extends State<PublicCatalogPage> {
  final _search = TextEditingController();
  Future<List<CatalogLocation>>? _request;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _reload() {
    setState(() {
      _request = widget.repository.listLocations(query: _search.text);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Выберите клинику')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: SearchBar(
                controller: _search,
                hintText: 'Название или адрес',
                leading: const Icon(Icons.search),
                trailing: [IconButton(onPressed: _reload, icon: const Icon(Icons.refresh))],
                onSubmitted: (_) => _reload(),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Text(
                'Наличие времени — моментальный снимок. Время фиксируется только после создания заявки.',
              ),
            ),
            Expanded(
              child: FutureBuilder<List<CatalogLocation>>(
                future: _request,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return _CatalogError(onRetry: _reload);
                  }
                  final locations = snapshot.data ?? const <CatalogLocation>[];
                  if (locations.isEmpty) return const _CatalogEmpty();
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    itemCount: locations.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final location = locations[index];
                      return Card(
                        clipBehavior: Clip.antiAlias,
                        child: ListTile(
                          onTap: () => widget.onSelected(location),
                          leading: Icon(location.hasOpenSlots ? Icons.event_available_outlined : Icons.event_busy_outlined),
                          title: Text(location.clinicName),
                          subtitle: Text('${location.address}${location.phone == null ? '' : '\n${location.phone}'}'),
                          isThreeLine: location.phone != null,
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                location.hasOpenSlots ? 'Есть время' : 'Нет времени',
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                              const Icon(Icons.chevron_right),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CatalogError extends StatelessWidget {
  const _CatalogError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 48),
            const SizedBox(height: 12),
            Text('Не удалось загрузить каталог', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text('Проверьте подключение и повторите попытку.'),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Повторить')),
          ],
        ),
      ),
    );
  }
}

class _CatalogEmpty extends StatelessWidget {
  const _CatalogEmpty();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text('По этому запросу активных клиник не найдено.'),
      ),
    );
  }
}
