import { describe, expect, it } from 'vitest';
import { GameEsAdapter } from '../../src/adapters/game-es';
import { RetailerConfig } from '../../src/domain/retailer';
import { loadProductIdentity } from '../../src/config/product';
import { loadFixture } from '../helpers/fixtures';

const config: RetailerConfig = {
  id: 'game-es',
  name: 'GAME ES',
  productUrl: 'https://www.game.es/nintendo-switch-2-edicion-zelda-40th-nintendo-switch-2-267689',
  enabled: true,
};

const product = loadProductIdentity();

describe('GameEsAdapter', () => {
  const adapter = new GameEsAdapter(config, product);

  it('reports AVAILABLE for the verified product in stock', () => {
    const result = adapter.parse(loadFixture('game/available.html'), 200);
    expect(result.status).toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(519.99);
    expect(result.currency).toBe('EUR');
  });

  it('reports OUT_OF_STOCK for the live JSON-LD AggregateOffer shape, decoding HTML entities in the name before matching', () => {
    const result = adapter.parse(loadFixture('game/unavailable-live.html'), 200);
    expect(result.status).toBe('OUT_OF_STOCK');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(519.99);
    expect(result.currency).toBe('EUR');
    expect(result.evidence.some((e) => e.source === 'json-ld:name' && e.value.includes('Edición'))).toBe(true);
  });

  it('returns UNKNOWN (never a false AVAILABLE) for a mismatched accessory listing', () => {
    const result = adapter.parse(loadFixture('game/wrong-product.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(false);
  });

  it('returns UNKNOWN for malformed/missing structured data instead of guessing', () => {
    const result = adapter.parse(loadFixture('game/malformed.html'), 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('reports OUT_OF_STOCK (never AVAILABLE) when the new offer is out of stock and only a used "segunda mano" offer is in stock', () => {
    const result = adapter.parse(loadFixture('game/multi-offer-used-in-stock.html'), 200);
    expect(result.status).toBe('OUT_OF_STOCK');
    expect(result.status).not.toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
  });

  it('returns UNKNOWN (never AVAILABLE) when the only offer is a used in-stock offer', () => {
    const html = loadFixture('game/available.html').replace(/"NewCondition"/g, '"UsedCondition"');
    expect(html).toContain('UsedCondition');
    const result = adapter.parse(html, 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when multiple new offers report conflicting availability', () => {
    const result = adapter.parse(loadFixture('game/multi-offer-ambiguous.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(true);
    expect(result.errorMessage).toContain('ambiguous offers');
  });

  it('maps HTTP 200 challenge pages to BLOCKED', () => {
    const result = adapter.parse(loadFixture('mediamarkt/challenge.html'), 200);
    expect(result.status).toBe('BLOCKED');
    expect(result.productVerified).toBe(false);
  });

  it('maps HTTP 403 to BLOCKED', () => {
    expect(adapter.parse(loadFixture('game/http-403.html'), 403).status).toBe('BLOCKED');
  });

  it('maps HTTP 429 to ERROR and preserves retryAfterSeconds', () => {
    const result = adapter.parse(loadFixture('game/http-429.html'), 429, undefined, 30);
    expect(result.status).toBe('ERROR');
    expect(result.retryAfterSeconds).toBe(30);
  });

  it('maps HTTP 404 to PRODUCT_REMOVED', () => {
    expect(adapter.parse('', 404).status).toBe('PRODUCT_REMOVED');
  });
});
