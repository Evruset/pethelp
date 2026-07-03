import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../presentation/platform/owner_platform.dart';
import '../../presentation/widgets/owner_cupertino_feedback.dart';
import '../pets/owner_pet.dart';
import '../pets/owner_pet_files.dart';
import 'owner_pet_care_repository.dart';

class OwnerPetCarePage extends StatefulWidget {
  const OwnerPetCarePage({
    super.key,
    required this.pet,
    required this.repository,
    this.onRebookVisit,
    this.platformOverride,
    this.pickDocuments,
  });

  final OwnerPet pet;
  final OwnerPetCareRepository repository;
  final ValueChanged<OwnerPetCareRebookIntent>? onRebookVisit;
  final TargetPlatform? platformOverride;
  final Future<List<OwnerPickedPetFile>> Function()? pickDocuments;

  @override
  State<OwnerPetCarePage> createState() => _OwnerPetCarePageState();
}

class _OwnerPetCarePageState extends State<OwnerPetCarePage> {
  Future<OwnerPetCareSummary>? _request;
  bool _documentUploadInProgress = false;
  String? _documentUploadError;
  List<OwnerPickedPetFile>? _lastDocumentFiles;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _request = widget.repository.readSummary(widget.pet.id);
    });
  }

  Future<void> _refresh() async {
    _reload();
    await _request;
  }

  Future<void> _attachDocuments() async {
    final files = await (widget.pickDocuments ?? pickOwnerPetDocumentFiles)();
    if (files.isEmpty || !mounted) return;
    await _uploadDocuments(files);
  }

  Future<void> _retryDocumentUpload() async {
    final files = _lastDocumentFiles;
    if (files == null || files.isEmpty) return;
    await _uploadDocuments(files);
  }

  Future<void> _uploadDocuments(List<OwnerPickedPetFile> files) async {
    String? validation;
    for (final file in files) {
      validation = ownerPetUploadValidationError(file, allowPdf: true);
      if (validation != null) break;
    }
    if (validation != null) {
      setState(() {
        _documentUploadError = validation;
        _lastDocumentFiles = files;
      });
      return;
    }
    setState(() {
      _documentUploadInProgress = true;
      _documentUploadError = null;
      _lastDocumentFiles = files;
    });
    try {
      for (final file in files) {
        await widget.repository.uploadDocumentFile(
          petId: widget.pet.id,
          file: file,
          docType: 'HISTORY',
        );
      }
      if (!mounted) return;
      setState(() {
        _documentUploadInProgress = false;
        _documentUploadError = null;
        _lastDocumentFiles = null;
      });
      _reload();
    } on OwnerPetCareApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _documentUploadInProgress = false;
        _documentUploadError = _documentUploadErrorText(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _documentUploadInProgress = false;
        _documentUploadError =
            'Не удалось загрузить документы. Проверьте соединение и повторите попытку.';
      });
    }
  }

  Future<void> _deleteDocument(OwnerPetCareDocument document) async {
    final documentId = document.id;
    if (documentId == null || _documentUploadInProgress) return;
    setState(() {
      _documentUploadInProgress = true;
      _documentUploadError = null;
    });
    try {
      await widget.repository.deleteDocument(
        petId: widget.pet.id,
        documentId: documentId,
      );
      if (!mounted) return;
      setState(() {
        _documentUploadInProgress = false;
      });
      _reload();
    } on OwnerPetCareApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _documentUploadInProgress = false;
        _documentUploadError = _documentUploadErrorText(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _documentUploadInProgress = false;
        _documentUploadError =
            'Не удалось удалить документ. Проверьте соединение и повторите попытку.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (ownerUsesCupertino(platform: widget.platformOverride)) {
      return _buildCupertino(context);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Медицинская карта')),
      body: FutureBuilder<OwnerPetCareSummary>(
        future: _request,
        builder: (context, snapshot) {
          final summary = snapshot.data;
          if (snapshot.connectionState != ConnectionState.done &&
              summary == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (summary == null) {
            return _CareLoadError(onRetry: _reload);
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                if (snapshot.hasError) const _StaleCareBanner(),
                _CareHeader(pet: summary.pet),
                const SizedBox(height: 12),
                _HealthProfileCard(pet: summary.pet),
                const SizedBox(height: 12),
                _DocumentsCard(
                  documents: summary.documents,
                  uploading: _documentUploadInProgress,
                  error: _documentUploadError,
                  onAttach: _attachDocuments,
                  onRetry: _retryDocumentUpload,
                  onDelete: _deleteDocument,
                ),
                const SizedBox(height: 12),
                _VisitHistoryCard(visits: summary.visits),
                const SizedBox(height: 12),
                _TelemedHistoryCard(sessions: summary.telemedSessions),
                const SizedBox(height: 12),
                Text(
                  'Обновлено: ${_dateTime(context, summary.serverNow)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCupertino(BuildContext context) {
    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(widget.pet.name),
        transitionBetweenRoutes: false,
      ),
      child: FutureBuilder<OwnerPetCareSummary>(
        future: _request,
        builder: (context, snapshot) {
          final summary = snapshot.data;
          if (snapshot.connectionState != ConnectionState.done &&
              summary == null) {
            return const SafeArea(
              child: OwnerCupertinoLoading(label: 'Загружаем дневник'),
            );
          }
          if (summary == null) {
            return SafeArea(
              child: OwnerCupertinoEmptyState(
                icon: CupertinoIcons.cloud,
                title: 'Не удалось загрузить дневник',
                message: 'Повторная попытка обновит дневник здоровья питомца.',
                actionLabel: 'Обновить дневник',
                onAction: _reload,
              ),
            );
          }
          return SafeArea(
            bottom: false,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                CupertinoSliverRefreshControl(onRefresh: _refresh),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                  sliver: SliverList.list(
                    children: [
                      if (snapshot.hasError) ...[
                        const OwnerCupertinoStatusBanner(
                          tone: OwnerCupertinoFeedbackTone.warning,
                          icon: CupertinoIcons.cloud,
                          message:
                              'Показаны последние полученные данные. Потяните вниз, чтобы обновить дневник.',
                          liveRegion: true,
                        ),
                        const SizedBox(height: 14),
                      ],
                      _CupertinoCareHeader(pet: summary.pet),
                      const SizedBox(height: 14),
                      _CupertinoNextCareAction(
                        summary: summary,
                        onRebookVisit: widget.onRebookVisit,
                      ),
                      const SizedBox(height: 14),
                      _CupertinoDiarySection(
                        summary: summary,
                        onRebookVisit: widget.onRebookVisit,
                      ),
                      const SizedBox(height: 14),
                      _CupertinoPetDetailsSection(pet: summary.pet),
                      const SizedBox(height: 14),
                      _CupertinoDocumentsSection(
                        documents: summary.documents,
                        uploading: _documentUploadInProgress,
                        error: _documentUploadError,
                        onAttach: _attachDocuments,
                        onRetry: _retryDocumentUpload,
                        onDelete: _deleteDocument,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Обновлено: ${_cupertinoDateTime(summary.serverNow)}',
                        style: CupertinoTheme.of(context)
                            .textTheme
                            .textStyle
                            .copyWith(
                              color: CupertinoDynamicColor.resolve(
                                CupertinoColors.secondaryLabel,
                                context,
                              ),
                              fontSize: 13,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class OwnerPetCareRebookIntent {
  const OwnerPetCareRebookIntent({
    required this.pet,
    required this.clinicName,
    required this.clinicAddress,
    required this.serviceName,
  });

  final OwnerPet pet;
  final String clinicName;
  final String clinicAddress;
  final String serviceName;
}

class _CareLoadError extends StatelessWidget {
  const _CareLoadError({required this.onRetry});

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
            Text(
              'Не удалось загрузить карту',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Проверьте подключение и повторите попытку.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StaleCareBanner extends StatelessWidget {
  const _StaleCareBanner();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: const ListTile(
        leading: Icon(Icons.cloud_off_outlined),
        title: Text('Показаны последние полученные данные'),
        subtitle: Text('Потяните экран вниз, чтобы обновить карту.'),
      ),
    );
  }
}

class _CupertinoCareHeader extends StatelessWidget {
  const _CupertinoCareHeader({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CupertinoDynamicColor.resolve(
          CupertinoColors.secondarySystemGroupedBackground,
          context,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.tertiarySystemFill,
                  context,
                ),
                shape: BoxShape.circle,
              ),
              child: const SizedBox.square(
                dimension: 66,
                child: Icon(CupertinoIcons.paw, size: 30),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pet.name,
                    style: CupertinoTheme.of(context)
                        .textTheme
                        .navLargeTitleTextStyle
                        .copyWith(fontSize: 26),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _petSubtitle(context, pet),
                    style: CupertinoTheme.of(context)
                        .textTheme
                        .textStyle
                        .copyWith(color: secondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CupertinoNextCareAction extends StatelessWidget {
  const _CupertinoNextCareAction({
    required this.summary,
    required this.onRebookVisit,
  });

  final OwnerPetCareSummary summary;
  final ValueChanged<OwnerPetCareRebookIntent>? onRebookVisit;

  @override
  Widget build(BuildContext context) {
    final latestVisit = _latestVisit(summary.visits);
    if (latestVisit == null) {
      return const OwnerCupertinoStatusBanner(
        tone: OwnerCupertinoFeedbackTone.neutral,
        title: 'Что дальше',
        message:
            'Когда появится завершённый визит или консультация, здесь будет последний медицинский контекст.',
      );
    }
    final clinicalSummary = latestVisit.clinicalSummary?.trim();
    return OwnerCupertinoStatusBanner(
      tone: latestVisit.presentation.tone == 'warning'
          ? OwnerCupertinoFeedbackTone.warning
          : OwnerCupertinoFeedbackTone.neutral,
      title: 'Последнее действие',
      icon: CupertinoIcons.check_mark_circled,
      message: clinicalSummary == null || clinicalSummary.isEmpty
          ? '${latestVisit.presentation.label}. ${latestVisit.clinicName}, ${_cupertinoDate(latestVisit.startsAt)}.'
          : 'После визита: $clinicalSummary',
      actionLabel: _canRebook(latestVisit) && onRebookVisit != null
          ? 'Подобрать повторную запись'
          : null,
      onAction: _canRebook(latestVisit) && onRebookVisit != null
          ? () => onRebookVisit!(_rebookIntent(summary.pet, latestVisit))
          : null,
    );
  }
}

class _CupertinoDiarySection extends StatelessWidget {
  const _CupertinoDiarySection({
    required this.summary,
    required this.onRebookVisit,
  });

  final OwnerPetCareSummary summary;
  final ValueChanged<OwnerPetCareRebookIntent>? onRebookVisit;

  @override
  Widget build(BuildContext context) {
    final entries = _diaryEntries(summary);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const OwnerCupertinoSectionHeader(
          title: 'Pet Diary',
          supportingText: 'Журнал визитов, документов и онлайн-консультаций.',
        ),
        const SizedBox(height: 8),
        if (entries.isEmpty)
          const OwnerCupertinoEmptyState(
            icon: CupertinoIcons.book,
            title: 'Дневник пока пуст',
            message:
                'Здесь появятся завершённые визиты, заключения врача, документы и онлайн-консультации.',
          )
        else
          DecoratedBox(
            decoration: BoxDecoration(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.secondarySystemGroupedBackground,
                context,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: CupertinoDynamicColor.resolve(
                  CupertinoColors.separator,
                  context,
                ),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  for (var index = 0; index < entries.length; index++) ...[
                    if (index > 0) const _CupertinoCareDivider(),
                    _CupertinoDiaryEntryRow(
                      entry: entries[index],
                      onRebookVisit: onRebookVisit,
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _CupertinoDiaryEntryRow extends StatelessWidget {
  const _CupertinoDiaryEntryRow({
    required this.entry,
    required this.onRebookVisit,
  });

  final _DiaryEntry entry;
  final ValueChanged<OwnerPetCareRebookIntent>? onRebookVisit;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      label:
          '${entry.title}. ${entry.description}. ${_cupertinoDate(entry.at)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(entry.icon, color: secondary, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.title,
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _cupertinoDate(entry.at),
                      style: CupertinoTheme.of(context)
                          .textTheme
                          .textStyle
                          .copyWith(color: secondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(entry.description),
          if (entry.clinicLine != null) ...[
            const SizedBox(height: 4),
            Text(
              entry.clinicLine!,
              style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                    color: secondary,
                    fontSize: 13,
                  ),
            ),
          ],
          if (entry.rebookIntent != null && onRebookVisit != null) ...[
            const SizedBox(height: 10),
            OwnerCupertinoButton.secondary(
              label: 'Подобрать повторную запись',
              icon: CupertinoIcons.calendar_badge_plus,
              semanticLabel:
                  'Подобрать повторную запись для ${entry.rebookIntent!.pet.name}',
              onPressed: () => onRebookVisit!(entry.rebookIntent!),
            ),
          ],
        ],
      ),
    );
  }
}

class _CupertinoPetDetailsSection extends StatelessWidget {
  const _CupertinoPetDetailsSection({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final facts = <_CareFact>[
      if (pet.weightKg != null)
        _CareFact(Icons.scale_outlined, 'Вес', pet.weightKg!),
      if (pet.sterilized != null)
        _CareFact(Icons.monitor_heart_outlined, 'Стерилизация',
            _sterilized(pet.sterilized)),
      if (pet.allergies.isNotEmpty)
        _CareFact(Icons.warning_amber_outlined, 'Аллергии',
            _listOrEmpty(pet.allergies)),
      if (pet.chronicConditions.isNotEmpty)
        _CareFact(Icons.medical_information_outlined, 'Хронические состояния',
            _listOrEmpty(pet.chronicConditions)),
      if (pet.vaccinationNotes != null)
        _CareFact(Icons.vaccines_outlined, 'Вакцинация', pet.vaccinationNotes!),
    ];
    if (facts.isEmpty) {
      return const OwnerCupertinoStatusBanner(
        tone: OwnerCupertinoFeedbackTone.neutral,
        title: 'Сведения о питомце',
        message:
            'Дополнительные сведения пока не заполнены. Не добавляем медицинские предположения без данных.',
      );
    }
    return _CupertinoCareSection(
      title: 'Сведения о питомце',
      children: [
        for (var index = 0; index < facts.length; index++) ...[
          if (index > 0) const _CupertinoCareDivider(),
          _CupertinoCareFactRow(fact: facts[index]),
        ],
      ],
    );
  }
}

class _CupertinoDocumentsSection extends StatelessWidget {
  const _CupertinoDocumentsSection({
    required this.documents,
    required this.uploading,
    required this.error,
    required this.onAttach,
    required this.onRetry,
    required this.onDelete,
  });

  final List<OwnerPetCareDocument> documents;
  final bool uploading;
  final String? error;
  final VoidCallback onAttach;
  final VoidCallback onRetry;
  final ValueChanged<OwnerPetCareDocument> onDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: OwnerCupertinoSectionHeader(
                title: 'Документы',
                supportingText: 'Файлы, которые вы загрузили для питомца.',
              ),
            ),
            CupertinoButton(
              minSize: 44,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              onPressed: uploading ? null : onAttach,
              child: uploading
                  ? const CupertinoActivityIndicator()
                  : const Text('Добавить'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (error != null) ...[
          OwnerCupertinoInlineError(
            title: 'Документ не загружен',
            message: error!,
            retryLabel: 'Повторить загрузку',
            onRetry: onRetry,
          ),
          const SizedBox(height: 10),
        ],
        DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.secondarySystemGroupedBackground,
              context,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.separator,
                context,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: documents.isEmpty
                ? const _CupertinoDocumentEmptyState()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var index = 0;
                          index < documents.length;
                          index++) ...[
                        if (index > 0) const _CupertinoCareDivider(),
                        _CupertinoDocumentRow(
                          document: documents[index],
                          onDelete: documents[index].canDelete
                              ? () => onDelete(documents[index])
                              : null,
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

class _CupertinoCareSection extends StatelessWidget {
  const _CupertinoCareSection({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OwnerCupertinoSectionHeader(title: title),
        const SizedBox(height: 8),
        DecoratedBox(
          decoration: BoxDecoration(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.secondarySystemGroupedBackground,
              context,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: CupertinoDynamicColor.resolve(
                CupertinoColors.separator,
                context,
              ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ],
    );
  }
}

class _CupertinoCareFactRow extends StatelessWidget {
  const _CupertinoCareFactRow({required this.fact});

  final _CareFact fact;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Semantics(
      label: '${fact.label}: ${fact.value}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_cupertinoFactIcon(fact.icon), color: secondary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fact.label,
                  style:
                      CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                            color: secondary,
                            fontSize: 13,
                          ),
                ),
                const SizedBox(height: 2),
                Text(fact.value),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CupertinoDocumentRow extends StatelessWidget {
  const _CupertinoDocumentRow({
    required this.document,
    required this.onDelete,
  });

  final OwnerPetCareDocument document;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    final title = document.fileName ?? document.label;
    return Semantics(
      label: '$title. ${_documentMetadata(document)}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CupertinoDocumentPreview(document: document),
          const SizedBox(width: 10),
          Expanded(
            child: CupertinoButton(
              minSize: 44,
              padding: EdgeInsets.zero,
              alignment: Alignment.centerLeft,
              onPressed: document.canOpen
                  ? () => _openOrCopy(
                      context, document.downloadUrl ?? document.value)
                  : null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title),
                  const SizedBox(height: 2),
                  Text(
                    _documentMetadata(document),
                    style:
                        CupertinoTheme.of(context).textTheme.textStyle.copyWith(
                              color: secondary,
                              fontSize: 13,
                            ),
                  ),
                ],
              ),
            ),
          ),
          if (onDelete != null)
            CupertinoButton(
              minSize: 44,
              padding: EdgeInsets.zero,
              onPressed: onDelete,
              child: Icon(CupertinoIcons.delete, color: secondary, size: 22),
            ),
        ],
      ),
    );
  }
}

class _CupertinoDocumentPreview extends StatelessWidget {
  const _CupertinoDocumentPreview({required this.document});

  final OwnerPetCareDocument document;

  @override
  Widget build(BuildContext context) {
    final color = CupertinoDynamicColor.resolve(
      CupertinoColors.tertiarySystemFill,
      context,
    );
    final foreground = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox.square(
        dimension: 44,
        child: ColoredBox(
          color: color,
          child: Icon(_cupertinoDocumentIcon(document.type), color: foreground),
        ),
      ),
    );
  }
}

class _CupertinoDocumentEmptyState extends StatelessWidget {
  const _CupertinoDocumentEmptyState();

  @override
  Widget build(BuildContext context) {
    final secondary = CupertinoDynamicColor.resolve(
      CupertinoColors.secondaryLabel,
      context,
    );
    return Text(
      'Загрузите фото медицинского документа или PDF. Здесь будут только реально добавленные файлы.',
      style: CupertinoTheme.of(context).textTheme.textStyle.copyWith(
            color: secondary,
          ),
    );
  }
}

class _CupertinoCareDivider extends StatelessWidget {
  const _CupertinoCareDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: ColoredBox(
        color:
            CupertinoDynamicColor.resolve(CupertinoColors.separator, context),
        child: const SizedBox(height: .5),
      ),
    );
  }
}

class _CareHeader extends StatelessWidget {
  const _CareHeader({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      color: colors.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: colors.surface,
              child: const Icon(Icons.pets_outlined),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(pet.name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(_petSubtitle(context, pet)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HealthProfileCard extends StatelessWidget {
  const _HealthProfileCard({required this.pet});

  final OwnerPet pet;

  @override
  Widget build(BuildContext context) {
    final rows = <_CareFact>[
      _CareFact(Icons.scale_outlined, 'Вес', pet.weightKg ?? 'Не указан'),
      _CareFact(Icons.monitor_heart_outlined, 'Стерилизация',
          _sterilized(pet.sterilized)),
      _CareFact(Icons.warning_amber_outlined, 'Аллергии',
          _listOrEmpty(pet.allergies)),
      _CareFact(Icons.medical_information_outlined, 'Хронические состояния',
          _listOrEmpty(pet.chronicConditions)),
      _CareFact(Icons.vaccines_outlined, 'Вакцинация',
          pet.vaccinationNotes ?? 'Нет заметок'),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Профиль здоровья',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const Divider(height: 16),
              itemBuilder: (context, index) => _CareFactRow(fact: rows[index]),
            ),
          ],
        ),
      ),
    );
  }
}

class _CareFact {
  const _CareFact(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;
}

class _CareFactRow extends StatelessWidget {
  const _CareFactRow({required this.fact});

  final _CareFact fact;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(fact.icon, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fact.label, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 2),
              Text(fact.value),
            ],
          ),
        ),
      ],
    );
  }
}

class _DocumentsCard extends StatelessWidget {
  const _DocumentsCard({
    required this.documents,
    required this.uploading,
    required this.error,
    required this.onAttach,
    required this.onRetry,
    required this.onDelete,
  });

  final List<OwnerPetCareDocument> documents;
  final bool uploading;
  final String? error;
  final VoidCallback onAttach;
  final VoidCallback onRetry;
  final ValueChanged<OwnerPetCareDocument> onDelete;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Документы',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                FilledButton.tonalIcon(
                  onPressed: uploading ? null : onAttach,
                  icon: uploading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.attach_file),
                  label: const Text('Добавить'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (error != null) ...[
              Text(error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: uploading ? null : onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Повторить загрузку'),
              ),
              const SizedBox(height: 8),
            ],
            if (documents.isEmpty)
              const Text(
                'Загрузите фото медицинского документа или PDF. Здесь будут только реально добавленные файлы.',
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: documents.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) => _DocumentTile(
                  document: documents[index],
                  onDelete: documents[index].canDelete
                      ? () => onDelete(documents[index])
                      : null,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.document, required this.onDelete});

  final OwnerPetCareDocument document;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final title = document.fileName ?? document.label;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ListTile(
        leading: Icon(_documentIcon(document.type)),
        title: Text(title),
        subtitle: Text(_documentMetadata(document)),
        trailing: Wrap(
          spacing: 4,
          children: [
            if (document.canOpen)
              IconButton(
                tooltip: 'Открыть документ',
                onPressed: () => _openOrCopy(
                  context,
                  document.downloadUrl ?? document.value,
                ),
                icon: const Icon(Icons.open_in_new),
              ),
            if (onDelete != null)
              IconButton(
                tooltip: 'Удалить документ',
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline),
              ),
          ],
        ),
      ),
    );
  }
}

class _VisitHistoryCard extends StatelessWidget {
  const _VisitHistoryCard({required this.visits});

  final List<OwnerPetCareVisit> visits;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('История помощи',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (visits.isEmpty)
              const Text(
                  'Здесь появятся записи, консультации и визиты питомца.')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: visits.length,
                separatorBuilder: (_, __) => const Divider(height: 18),
                itemBuilder: (context, index) =>
                    _VisitTile(visit: visits[index]),
              ),
          ],
        ),
      ),
    );
  }
}

class _TelemedHistoryCard extends StatelessWidget {
  const _TelemedHistoryCard({required this.sessions});

  final List<OwnerPetCareTelemedSession> sessions;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Онлайн-консультации',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (sessions.isEmpty)
              const Text(
                  'Здесь появятся онлайн-консультации, связанные с питомцем.')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: sessions.length,
                separatorBuilder: (_, __) => const Divider(height: 18),
                itemBuilder: (context, index) =>
                    _TelemedTile(session: sessions[index]),
              ),
          ],
        ),
      ),
    );
  }
}

