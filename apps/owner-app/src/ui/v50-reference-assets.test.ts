import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('bundled V50 reference assets', () => {
  const names = ['banner-owner-clinic.webp','banner-vet-exam.webp','clinic-diagnostic.png','clinic-exam.webp','clinic-facade-premium.png','clinic-reception-premium.png'];
  it('contains no runtime HTTP or GitHub dependency', () => {
    const source = readFileSync(resolve(__dirname, 'v50-reference-assets.ts'), 'utf8');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toContain('raw.githubusercontent.com');
  });
  it.each(names)('%s is byte-identical to the canonical reference', (name) => {
    const local = readFileSync(resolve(__dirname, `../../assets/v50-reference/${name}`));
    const canonical = readFileSync(resolve(__dirname, `../../../../docs/ux/v50-reference/owner/assets/images/${name}`));
    expect(local.equals(canonical)).toBe(true);
  });
});
