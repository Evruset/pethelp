import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import 'owner_bookings_v50_repository.dart';

class OwnerBookingsV50Page extends StatefulWidget {
  const OwnerBookingsV50Page(
      {super.key,
      required this.repository,
      this.detailEnabled = false,
      this.cancellationEnabled = false,
      this.initialBucket = OwnerBookingBucket.active,
      this.online = true});
  final OwnerBookingsV50Repository repository;
  final bool detailEnabled;
  final bool cancellationEnabled;
  final OwnerBookingBucket initialBucket;
  final bool online;
  @override
  State<OwnerBookingsV50Page> createState() => _OwnerBookingsV50PageState();
}

class _OwnerBookingsV50PageState extends State<OwnerBookingsV50Page> {
  Future<OwnerBookingsPageV50>? request;
  OwnerBookingsPageV50? data;
  OwnerBookingBucket bucket = OwnerBookingBucket.active;
  String? petId;
  bool loadingMore = false;
  @override
  void initState() {
    super.initState();
    bucket = widget.initialBucket;
    _load();
  }

  void _load() {
    request = widget.repository.list(petId: petId).then((v) {
      data = v;
      return v;
    });
  }

  Future<void> _more() async {
    if (data?.nextCursor == null || loadingMore) return;
    setState(() => loadingMore = true);
    try {
      final n =
          await widget.repository.list(cursor: data!.nextCursor, petId: petId);
      final d = data!;
      data = OwnerBookingsPageV50(
          serverNow: n.serverNow,
          requiresAction: [...d.requiresAction, ...n.requiresAction],
          active: [...d.active, ...n.active],
          history: [...d.history, ...n.history],
          nextCursor: n.nextCursor);
      setState(() {});
    } finally {
      if (mounted) setState(() => loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Мои записи')),
      body: FutureBuilder<OwnerBookingsPageV50>(
          future: request,
          builder: (context, s) {
            if (s.connectionState != ConnectionState.done && data == null) {
              return const Center(
                  child:
                      CircularProgressIndicator(key: Key('bookings-loading')));
            }
            if (s.hasError && data == null) {
              return Center(
                  child: FilledButton(
                      onPressed: () {
                        setState(_load);
                      },
                      child: const Text('Повторить')));
            }
            final current = data ?? s.data!;
            final pets = {
              for (final r in current.all)
                if (r.petId.isNotEmpty) r.petId: r.petName
            };
            final rows = (switch (bucket) {
              OwnerBookingBucket.requiresAction => current.requiresAction,
              OwnerBookingBucket.active => current.active,
              OwnerBookingBucket.history => current.history
            })
                .where((r) => petId == null || r.petId == petId)
                .toList();
            return SafeArea(
                child: Center(
                    child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1040),
                        child: CustomScrollView(slivers: [
                          if (!widget.online)
                            const SliverToBoxAdapter(
                                child: MaterialBanner(
                                    content: Text(
                                        'Нет сети. Показаны сохранённые данные.'),
                                    actions: [SizedBox()])),
                          SliverToBoxAdapter(
                              child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Wrap(
                                      spacing: 12,
                                      runSpacing: 12,
                                      children: [
                                        DropdownButton<String?>(
                                            value: petId,
                                            hint: const Text('Все питомцы'),
                                            items: [
                                              const DropdownMenuItem(
                                                  value: null,
                                                  child: Text('Все питомцы')),
                                              ...pets.entries.map((e) =>
                                                  DropdownMenuItem(
                                                      value: e.key,
                                                      child: Text(e.value)))
                                            ],
                                            onChanged: (v) => setState(() {
                                                  petId = v;
                                                  data = null;
                                                  _load();
                                                })),
                                        SegmentedButton<OwnerBookingBucket>(
                                            style: const ButtonStyle(
                                                visualDensity:
                                                    VisualDensity.compact,
                                                padding: WidgetStatePropertyAll(
                                                    EdgeInsets.symmetric(
                                                        horizontal: 8))),
                                            segments: [
                                              ButtonSegment(
                                                  value: OwnerBookingBucket
                                                      .requiresAction,
                                                  label: Text(MediaQuery.sizeOf(
                                                                  context)
                                                              .width <
                                                          500
                                                      ? 'Действия'
                                                      : 'Требуют действия')),
                                              const ButtonSegment(
                                                  value:
                                                      OwnerBookingBucket.active,
                                                  label: Text('Активные')),
                                              const ButtonSegment(
                                                  value: OwnerBookingBucket
                                                      .history,
                                                  label: Text('История'))
                                            ],
                                            selected: {bucket},
                                            onSelectionChanged: (v) => setState(
                                                () => bucket = v.single))
                                      ]))),
                          if (rows.isEmpty)
                            const SliverFillRemaining(
                                child: Center(
                                    child: Text('Здесь пока нет записей')))
                          else
                            SliverPadding(
                                padding: const EdgeInsets.all(16),
                                sliver: SliverGrid(
                                    gridDelegate:
                                        const SliverGridDelegateWithMaxCrossAxisExtent(
                                            maxCrossAxisExtent: 480,
                                            mainAxisExtent: 190,
                                            crossAxisSpacing: 16,
                                            mainAxisSpacing: 16),
                                    delegate:
                                        SliverChildBuilderDelegate((c, i) {
                                      final r = rows[i];
                                      return Card(
                                          child: InkWell(
                                              onTap: widget.detailEnabled
                                                  ? () async {
                                                      await Navigator.of(
                                                              context)
                                                          .push(MaterialPageRoute(
                                                              builder: (_) => OwnerBookingDetailV50Page(
                                                                  repository: widget
                                                                      .repository,
                                                                  id: r.id,
                                                                  cancellationEnabled:
                                                                      widget
                                                                          .cancellationEnabled,
                                                                  online: widget
                                                                      .online)));
                                                      if (mounted) {
                                                        setState(_load);
                                                      }
                                                    }
                                                  : null,
                                              child: Padding(
                                                  padding:
                                                      const EdgeInsets.all(16),
                                                  child: Column(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        Text(r.statusLabel,
                                                            style: Theme.of(
                                                                    context)
                                                                .textTheme
                                                                .titleMedium),
                                                        const Spacer(),
                                                        Text(r.petName),
                                                        Text(r.clinicName),
                                                        Text(MaterialLocalizations
                                                                .of(context)
                                                            .formatFullDate(
                                                                r.startsAt)),
                                                        const SizedBox(
                                                            height: 8),
                                                        const Text(
                                                            'Открыть детали')
                                                      ]))));
                                    }, childCount: rows.length))),
                          if (current.nextCursor != null)
                            SliverToBoxAdapter(
                                child: Center(
                                    child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: FilledButton(
                                            onPressed:
                                                loadingMore ? null : _more,
                                            child: Text(loadingMore
                                                ? 'Загрузка…'
                                                : 'Показать ещё')))))
                        ]))));
          }));
}