class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit});

  final OwnerPetCareVisit visit;

  @override
  Widget build(BuildContext context) {
    final service = visit.serviceName ?? 'Услуга не указана';
    final price = visit.priceAmount == null
        ? null
        : '${visit.priceAmount} ${visit.currency ?? ''}'.trim();
    final clinicalSummary = visit.clinicalSummary?.trim();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(_visitIcon(visit.presentation.tone)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(visit.presentation.label,
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(_range(context, visit.startsAt, visit.endsAt)),
              const SizedBox(height: 2),
              Text(visit.clinicName),
              Text(price == null ? service : '$service · $price',
                  style: Theme.of(context).textTheme.bodySmall),
              if (clinicalSummary != null && clinicalSummary.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Заключение врача',
                    style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 2),
                Text(clinicalSummary),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _TelemedTile extends StatelessWidget {
  const _TelemedTile({required this.session});

  final OwnerPetCareTelemedSession session;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(_telemedIcon(session.state)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_telemedLabel(session.state),
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(_range(context, session.startsAt, session.endsAt)),
              const SizedBox(height: 2),
              Text(session.clinicName),
              Text(session.serviceName ?? 'Онлайн-консультация',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}

class _DiaryEntry {
  const _DiaryEntry({
    required this.at,
    required this.title,
    required this.description,
    required this.icon,
    this.clinicLine,
    this.rebookIntent,
  });

  final DateTime at;
  final String title;
  final String description;
  final IconData icon;
  final String? clinicLine;
  final OwnerPetCareRebookIntent? rebookIntent;
}

List<_DiaryEntry> _diaryEntries(OwnerPetCareSummary summary) {
  final entries = <_DiaryEntry>[
    for (final visit in summary.visits)
      _DiaryEntry(
        at: visit.startsAt,
        title: _visitDiaryTitle(visit),
        description: _visitDiaryDescription(visit),
        clinicLine: '${visit.clinicName}, ${visit.clinicAddress}',
        icon: _cupertinoVisitIcon(visit.presentation.tone),
        rebookIntent:
            _canRebook(visit) ? _rebookIntent(summary.pet, visit) : null,
      ),
    for (final session in summary.telemedSessions)
      _DiaryEntry(
        at: session.startsAt,
        title: _telemedDiaryTitle(session),
        description: _telemedDiaryDescription(session),
        clinicLine: '${session.clinicName}, ${session.clinicAddress}',
        icon: CupertinoIcons.videocam,
      ),
    for (final document in summary.documents)
      _DiaryEntry(
        at: document.createdAt ?? summary.serverNow,
        title: _documentDiaryTitle(document),
        description:
            'Документ сохранён в карте питомца. ${_documentMetadata(document)}',
        icon: _cupertinoDocumentIcon(document.type),
      ),
  ];
  entries.sort((a, b) => b.at.compareTo(a.at));
  return entries;
}

OwnerPetCareVisit? _latestVisit(List<OwnerPetCareVisit> visits) {
  if (visits.isEmpty) return null;
  final copy = [...visits]..sort((a, b) => b.startsAt.compareTo(a.startsAt));
  return copy.first;
}

bool _canRebook(OwnerPetCareVisit visit) {
  return visit.clinicName.trim().isNotEmpty &&
      visit.clinicAddress.trim().isNotEmpty &&
      visit.serviceName != null &&
      visit.serviceName!.trim().isNotEmpty;
}

OwnerPetCareRebookIntent _rebookIntent(OwnerPet pet, OwnerPetCareVisit visit) {
  return OwnerPetCareRebookIntent(
    pet: pet,
    clinicName: visit.clinicName,
    clinicAddress: visit.clinicAddress,
    serviceName: visit.serviceName!,
  );
}

String _visitDiaryTitle(OwnerPetCareVisit visit) {
  final service = visit.serviceName?.trim();
  if (service != null && service.isNotEmpty) return service;
  return visit.presentation.label;
}

String _visitDiaryDescription(OwnerPetCareVisit visit) {
  final clinicalSummary = visit.clinicalSummary?.trim();
  if (clinicalSummary != null && clinicalSummary.isNotEmpty) {
    return clinicalSummary;
  }
  return visit.presentation.description;
}

String _telemedDiaryTitle(OwnerPetCareTelemedSession session) {
  return session.serviceName?.trim().isNotEmpty == true
      ? session.serviceName!.trim()
      : 'Онлайн-консультация';
}

String _telemedDiaryDescription(OwnerPetCareTelemedSession session) {
  return switch (session.state) {
    'WAITING_FOR_DOCTOR' =>
      'Консультация ожидает подключения врача. Следите за статусом в разделе телемедицины.',
    'CONNECTED' => 'Врач подключился к онлайн-консультации.',
    'COMPLETED' => 'Онлайн-консультация завершена.',
    'DOCTOR_TIMEOUT' =>
      'Врач не подключился вовремя. Если состояние ухудшается, откройте срочные клиники.',
    'CANCELLED' || 'CANCELLED_BY_OWNER' => 'Онлайн-консультация отменена.',
    _ => 'Статус онлайн-консультации обновляется.',
  };
}

String _documentDiaryTitle(OwnerPetCareDocument document) {
  return switch (document.type) {
    'PASSPORT' => 'Документ питомца',
    'HISTORY' => document.fileName ?? 'Медицинский документ',
    _ => document.label,
  };
}

String _documentMetadata(OwnerPetCareDocument document) {
  final parts = <String>[
    if (document.mimeType != null) _friendlyMimeType(document.mimeType!),
    if (document.sizeBytes != null) ownerPetFileSizeLabel(document.sizeBytes!),
    if (document.createdAt != null) _cupertinoDate(document.createdAt!),
  ];
  if (parts.isEmpty) return 'Файл добавлен владельцем';
  return parts.join(' · ');
}

String _friendlyMimeType(String value) {
  return switch (value.toLowerCase()) {
    'image/jpeg' => 'JPEG',
    'image/png' => 'PNG',
    'image/heic' || 'image/heif' => 'HEIC',
    'image/webp' => 'WEBP',
    'application/pdf' => 'PDF',
    _ => 'Файл',
  };
}

String _documentUploadErrorText(OwnerPetCareApiException error) {
  return switch (error.code) {
    'EMPTY_PET_FILE' => 'Файл пустой. Выберите другой файл.',
    'PET_FILE_TOO_LARGE' =>
      'Файл больше ${ownerPetFileSizeLabel(ownerPetUploadMaxBytes)}. Выберите файл меньшего размера.',
    'UNSUPPORTED_PET_FILE_TYPE' =>
      'Этот тип файла не поддерживается. Можно загрузить JPEG, PNG, HEIC, WEBP или PDF.',
    'OWNER_PET_NOT_FOUND' => 'Питомец не найден. Обновите дневник.',
    'OWNER_PET_DOCUMENT_NOT_FOUND' =>
      'Документ уже недоступен. Обновите дневник.',
    'UNAUTHENTICATED' => 'Сессия истекла. Войдите снова.',
    _ => 'Не удалось обновить документы. Повторите попытку.',
  };
}

String _petSubtitle(BuildContext context, OwnerPet pet) {
  final parts = <String>[
    _species(pet.species),
    if (pet.breed != null) pet.breed!,
    if (pet.birthDate != null) _ageOrBirthDate(context, pet.birthDate!),
    if (pet.sex != null) _sex(pet.sex!),
  ];
  return parts.join(' · ');
}

String _ageOrBirthDate(BuildContext context, DateTime birthDate) {
  final date = MaterialLocalizations.of(context).formatMediumDate(birthDate);
  return 'рожд. $date';
}

String _species(String value) => switch (value.toUpperCase()) {
      'DOG' => 'Собака',
      'CAT' => 'Кошка',
      _ => 'Питомец',
    };

String _sex(String value) => switch (value.toUpperCase()) {
      'MALE' => 'самец',
      'FEMALE' => 'самка',
      _ => 'пол не указан',
    };

String _sterilized(bool? value) {
  return switch (value) {
    true => 'Да',
    false => 'Нет',
    null => 'Не указано',
  };
}

String _listOrEmpty(List<String> value) {
  return value.isEmpty ? 'Не указано' : value.join(', ');
}

IconData _documentIcon(String type) => switch (type) {
      'PASSPORT' => Icons.badge_outlined,
      'HISTORY' => Icons.description_outlined,
      _ => Icons.description_outlined,
    };

IconData _visitIcon(String tone) => switch (tone) {
      'success' => Icons.check_circle_outline,
      'warning' => Icons.schedule_outlined,
      'danger' => Icons.event_busy_outlined,
      _ => Icons.history_outlined,
    };

IconData _telemedIcon(String state) => switch (state) {
      'WAITING_FOR_DOCTOR' => Icons.schedule_outlined,
      'CONNECTED' => Icons.video_call_outlined,
      'COMPLETED' => Icons.check_circle_outline,
      'DOCTOR_TIMEOUT' => Icons.event_busy_outlined,
      _ => Icons.history_outlined,
    };

String _telemedLabel(String state) => switch (state) {
      'WAITING_FOR_DOCTOR' => 'Ожидание врача',
      'CONNECTED' => 'Врач подключился',
      'COMPLETED' => 'Консультация завершена',
      'DOCTOR_TIMEOUT' => 'Врач не подключился',
      'CANCELLED' => 'Консультация отменена',
      _ => 'Онлайн-консультация',
    };

String _range(BuildContext context, DateTime from, DateTime to) {
  final date = MaterialLocalizations.of(context).formatMediumDate(from);
  final start = TimeOfDay.fromDateTime(from).format(context);
  final end = TimeOfDay.fromDateTime(to).format(context);
  return '$date, $start-$end';
}

String _cupertinoDate(DateTime value) {
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
}

String _cupertinoDateTime(DateTime value) {
  final hh = value.hour.toString().padLeft(2, '0');
  final mm = value.minute.toString().padLeft(2, '0');
  return '${_cupertinoDate(value)}, $hh:$mm';
}

IconData _cupertinoFactIcon(IconData materialIcon) {
  if (materialIcon == Icons.warning_amber_outlined) {
    return CupertinoIcons.exclamationmark_triangle;
  }
  if (materialIcon == Icons.vaccines_outlined) {
    return CupertinoIcons.check_mark_circled;
  }
  if (materialIcon == Icons.monitor_heart_outlined) {
    return CupertinoIcons.heart;
  }
  if (materialIcon == Icons.scale_outlined) {
    return CupertinoIcons.gauge;
  }
  return CupertinoIcons.doc_text;
}

IconData _cupertinoDocumentIcon(String type) => switch (type) {
      'PASSPORT' => CupertinoIcons.person_crop_square,
      'HISTORY' => CupertinoIcons.doc_text,
      _ => CupertinoIcons.doc,
    };

IconData _cupertinoVisitIcon(String tone) => switch (tone) {
      'success' => CupertinoIcons.check_mark_circled,
      'warning' => CupertinoIcons.clock,
      'danger' => CupertinoIcons.exclamationmark_triangle,
      _ => CupertinoIcons.heart,
    };

String _dateTime(BuildContext context, DateTime value) {
  final date = MaterialLocalizations.of(context).formatMediumDate(value);
  final time = TimeOfDay.fromDateTime(value).format(context);
  return '$date, $time';
}

Future<void> _openOrCopy(BuildContext context, String value) async {
  final uri = Uri.tryParse(value);
  if (uri != null && uri.hasScheme) {
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (opened) return;
    } catch (_) {
      // Fallback below keeps the document reference accessible.
    }
  }
  await Clipboard.setData(ClipboardData(text: value));
  if (context.mounted) {
    showOwnerMessage(context, 'Ссылка на документ скопирована.');
  }
}
