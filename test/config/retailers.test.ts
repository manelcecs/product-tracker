import { afterEach, describe, expect, it } from 'vitest';
import { loadRetailerConfigs } from '../../src/config/retailers';

describe('loadRetailerConfigs', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads per-retailer interval overrides from environment variables', () => {
    process.env.MEDIAMARKT_ES_CHECK_INTERVAL_MIN_SECONDS = '90';
    process.env.MEDIAMARKT_ES_CHECK_INTERVAL_MAX_SECONDS = '120';

    const mediamarkt = loadRetailerConfigs().find((retailer) => retailer.id === 'mediamarkt-es');

    expect(mediamarkt?.checkIntervalMsOverride).toEqual({ min: 90_000, max: 120_000 });
  });

  it('rejects invalid per-retailer interval overrides', () => {
    process.env.AMAZON_ES_CHECK_INTERVAL_MIN_SECONDS = '120';
    process.env.AMAZON_ES_CHECK_INTERVAL_MAX_SECONDS = '60';

    expect(() => loadRetailerConfigs()).toThrow(/AMAZON_ES_CHECK_INTERVAL/);
  });

  it('only configures the supported retailers', () => {
    expect(loadRetailerConfigs().map((retailer) => retailer.id)).toEqual(['mediamarkt-es', 'amazon-es', 'game-es']);
  });

  it('enables Amazon ES only when both an ASIN and the enabled flag are provided', () => {
    delete process.env.AMAZON_ES_ASIN;
    delete process.env.AMAZON_ES_ENABLED;
    expect(loadRetailerConfigs().find((r) => r.id === 'amazon-es')?.enabled).toBe(false);

    process.env.AMAZON_ES_ASIN = 'B0F2TN43GH';
    process.env.AMAZON_ES_ENABLED = 'true';
    const amazon = loadRetailerConfigs().find((retailer) => retailer.id === 'amazon-es');
    expect(amazon?.enabled).toBe(true);
    expect(amazon?.productUrl).toBe('https://www.amazon.es/dp/B0F2TN43GH');
  });

  it('defaults GAME ES to enabled with a default product URL', () => {
    delete process.env.GAME_ES_ENABLED;
    delete process.env.GAME_ES_URL;

    const game = loadRetailerConfigs().find((retailer) => retailer.id === 'game-es');

    expect(game?.enabled).toBe(true);
    expect(game?.productUrl).toContain('game.es');
  });

  it('disables GAME ES when GAME_ES_ENABLED is explicitly "false"', () => {
    process.env.GAME_ES_ENABLED = 'false';
    expect(loadRetailerConfigs().find((r) => r.id === 'game-es')?.enabled).toBe(false);
  });
});
