import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { v50ReferenceAssetSemantics } from './v50-reference-assets';

const expected = {
  'banner-owner-clinic.webp': '161b654e22db04445187d4d10259ea294f0d5e53ec35aecb4b777e74ee0fbabd',
  'banner-vet-exam.webp': '6e0adee648b2c5fb176d6874c24ff4f1282ac5ff667f7c85d1d361ab02f43716',
  'clinic-exam.webp': '7fed5bad379dde6ca17c7e91eef60f9e1bf8b53cd70dd4a304db75393b6feab4',
  'clinic-reception-premium.png': '766e78933d5d28b3af4b139cbc02736ca008d89cbdae58bc1c924e4ee5d0a7cc',
} as const;

it('resolves every production V50 image locally and pins it to the canonical reference bytes', () => {
  const source = readFileSync(resolve(__dirname, 'v50-reference-assets.ts'), 'utf8');
  expect(source).not.toMatch(/https?:\/\//);
  for (const [file, sha256] of Object.entries(expected)) {
    expect(source).toContain(`../../assets/v50/owner/${file}`);
    const bytes = readFileSync(resolve(__dirname, `../../assets/v50/owner/${file}`));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
  }
});

it('documents decorative semantics and a production fallback for every bundled asset', () => {
  expect(Object.keys(v50ReferenceAssetSemantics).sort()).toEqual(['clinicExam', 'clinicReception', 'ownerClinic', 'vetExam']);
  for (const value of Object.values(v50ReferenceAssetSemantics)) {
    expect(value.factual).toBe(false);
    expect(value.fallback).not.toBe('');
  }
});
