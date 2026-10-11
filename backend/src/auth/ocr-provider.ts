import { Injectable } from '@nestjs/common';

export interface OcrSource {
  documentId: string;
  documentType: 'PASSPORT' | 'HISTORY';
}
export interface OcrExtraction {
  text: string;
  provider?: string;
  providerVersion?: string;
}
/** Existing simulated text abstraction. No network integration or clinical inference. */
@Injectable()
export class OcrProvider {
  async extract(source: OcrSource, _signal: AbortSignal): Promise<OcrExtraction> {
    return {
      text: source.documentType === 'PASSPORT'
        ? 'OCR simulated: veterinary passport fields detected.'
        : 'OCR simulated: medical history notes detected.',
      provider: 'SIMULATED_OCR',
    };
  }
}
