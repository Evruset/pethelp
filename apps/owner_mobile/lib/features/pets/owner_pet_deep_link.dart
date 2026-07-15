import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../care/owner_pet_care_repository.dart';
import '../care/owner_pet_diary_v50_page.dart';
import 'owner_pet.dart';
import 'owner_pet_profile_v50_page.dart';
import 'owner_pet_repository.dart';
import 'owner_v50_pet_visuals.dart';

enum OwnerPetDeepLinkKind { profile, diary, document }

class OwnerPetDeepLink {
  const OwnerPetDeepLink({
    required this.kind,
    required this.petId,
    this.documentId,
  });

  final OwnerPetDeepLinkKind kind;
  final String petId;
  final String? documentId;

  static OwnerPetDeepLink? tryParse(String location) {
    final uri = Uri.tryParse(location);
    if (uri == null) return null;
    final segments = uri.pathSegments;
    final petsIndex = segments.indexOf('pets');
    if (petsIndex < 0 || petsIndex + 1 >= segments.length) return null;
    final petId = segments[petsIndex + 1].trim();
    if (petId.isEmpty) return null;
    final tail = segments.skip(petsIndex + 2).toList(growable: false);
    if (tail.isEmpty) {
      return OwnerPetDeepLink(
        kind: OwnerPetDeepLinkKind.profile,
        petId: petId,
      );
    }
    if (tail.length == 1 && tail.single == 'diary') {
      return OwnerPetDeepLink(
        kind: OwnerPetDeepLinkKind.diary,
        petId: petId,
      );
    }
    if (tail.length == 2 && tail.first == 'documents' && tail.last.isNotEmpty) {
      return OwnerPetDeepLink(
        kind: OwnerPetDeepLinkKind.document,
        petId: petId,
        documentId: tail.last,
      );
    }
    return null;
  }
}

enum OwnerPetDeepLinkStatus {
  resolved,
  notFound,
  sessionExpired,
  offlineStale,
}

class OwnerPetDeepLinkResolution {
  const OwnerPetDeepLinkResolution({
    required this.status,
    required this.link,
    this.pet,
    this.documentEvent,
    this.document,
  });

  final OwnerPetDeepLinkStatus status;
  final OwnerPetDeepLink link;
  final OwnerPet? pet;
  final OwnerPetDiaryEvent? documentEvent;
  final OwnerPetDocumentDetail? document;

  bool get exposesResource =>
      status == OwnerPetDeepLinkStatus.resolved ||
      status == OwnerPetDeepLinkStatus.offlineStale;
}

class OwnerPetDeepLinkResolver {
  const OwnerPetDeepLinkResolver({
    required this.pets,
    required this.diary,
  });

  final OwnerPetRepository pets;
  final OwnerPetDiaryRepository diary;

