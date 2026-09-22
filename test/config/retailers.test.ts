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

  it('disables El Corte Inglés ES by default with no product URL', () => {
    delete process.env.ELCORTEINGLES_ES_URL;
    delete process.env.ELCORTEINGLES_ES_ENABLED;

    const elCorteIngles = loadRetailerConfigs().find((retailer) => retailer.id === 'elcorteingles-es');

    expect(elCorteIngles?.enabled).toBe(false);
    expect(elCorteIngles?.productUrl).toBe('');
  });

  it('keeps El Corte Inglés ES disabled unless both a URL and the enabled flag are set', () => {
    process.env.ELCORTEINGLES_ES_URL = 'https://www.elcorteingles.es/example/a40123456';
    process.env.ELCORTEINGLES_ES_ENABLED = 'false';

    expect(loadRetailerConfigs().find((r) => r.id === 'elcorteingles-es')?.enabled).toBe(false);

    delete process.env.ELCORTEINGLES_ES_URL;
    process.env.ELCORTEINGLES_ES_ENABLED = 'true';

    expect(loadRetailerConfigs().find((r) => r.id === 'elcorteingles-es')?.enabled).toBe(false);
  });

  it('enables El Corte Inglés ES only when both URL and enabled flag are provided', () => {
    process.env.ELCORTEINGLES_ES_URL = 'https://www.elcorteingles.es/example/a40123456';
    process.env.ELCORTEINGLES_ES_ENABLED = 'true';

    const elCorteIngles = loadRetailerConfigs().find((retailer) => retailer.id === 'elcorteingles-es');

    expect(elCorteIngles?.enabled).toBe(true);
    expect(elCorteIngles?.productUrl).toBe('https://www.elcorteingles.es/example/a40123456');
  });
});
