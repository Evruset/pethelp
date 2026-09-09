import { CANONICAL_LOCAL_OWNER_ORIGIN, CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT, canonicalLocalOwnerUrl } from './canonical-local-owner-origin';

describe('canonical local Owner Web origin', () => {
  it('normalizes only the exact alternate local loopback alias', () => {
    expect(canonicalLocalOwnerUrl('http://localhost:8081/pets?next=diary#result')).toBe(`${CANONICAL_LOCAL_OWNER_ORIGIN}/pets?next=diary#result`);
    expect(canonicalLocalOwnerUrl('http://127.0.0.1:8081/pets')).toBeNull();
    expect(canonicalLocalOwnerUrl('http://localhost:8082/pets')).toBeNull();
    expect(canonicalLocalOwnerUrl('https://localhost:8081/pets')).toBeNull();
    expect(canonicalLocalOwnerUrl('https://owner.vethelp.test/pets')).toBeNull();
  });

  it('ships the same exact fail-closed normalization before app bootstrap', () => {
    expect(CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT).toContain("location.hostname === 'localhost'");
    expect(CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT).toContain("location.port === '8081'");
    expect(CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT).toContain(`location.replace('${CANONICAL_LOCAL_OWNER_ORIGIN}'`);
  });
});
