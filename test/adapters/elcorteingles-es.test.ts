import { describe, expect, it } from 'vitest';
import { ElCorteInglesEsAdapter } from '../../src/adapters/elcorteingles-es';
import { RetailerConfig } from '../../src/domain/retailer';
import { loadProductIdentity } from '../../src/config/product';
import { loadFixture } from '../helpers/fixtures';

const config: RetailerConfig = {
  id: 'elcorteingles-es',
  name: 'El Corte Inglés ES',
  productUrl: 'https://www.elcorteingles.es/example/a40123456',
  enabled: false,
};

const product = loadProductIdentity();

describe('ElCorteInglesEsAdapter (disabled by default, no verified product URL)', () => {
  const adapter = new ElCorteInglesEsAdapter(config, product);

  it('reports AVAILABLE for the verified product via JSON-LD', () => {
    const result = adapter.parse(loadFixture('elcorteingles/available.html'), 200);
    expect(result.status).toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(579.99);
    expect(result.currency).toBe('EUR');
  });

  it('reports OUT_OF_STOCK for the verified product when sold out', () => {
    const result = adapter.parse(loadFixture('elcorteingles/out-of-stock.html'), 200);
    expect(result.status).toBe('OUT_OF_STOCK');
    expect(result.productVerified).toBe(true);
  });

  it('returns UNKNOWN (never a false AVAILABLE) for the 40th Anniversary case/accessory listing', () => {
    const result = adapter.parse(loadFixture('elcorteingles/wrong-product.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(false);
  });

  it('returns UNKNOWN for malformed structured data instead of guessing', () => {
    const result = adapter.parse(loadFixture('elcorteingles/malformed.html'), 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('maps HTTP 200 challenge pages to BLOCKED', () => {
    const result = adapter.parse(loadFixture('elcorteingles/challenge.html'), 200);
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
