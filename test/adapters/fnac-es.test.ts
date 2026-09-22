import { describe, expect, it } from 'vitest';
import { FnacEsAdapter } from '../../src/adapters/fnac-es';
import { RetailerConfig } from '../../src/domain/retailer';
import { loadProductIdentity } from '../../src/config/product';
import { loadFixture } from '../helpers/fixtures';

const config: RetailerConfig = {
  id: 'fnac-es',
  name: 'Fnac ES',
  productUrl: 'https://www.fnac.es/example/a13481099',
  enabled: true,
};

const product = loadProductIdentity();

describe('FnacEsAdapter', () => {
  const adapter = new FnacEsAdapter(config, product);

  it('reports PREORDER for the verified product via JSON-LD', () => {
    const result = adapter.parse(loadFixture('fnac/preorder-jsonld.html'), 200);
    expect(result.status).toBe('PREORDER');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(579.99);
  });

  it('falls back to microdata and reports AVAILABLE when JSON-LD is absent', () => {
    const result = adapter.parse(loadFixture('fnac/available-microdata.html'), 200);
    expect(result.status).toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(579.99);
    expect(result.evidence.some((e) => e.source.startsWith('microdata'))).toBe(true);
  });

  it('returns UNKNOWN for a different Switch 2 listing missing the Zelda keyword', () => {
    const result = adapter.parse(loadFixture('fnac/wrong-product.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(false);
  });

  it('returns UNKNOWN for malformed structured data instead of guessing', () => {
    const result = adapter.parse(loadFixture('fnac/malformed.html'), 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('maps HTTP 200 challenge pages to BLOCKED', () => {
    const result = adapter.parse(loadFixture('fnac/challenge.html'), 200);
    expect(result.status).toBe('BLOCKED');
    expect(result.productVerified).toBe(false);
  });

  it('maps HTTP 403 to BLOCKED', () => {
    expect(adapter.parse('', 403).status).toBe('BLOCKED');
  });

  it('maps HTTP 429 to ERROR and preserves retryAfterSeconds', () => {
    const result = adapter.parse('', 429, undefined, 45);
    expect(result.status).toBe('ERROR');
    expect(result.retryAfterSeconds).toBe(45);
  });
});