  Future<OwnerPetDeepLinkResolution> resolve(
    OwnerPetDeepLink link, {
    OwnerPet? safeSnapshot,
  }) async {
    OwnerPet pet;
    try {
      // Every route parameter is authorized by the owner-scoped repository.
      pet = await pets.read(link.petId);
    } on OwnerPetApiException catch (error) {
      if (error.statusCode == 401) {
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.sessionExpired,
          link: link,
        );
      }
      if (error.statusCode == 404) {
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.notFound,
          link: link,
        );
      }
      if (safeSnapshot?.id == link.petId) {
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.offlineStale,
          link: link,
          pet: safeSnapshot,
        );
      }
      return OwnerPetDeepLinkResolution(
        status: OwnerPetDeepLinkStatus.notFound,
        link: link,
      );
    } on Object {
      if (safeSnapshot?.id == link.petId) {
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.offlineStale,
          link: link,
          pet: safeSnapshot,
        );
      }
      return OwnerPetDeepLinkResolution(
        status: OwnerPetDeepLinkStatus.notFound,
        link: link,
      );
    }

    if (link.kind != OwnerPetDeepLinkKind.document) {
      return OwnerPetDeepLinkResolution(
        status: OwnerPetDeepLinkStatus.resolved,
        link: link,
        pet: pet,
      );
    }

    OwnerPetDiaryEvent? event;
    try {
      final page = await diary.readDiary(pet.id);
      event = page.events.cast<OwnerPetDiaryEvent?>().firstWhere(
            (candidate) =>
                candidate?.type == 'DOCUMENT' &&
                candidate?.sourceId == link.documentId,
            orElse: () => null,
          );
      if (event == null) {
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.notFound,
          link: link,
        );
      }
      final document = await diary.readDocument(pet.id, link.documentId!);
      return OwnerPetDeepLinkResolution(
        status: OwnerPetDeepLinkStatus.resolved,
        link: link,
        pet: pet,
        documentEvent: event,
        document: document,
      );
    } on OwnerPetCareApiException catch (error) {
      if (error.statusCode == 401) {
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.sessionExpired,
          link: link,
        );
      }
      if (error.statusCode == 404) {
        // Foreign and unknown documents are intentionally indistinguishable.
        return OwnerPetDeepLinkResolution(
          status: OwnerPetDeepLinkStatus.notFound,
          link: link,
        );
      }
      return OwnerPetDeepLinkResolution(
        status: OwnerPetDeepLinkStatus.offlineStale,
        link: link,
        pet: pet,
        documentEvent: event,
      );
    } on Object {
      return OwnerPetDeepLinkResolution(
        status: OwnerPetDeepLinkStatus.offlineStale,
        link: link,
        pet: pet,
        documentEvent: event,
      );
    }
  }
}

class OwnerPetDeepLinkDestination extends StatefulWidget {
  const OwnerPetDeepLinkDestination({
    super.key,
    required this.link,
    required this.resolver,
    required this.sessionGeneration,
    required this.petRepository,
    required this.diaryRepository,
    required this.onPetChanged,
    required this.onArchiveResolved,
    this.safeSnapshot,
  });

  final OwnerPetDeepLink link;
  final OwnerPetDeepLinkResolver resolver;
  final int sessionGeneration;
  final OwnerPetRepository petRepository;
  final OwnerPetDiaryRepository diaryRepository;
  final ValueChanged<OwnerPet> onPetChanged;
  final ValueChanged<OwnerPet> onArchiveResolved;
  final OwnerPet? safeSnapshot;

  @override
  State<OwnerPetDeepLinkDestination> createState() =>
      _OwnerPetDeepLinkDestinationState();
}

class _OwnerPetDeepLinkDestinationState
    extends State<OwnerPetDeepLinkDestination> {
  late Future<OwnerPetDeepLinkResolution> _request = _resolve();

  Future<OwnerPetDeepLinkResolution> _resolve() => widget.resolver.resolve(
        widget.link,
        safeSnapshot: widget.safeSnapshot,
      );

  @override
  void didUpdateWidget(covariant OwnerPetDeepLinkDestination oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sessionGeneration != widget.sessionGeneration ||
        oldWidget.link.petId != widget.link.petId ||
        oldWidget.link.documentId != widget.link.documentId) {
      // Never retain a previous owner's resolved content across a session fence.
      final request = _resolve();
      setState(() {
        _request = request;
      });
    }
  }

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<OwnerPetDeepLinkResolution>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Material(
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final resolution = snapshot.data;
          if (resolution == null ||
              resolution.status == OwnerPetDeepLinkStatus.notFound) {
            return const _SafeDeepLinkState(
              key: ValueKey('owner-pet-deep-link-not-found'),
              icon: Icons.search_off_outlined,
              title: 'Питомец или документ не найден',
              message:
                  'Проверьте ссылку или вернитесь к списку питомцев. Данные ресурса не раскрываются.',
            );
          }
          if (resolution.status == OwnerPetDeepLinkStatus.sessionExpired) {
            return const _SafeDeepLinkState(
              key: ValueKey('owner-pet-deep-link-session-expired'),
              icon: Icons.lock_clock_outlined,
              title: 'Сессия завершена',
              message: 'Войдите снова, чтобы безопасно продолжить.',
            );
          }
          final pet = resolution.pet;
          if (pet == null) {
            return const _SafeDeepLinkState(
              icon: Icons.cloud_off_outlined,
              title: 'Данные временно недоступны',
              message: 'Проверьте подключение и повторите попытку.',
            );
          }
          return switch (resolution.link.kind) {
            OwnerPetDeepLinkKind.profile => OwnerPetProfileV50Page(
                pet: pet,
                repository: widget.petRepository,
                onPetChanged: widget.onPetChanged,
                onOpenDiary: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => OwnerPetDiaryV50Page(
                      pet: pet,
                      repository: widget.diaryRepository,
                    ),
                  ),
                ),
                onArchiveResolved: widget.onArchiveResolved,
                readOnly:
                    resolution.status == OwnerPetDeepLinkStatus.offlineStale,
                initialStatusMessage:
                    resolution.status == OwnerPetDeepLinkStatus.offlineStale
                        ? 'Нет соединения. Показан последний безопасный снимок.'
                        : null,
              ),
            OwnerPetDeepLinkKind.diary => OwnerPetDiaryV50Page(
                pet: pet,
                repository: widget.diaryRepository,
              ),
            OwnerPetDeepLinkKind.document => _OwnerDocumentDeepLinkView(
                resolution: resolution,
                onRetry: () {
                  final request = _resolve();
                  setState(() {
                    _request = request;
                  });
                },
              ),
          };
        },
      );
}

