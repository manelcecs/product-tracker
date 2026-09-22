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
    process.env.FNAC_ES_CHECK_INTERVAL_MIN_SECONDS = '120';
    process.env.FNAC_ES_CHECK_INTERVAL_MAX_SECONDS = '60';

    expect(() => loadRetailerConfigs()).toThrow(/FNAC_ES_CHECK_INTERVAL/);
  });
});
