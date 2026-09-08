import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../pets/owner_pet.dart';
import '../pets/owner_v50_pet_visuals.dart';
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
  final FocusNode _documentTriggerFocus = FocusNode(
    debugLabel: 'owner-diary-document-trigger',
  );

  @override
  void dispose() {
    _documentTriggerFocus.dispose();
    super.dispose();
  }

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
      if (mounted) _documentTriggerFocus.requestFocus();
    } on OwnerPetCareApiException catch (error) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(error.statusCode == 401
              ? 'Сессия завершена'
              : 'Документ временно недоступен'),
          content: Text(error.statusCode == 401
              ? 'Войдите снова, чтобы безопасно запросить документ.'
              : 'Метаданные события сохранены. Повторная попытка выполнит новую проверку доступа владельца.'),
          actions: [
            if (error.statusCode != 401)
              FilledButton.icon(
                onPressed: () {
                  Navigator.pop(dialogContext);
                  _openDocument(event);
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Повторить'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Закрыть'),
            ),
          ],
        ),
      );
      if (mounted) _documentTriggerFocus.requestFocus();
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
  Widget build(BuildContext context) => Material(
        color: Theme.of(context).colorScheme.surfaceContainerLowest,
        child: _loading && _events.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _events.isEmpty
                ? _DiaryError(onRetry: () => _load(reset: true))
                : OwnerV50PetPageFrame(
                    title: 'Дневник здоровья',
                    supportingText:
                        'Визиты, онлайн-помощь и документы ${widget.pet.name} в одном месте.',
                    leading: TextButton(
                      key: const ValueKey('diary-back-action'),
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: Text('← К карточке ${widget.pet.name}'),
                    ),
                    status: _error == null
                        ? null
                        : OwnerV50StatusBanner(
                            key: const ValueKey('diary-stale-banner'),
                            icon: Icons.cloud_off_outlined,
                            title: 'Показаны последние данные',
                            message:
                                'Соединение недоступно. Действия с документами временно отключены.',
                            action: TextButton(
                              onPressed: () => _load(reset: true),
                              child: const Text('Обновить'),
                            ),
                          ),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final chronology = Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            OwnerV50InsetSection(
                              title: 'История',
                              child: _DiaryFilters(
                                value: _filter,
                                onChanged: (value) {
                                  setState(() => _filter = value);
                                },
                              ),
                            ),
                            const SizedBox(height: 18),
                            if (_visibleEvents.isEmpty)
                              const _DiaryEmpty()
                            else
                              OwnerV50InsetSection(
                                child: _DiaryChronology(
                                  events: _visibleEvents,
                                  stale: _error != null,
                                  documentFocusNode: _documentTriggerFocus,
                                  onOpen: _openDocument,
                                ),
                              ),
                            if (_nextOffset != null) ...[
                              const SizedBox(height: 12),
                              OutlinedButton(
                                onPressed: _loadingMore
                                    ? null
                                    : () => _load(reset: false),
                                child: Text(_loadingMore
                                    ? 'Загрузка…'
                                    : 'Показать более ранние события'),
                              ),
                            ],
                          ],
                        );
                        if (constraints.maxWidth < 760) return chronology;
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 2, child: chronology),
                            const SizedBox(width: 22),
                            Expanded(
                              child: OwnerV50InsetSection(
                                title: widget.pet.name,
                                child: Column(
                                  children: [
                                    OwnerV50PetAvatar(
                                        pet: widget.pet, size: 150),
                                    const SizedBox(height: 14),
                                    const Text(
                                      'Порядок событий и статусы документов получены с сервера.',
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      },
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
              key: ValueKey('diary-filter-${option.key ?? 'all'}'),
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
    this.focusNode,
  });
  final OwnerPetDiaryEvent event;
  final bool stale;
  final VoidCallback onOpen;
  final FocusNode? focusNode;
  @override
  Widget build(BuildContext context) {
    final statusLabel = switch (event.status) {
      'PROCESSING' => 'Обрабатывается',
      'FAILED' => 'Не обработан',
      'REVIEW_REQUIRED' => 'Требует проверки',
      'ARCHIVED' => 'В архиве',
      _ => null,
    };
    final document = event.type == 'DOCUMENT';
    final supported = document && event.downloadUrl != null;
    final canOpen = !stale && supported && event.status == 'READY';
    final colors = Theme.of(context).colorScheme;
    final card = Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Icon(
                !document
                    ? Icons.event_note_outlined
                    : Icons.description_outlined,
                color: colors.primary,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        )),
                if (event.summary.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(event.summary),
                ],
                if (statusLabel != null) ...[
                  const SizedBox(height: 8),
                  Chip(
                    label: Text(statusLabel),
                    avatar: Icon(
                      event.status == 'FAILED'
                          ? Icons.error_outline
                          : Icons.info_outline,
                      size: 16,
                    ),
                    visualDensity: VisualDensity.compact,
                    side: BorderSide.none,
                  ),
                ],
                if (document) ...[
                  const SizedBox(height: 5),
                  Text(
                    canOpen
                        ? 'Документ готов к безопасному просмотру'
                        : event.status == 'ARCHIVED'
                            ? 'Архивный документ доступен только как история'
                            : 'Предпросмотр документа недоступен',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
          if (document)
            IconButton(
              key: ValueKey('diary-document-action-${event.sourceId}'),
              focusNode: focusNode,
              tooltip: canOpen ? 'Открыть документ' : 'Документ недоступен',
              onPressed: canOpen ? onOpen : null,
              icon: const Icon(Icons.open_in_new),
            ),
        ],
      ),
    );
    return Focus(
      key: ValueKey('diary-event-${event.sourceId}'),
      canRequestFocus: !document,
      child: card,
    );
  }
}

class _DiaryChronology extends StatelessWidget {
  const _DiaryChronology({
    required this.events,
    required this.stale,
    required this.documentFocusNode,
    required this.onOpen,
  });

  final List<OwnerPetDiaryEvent> events;
  final bool stale;
  final FocusNode documentFocusNode;
  final ValueChanged<OwnerPetDiaryEvent> onOpen;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    DateTime? previousDay;
    for (var index = 0; index < events.length; index++) {
      final event = events[index];
      if (previousDay == null || !_sameDay(previousDay, event.occurredAt)) {
        children.add(Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
          child: Text(
            _diaryDate(event.occurredAt),
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ));
      }
      children.add(_DiaryEventCard(
        event: event,
        stale: stale,
        focusNode: event.type == 'DOCUMENT' ? documentFocusNode : null,
        onOpen: () => onOpen(event),
      ));
      if (index < events.length - 1) children.add(const Divider(height: 1));
      previousDay = event.occurredAt;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}

class _DiaryEmpty extends StatelessWidget {
  const _DiaryEmpty();

  @override
  Widget build(BuildContext context) => OwnerV50InsetSection(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 34),
          child: Column(
            children: [
              Icon(Icons.event_note_outlined,
                  size: 52, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 14),
              Text('В дневнике пока нет событий.',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      )),
              const SizedBox(height: 6),
              const Text(
                'Новые визиты и доступные владельцу документы появятся здесь в серверном порядке.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

String _diaryDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';

class _DiaryError extends StatelessWidget {
  const _DiaryError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: OwnerV50InsetSection(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 48),
              const SizedBox(height: 12),
              const Text('Дневник недоступен'),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Повторить загрузку'),
              ),
            ],
          ),
        ),
      );
}
