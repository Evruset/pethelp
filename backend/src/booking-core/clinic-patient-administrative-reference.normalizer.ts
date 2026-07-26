import { UNICODE_CASE_FOLDING, UNICODE_CASE_FOLDING_VERSION } from './unicode-case-folding-17.generated';

export { UNICODE_CASE_FOLDING_VERSION };
export type AdministrativeReference = { display: string; comparisonKey: string };

const ALLOWED = /^[\p{L}\p{Nd}._/ -]+$/u;
const PHONE_LIKE = /^[\p{Nd}\s./-]{7,}$/u;

export function normalizeAdministrativeReference(input: string): AdministrativeReference | null {
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\r\n\t]/u.test(input)) return null;
  const display = input.normalize('NFC').replace(/\p{White_Space}+/gu, ' ').trim();
  const length = Array.from(display).length;
  if (length < 1 || length > 40 || !ALLOWED.test(display)
    || display.includes('  ') || /^www\./iu.test(display) || PHONE_LIKE.test(display)) return null;
  const folded: number[] = [];
  for (const character of display) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return null;
    folded.push(...(UNICODE_CASE_FOLDING.get(codePoint) ?? [codePoint]));
  }
  return { display, comparisonKey: String.fromCodePoint(...folded).normalize('NFC') };
}
