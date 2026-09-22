import { describe, expect, it } from 'vitest';
import { MediaMarktEsAdapter } from '../../src/adapters/mediamarkt-es';
import { RetailerConfig } from '../../src/domain/retailer';
import { loadProductIdentity } from '../../src/config/product';
import { loadFixture } from '../helpers/fixtures';

const config: RetailerConfig = {
  id: 'mediamarkt-es',
  name: 'MediaMarkt ES',
  productUrl: 'https://www.mediamarkt.es/es/product/example-1674231.html',
  enabled: true,
};

const product = loadProductIdentity();

describe('MediaMarktEsAdapter', () => {
  const adapter = new MediaMarktEsAdapter(config, product);

  it('reports AVAILABLE for the verified product in stock', () => {
    const result = adapter.parse(loadFixture('mediamarkt/available.html'), 200);
    expect(result.status).toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(579.99);
    expect(result.currency).toBe('EUR');
  });

  it('reports PREORDER for the verified product pending release', () => {
    const result = adapter.parse(loadFixture('mediamarkt/preorder.html'), 200);
    expect(result.status).toBe('PREORDER');
    expect(result.productVerified).toBe(true);
  });

  it('returns UNKNOWN (never a false AVAILABLE) for a mismatched accessory listing', () => {
    const result = adapter.parse(loadFixture('mediamarkt/wrong-product.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(false);
  });

  it('returns UNKNOWN for malformed/missing structured data instead of guessing', () => {
    const result = adapter.parse(loadFixture('mediamarkt/malformed.html'), 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('maps HTTP 200 challenge pages to BLOCKED', () => {
    const result = adapter.parse(loadFixture('mediamarkt/challenge.html'), 200);
    expect(result.status).toBe('BLOCKED');
    expect(result.productVerified).toBe(false);
  });

  it('maps HTTP 403 to BLOCKED', () => {
    expect(adapter.parse('', 403).status).toBe('BLOCKED');
  });

  it('maps HTTP 429 to ERROR and preserves retryAfterSeconds', () => {
    const result = adapter.parse('', 429, undefined, 30);
    expect(result.status).toBe('ERROR');
    expect(result.retryAfterSeconds).toBe(30);
  });

  it('maps HTTP 404 to PRODUCT_REMOVED', () => {
    expect(adapter.parse('', 404).status).toBe('PRODUCT_REMOVED');
  });
});
