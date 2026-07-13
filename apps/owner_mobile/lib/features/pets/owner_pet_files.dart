import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:image_picker/image_picker.dart';

// Keep in sync with backend PET_DOCUMENT_MAX_BYTES.
const int ownerPetUploadMaxBytes = 10 * 1024 * 1024;

const Set<String> ownerPetAllowedDocumentMimeTypes = {
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
};

const Set<String> ownerPetAllowedPhotoMimeTypes = {
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
};

const _petDocumentTypeGroup = XTypeGroup(
  label: 'VetHelp pet documents',
  extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf'],
  mimeTypes: [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/pdf',
  ],
);

const _petPhotoTypeGroup = XTypeGroup(
  label: 'VetHelp pet photos',
  extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'],
  mimeTypes: [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
  ],
);

class OwnerPickedPetFile {
  const OwnerPickedPetFile({
    required this.name,
    required this.mimeType,
    required this.bytes,
  });

  final String name;
  final String mimeType;
  final Uint8List bytes;

  int get sizeBytes => bytes.lengthInBytes;
  bool get isImage => mimeType.startsWith('image/');
}

Future<OwnerPickedPetFile?> pickOwnerPetPhotoFromCamera() async {
  final file = await ImagePicker().pickImage(
    source: ImageSource.camera,
    imageQuality: 88,
    maxWidth: 2400,
  );
  return _fromXFile(file);
}

Future<OwnerPickedPetFile?> pickOwnerPetPhotoFromGallery() async {
  final file = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    imageQuality: 88,
    maxWidth: 2400,
  );
  return _fromXFile(file);
}

Future<OwnerPickedPetFile?> pickOwnerPetPhotoFromFiles() async {
  final file = await openFile(acceptedTypeGroups: [_petPhotoTypeGroup]);
  return _fromXFile(file);
}

Future<List<OwnerPickedPetFile>> pickOwnerPetDocumentFiles() async {
  final files = await openFiles(acceptedTypeGroups: [_petDocumentTypeGroup]);
  final result = <OwnerPickedPetFile>[];
  for (final file in files) {
    final picked = await _fromXFile(file);
    if (picked != null) {
      result.add(picked);
    }
  }
  return result;
}

String? ownerPetUploadValidationError(
  OwnerPickedPetFile file, {
  required bool allowPdf,
}) {
  if (file.sizeBytes <= 0) {
    return 'Файл пустой. Выберите другой файл.';
  }
  if (file.sizeBytes > ownerPetUploadMaxBytes) {
    return 'Файл больше ${ownerPetFileSizeLabel(ownerPetUploadMaxBytes)}. Выберите файл меньшего размера.';
  }
  if (!ownerPetAllowedDocumentMimeTypes.contains(file.mimeType)) {
    return 'Этот тип файла не поддерживается. Можно загрузить JPEG, PNG, HEIC, WEBP или PDF.';
  }
  if (!allowPdf && !ownerPetAllowedPhotoMimeTypes.contains(file.mimeType)) {
    return 'Для фото питомца выберите изображение JPEG, PNG, HEIC или WEBP.';
  }
  return null;
}

String ownerPetFileSizeLabel(int bytes) {
  if (bytes >= 1024 * 1024) {
    final mb = bytes / (1024 * 1024);
    return '${mb.toStringAsFixed(mb >= 10 ? 0 : 1)} МБ';
  }
  if (bytes >= 1024) {
    final kb = bytes / 1024;
    return '${kb.toStringAsFixed(kb >= 10 ? 0 : 1)} КБ';
  }
  return '$bytes байт';
}

Future<OwnerPickedPetFile?> _fromXFile(XFile? file) async {
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  return OwnerPickedPetFile(
    name: _safeFileName(file.name),
    mimeType: _mimeType(file.mimeType, file.name),
    bytes: bytes,
  );
}

String _mimeType(String? provided, String fileName) {
  final normalized = provided?.trim().toLowerCase();
  if (normalized == 'image/jpg') return 'image/jpeg';
  if (normalized != null &&
      ownerPetAllowedDocumentMimeTypes.contains(normalized)) {
    return normalized;
  }
  final lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.heif')) return 'image/heif';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  return normalized?.isNotEmpty == true
      ? normalized!
      : 'application/octet-stream';
}

String _safeFileName(String value) {
  final normalized = value.replaceAll(RegExp(r'[\r\n"/\\]'), '').trim();
  return normalized.isEmpty ? 'pet-file' : normalized;
}