class OwnerBookingDetailV50Page extends StatefulWidget {
  const OwnerBookingDetailV50Page(
      {super.key,
      required this.repository,
      required this.id,
      this.cancellationEnabled = false,
      this.online = true});
  final OwnerBookingsV50Repository repository;
  final String id;
  final bool cancellationEnabled;
  final bool online;
  @override
  State<OwnerBookingDetailV50Page> createState() =>
      _OwnerBookingDetailV50PageState();
}

class _OwnerBookingDetailV50PageState extends State<OwnerBookingDetailV50Page> {
  Future<OwnerBookingDetailV50>? request;
  OwnerBookingDetailV50? detail;
  bool submitting = false;
  String? operationKey, correlationId, message;
  @override
  void initState() {
    super.initState();
    _refresh();
  }

  void _refresh() {
    request = widget.repository.detail(widget.id).then((v) {
      detail = v;
      return v;
    });
  }

  Future<void> _confirm() async {
    final d = detail!;
    if (!widget.online) {
      setState(() => message =
          'Подключитесь к интернету, чтобы проверить статус и отменить запись.');
      return;
    }
    final yes = await showDialog<bool>(
            context: context,
            builder: (c) => AlertDialog(
                    title: const Text('Отменить запись?'),
                    content: Text(
                        '${d.petName} · ${d.clinicName}\n${d.cancellationReason}'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(c, false),
                          child: const Text('Сохранить запись')),
                      FilledButton(
                          onPressed: () => Navigator.pop(c, true),
                          style: FilledButton.styleFrom(
                              backgroundColor: Theme.of(c).colorScheme.error),
                          child: const Text('Отменить запись'))
                    ])) ??
        false;
    if (!yes || !mounted) return;
    operationKey ??= const Uuid().v4();
    correlationId ??= const Uuid().v4();
    setState(() => submitting = true);
    try {
      final result = await widget.repository.cancel(d,
          operationKey: operationKey!, correlationId: correlationId!);
      final fresh = await widget.repository.detail(widget.id);
      if (!mounted) return;
      setState(() {
        detail = fresh;
        request = Future.value(fresh);
        message = result.pending
            ? 'Запрос на отмену отправлен. Ожидаем подтверждение клиники.'
            : fresh.statusLabel;
      });
    } on OwnerBookingsV50Exception catch (e) {
      if (e.code == 'BOOKING_VERSION_STALE') {
        final fresh = await widget.repository.detail(widget.id);
        if (mounted) {
          setState(() {
            detail = fresh;
            request = Future.value(fresh);
            message =
                'Данные записи изменились. Мы загрузили актуальный статус.';
          });
        }
      } else if (mounted) {
        setState(() => message = e.code == 'SESSION_EXPIRED'
            ? 'Войдите снова, чтобы продолжить.'
            : 'Не удалось подтвердить результат. Проверьте актуальный статус.');
      }
    } catch (_) {
      // The command may have committed before the transport failed. Keep the
      // operation key for an explicit retry and only trust an authoritative
      // readback; never claim local cancellation success.
      try {
        final fresh = await widget.repository.detail(widget.id);
        if (mounted) {
          setState(() {
            detail = fresh;
            request = Future.value(fresh);
            message =
                'Не удалось подтвердить результат. Мы проверили актуальный статус.';
          });
        }
      } catch (_) {
        if (mounted) {
          setState(() => message =
              'Результат пока неизвестен. Проверьте статус или повторите попытку — запрос будет безопасно продолжен.');
        }
      }
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Детали записи')),
      body: FutureBuilder<OwnerBookingDetailV50>(
          future: request,
          builder: (c, s) {
            if (s.connectionState != ConnectionState.done && detail == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (s.hasError && detail == null) {
              return const Center(child: Text('Запись не найдена'));
            }
            final d = detail ?? s.data!;
            return Center(
                child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child:
                        ListView(padding: const EdgeInsets.all(20), children: [
                      Text(d.statusLabel,
                          style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 20),
                      Text(d.petName),
                      Text(d.clinicName),
                      Text(MaterialLocalizations.of(context)
                          .formatFullDate(d.startsAt)),
                      const Divider(height: 40),
                      Text('История записи',
                          style: Theme.of(context).textTheme.titleLarge),
                      ...d.timeline.map((e) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(e.isCurrent
                              ? Icons.radio_button_checked
                              : Icons.circle_outlined),
                          title: Text(e.title),
                          subtitle: Text(e.description))),
                      if (message != null)
                        Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Semantics(
                                liveRegion: true, child: Text(message!))),
                      if (widget.cancellationEnabled &&
                          d.canCancel &&
                          d.cancelAction != null)
                        SizedBox(
                            height: 48,
                            child: OutlinedButton(
                                onPressed: submitting ? null : _confirm,
                                child: Text(submitting
                                    ? 'Отправляем…'
                                    : 'Отменить запись')))
                    ])));
          }));
}