class _SafeDeepLinkState extends StatelessWidget {
  const _SafeDeepLinkState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Material(
        child: OwnerV50PetPageFrame(
          title: title,
          supportingText: message,
          child: OwnerV50InsetSection(
            child: Center(child: Icon(icon, size: 56)),
          ),
        ),
      );
}

class _OwnerDocumentDeepLinkView extends StatelessWidget {
  const _OwnerDocumentDeepLinkView({
    required this.resolution,
    required this.onRetry,
  });

  final OwnerPetDeepLinkResolution resolution;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final event = resolution.documentEvent;
    final document = resolution.document;
    final archived =
        event?.status == 'ARCHIVED' || document?.status == 'ARCHIVED';
    return Material(
      child: OwnerV50PetPageFrame(
        title: 'Документ питомца',
        supportingText: 'Безопасный просмотр документа владельца.',
        status: resolution.status == OwnerPetDeepLinkStatus.offlineStale
            ? OwnerV50StatusBanner(
                icon: Icons.cloud_off_outlined,
                title: 'Документ временно недоступен',
                message:
                    'Метаданные сохранены. Повторная попытка выполнит новую проверку доступа.',
                action: TextButton(
                  onPressed: onRetry,
                  child: const Text('Повторить'),
                ),
              )
            : archived
                ? const OwnerV50StatusBanner(
                    icon: Icons.archive_outlined,
                    title: 'Документ в архиве',
                    message:
                        'Метаданные доступны владельцу, бинарное действие отключено.',
                  )
                : null,
        child: OwnerV50InsetSection(
          title: event?.title ?? document?.fileName ?? 'Документ',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (event?.summary.isNotEmpty ?? false) Text(event!.summary),
              if (document != null) ...[
                const SizedBox(height: 8),
                Text('Тип: ${document.mimeType}'),
                Text('Размер: ${document.sizeBytes} байт'),
              ],
              const SizedBox(height: 16),
              FilledButton.icon(
                key: const ValueKey('owner-document-open-action'),
                onPressed: archived || document?.contentBytes == null
                    ? null
                    : () => _openSafeDocument(document!),
                icon: const Icon(Icons.open_in_new),
                label: const Text('Открыть документ'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _openSafeDocument(OwnerPetDocumentDetail document) async {
  final Uint8List? bytes = document.contentBytes;
  if (bytes == null || document.mimeType != 'application/pdf') return;
  await launchUrl(
    Uri.dataFromBytes(bytes, mimeType: 'application/pdf'),
    mode: LaunchMode.externalApplication,
  );
}
