import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../pets/owner_pet.dart';
import 'owner_pet_care_repository.dart';

class OwnerPetDiaryV50Page extends StatefulWidget {
  const OwnerPetDiaryV50Page({
    super.key,
    required this.pet,
    required this.repository,
  });

  final OwnerPet pet;
  final OwnerPetDiaryRepository repository;

  @override
  State<OwnerPetDiaryV50Page> createState() => _OwnerPetDiaryV50PageState();
}

class _OwnerPetDiaryV50PageState extends State<OwnerPetDiaryV50Page> {
  final _events = <OwnerPetDiaryEvent>[];
  int? _nextOffset;
  String? _filter;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  bool _openingDocument = false;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _openDocument(OwnerPetDiaryEvent event) async {
    if (_openingDocument || _error != null || event.status != 'READY') return;
    setState(() => _openingDocument = true);
    try {
      final document =
          await widget.repository.readDocument(widget.pet.id, event.sourceId);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(document.fileName),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (document.mimeType.startsWith('image/') &&
                    document.contentBytes != null)
                  Image.memory(document.contentBytes!, fit: BoxFit.contain)
                else
                  const Text('Предпросмотр этого формата недоступен.'),
                const SizedBox(height: 12),
                Text('Тип: ${document.mimeType}'),
                Text('Размер: ${document.sizeBytes} байт'),
              ],
            ),
          ),
          actions: [
            if (document.mimeType == 'application/pdf' &&
                document.contentBytes != null)
              FilledButton.icon(
                onPressed: () => _openPdf(document),
                icon: const Icon(Icons.open_in_new),
                label: const Text('Открыть документ'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Закрыть'),
            ),
          ],
        ),
      );
    } on OwnerPetCareApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(error.statusCode == 401
            ? 'Сессия завершена. Войдите снова.'
            : 'Не удалось открыть документ.'),
      ));
    } finally {
      if (mounted) setState(() => _openingDocument = false);
    }
  }

  Future<void> _openPdf(OwnerPetDocumentDetail document) async {
    final bytes = document.contentBytes;
    if (bytes == null) return;
    final opened = await launchUrl(
      Uri.dataFromBytes(bytes, mimeType: 'application/pdf'),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Не удалось открыть документ безопасным приложением.'),
      ));
    }
  }

  Future<void> _load({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final page = await widget.repository.readDiary(
        widget.pet.id,
        offset: reset ? 0 : (_nextOffset ?? 0),
      );
      if (!mounted) return;
      setState(() {
        if (reset) _events.clear();
        _events.addAll(page.events); // Preserve server order exactly.
        _nextOffset = page.nextOffset;
        _error = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text('Дневник · ${widget.pet.name}')),
        body: _loading && _events.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _events.isEmpty
                ? _DiaryError(onRetry: () => _load(reset: true))
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                      children: [
                        if (_error != null)
                          const Card(
                            child: ListTile(
                              leading: Icon(Icons.cloud_off_outlined),
                              title: Text('Показаны последние данные'),
                              subtitle: Text(
                                'Соединение недоступно. Действия с документами временно отключены.',
                              ),
                            ),
                          ),
                        _DiaryFilters(
                          value: _filter,
                          onChanged: (value) {
                            _filter = value;
                            _load(reset: true);
                          },
                        ),
                        if (_visibleEvents.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(32),
                            child: Center(
                              child: Text('В дневнике пока нет событий.'),
                            ),
                          )
                        else
                          for (final event in _visibleEvents)
                            _DiaryEventCard(
                              event: event,
                              stale: _error != null,
                              onOpen: () => _openDocument(event),
                            ),
                        if (_nextOffset != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: OutlinedButton(
                              onPressed: _loadingMore
                                  ? null
                                  : () => _load(reset: false),
                              child: Text(_loadingMore
                                  ? 'Загрузка…'
                                  : 'Показать более ранние события'),
                            ),
                          ),
                      ],
                    ),
                  ),
      );

  List<OwnerPetDiaryEvent> get _visibleEvents => _filter == null
      ? _events
      : _events.where((event) => event.type == _filter).toList(growable: false);
}

class _DiaryFilters extends StatelessWidget {
  const _DiaryFilters({required this.value, required this.onChanged});
  final String? value;
  final ValueChanged<String?> onChanged;
  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        children: [
          for (final option in const <String?, String>{
            null: 'Все',
            'VISIT': 'Визиты',
            'DOCUMENT': 'Документы',
            'TELEMED': 'Онлайн',
          }.entries)
            ChoiceChip(
              label: Text(option.value),
              selected: value == option.key,
              onSelected: (_) => onChanged(option.key),
            ),
        ],
      );
}

class _DiaryEventCard extends StatelessWidget {
  const _DiaryEventCard({
    required this.event,
    required this.stale,
    required this.onOpen,
  });
  final OwnerPetDiaryEvent event;
  final bool stale;
  final VoidCallback onOpen;
  @override
  Widget build(BuildContext context) {
    final statusLabel = switch (event.status) {
      'PROCESSING' => 'Обрабатывается',
      'FAILED' => 'Не обработан',
      'REVIEW_REQUIRED' => 'Требует проверки',
      _ => null,
    };
    final document = event.type == 'DOCUMENT';
    final supported = document && event.downloadUrl != null;
    return Card(
      child: ListTile(
        onTap: stale || !supported || event.status != 'READY' ? null : onOpen,
        leading: Icon(
            !document ? Icons.event_note_outlined : Icons.description_outlined),
        title: Text(event.title),
        subtitle: Text([
          if (event.summary.isNotEmpty) event.summary,
          if (statusLabel != null) statusLabel,
          if (document)
            supported
                ? 'Документ готов к безопасному просмотру'
                : 'Предпросмотр документа недоступен',
        ].join('\n')),
        trailing: stale || !supported || event.status != 'READY'
            ? null
            : const Icon(Icons.open_in_new),
      ),
    );
  }
}

class _DiaryError extends StatelessWidget {
  const _DiaryError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: FilledButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('Повторить загрузку'),
        ),
      );
}
