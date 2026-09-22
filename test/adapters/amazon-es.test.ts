import { describe, expect, it } from 'vitest';
import { AmazonEsAdapter } from '../../src/adapters/amazon-es';
import { RetailerConfig } from '../../src/domain/retailer';
import { loadProductIdentity } from '../../src/config/product';
import { loadFixture } from '../helpers/fixtures';

const config: RetailerConfig = {
  id: 'amazon-es',
  name: 'Amazon ES',
  productUrl: 'https://www.amazon.es/dp/EXAMPLEASIN',
  enabled: false,
};

const product = loadProductIdentity();

describe('AmazonEsAdapter (template, disabled by default)', () => {
  const adapter = new AmazonEsAdapter(config, product);

  it('reports AVAILABLE for a verified product with "En stock" text', () => {
    const result = adapter.parse(loadFixture('amazon/available.html'), 200);
    expect(result.status).toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(579.99);
    expect(result.seller).toContain('Amazon');
  });

  it('reports PREORDER for "Disponible el <date>" text', () => {
    const result = adapter.parse(loadFixture('amazon/preorder.html'), 200);
    expect(result.status).toBe('PREORDER');
    expect(result.productVerified).toBe(true);
  });

  it('returns UNKNOWN for a mismatched accessory title', () => {
    const result = adapter.parse(loadFixture('amazon/wrong-product.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(false);
  });

  it('returns BLOCKED when a CAPTCHA challenge page is detected', () => {
    const result = adapter.parse(loadFixture('amazon/captcha.html'), 200);
    expect(result.status).toBe('BLOCKED');
  });

  it('returns UNKNOWN when the layout has no recognizable product title', () => {
    const result = adapter.parse(loadFixture('amazon/malformed.html'), 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('maps HTTP 403 to BLOCKED', () => {
    expect(adapter.parse('', 403).status).toBe('BLOCKED');
  });

  it('maps HTTP 429 to ERROR and preserves retryAfterSeconds', () => {
    const result = adapter.parse('', 429, undefined, 60);
    expect(result.status).toBe('ERROR');
    expect(result.retryAfterSeconds).toBe(60);
  });
});
