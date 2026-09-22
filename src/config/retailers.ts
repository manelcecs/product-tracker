import { RetailerConfig } from '../domain/retailer';

export function loadRetailerConfigs(): RetailerConfig[] {
  const amazonAsin = process.env.AMAZON_ES_ASIN || undefined;

  return [
    {
      id: 'mediamarkt-es',
      name: 'MediaMarkt ES',
      productUrl:
        process.env.MEDIAMARKT_ES_URL ??
        'https://www.mediamarkt.es/es/product/_consola-nintendo-switch-2-edicion-zelda-40-aniversario-79-full-hd-hdr-120-hz-256-gb-magnetic-joy-con-2-con-modo-raton-bateria-extraible-1674231.html',
      enabled: process.env.MEDIAMARKT_ES_ENABLED !== 'false',
      checkIntervalMsOverride: loadIntervalOverride('MEDIAMARKT_ES'),
      meta: { retailerProductId: '1674231' },
    },
    {
      id: 'fnac-es',
      name: 'Fnac ES',
      productUrl:
        process.env.FNAC_ES_URL ??
        'https://www.fnac.es/Consola-Nintendo-Switch-2-The-Legend-of-Zelda-40-Aniversario-Videoconsola/a13481099',
      enabled: process.env.FNAC_ES_ENABLED !== 'false',
      checkIntervalMsOverride: loadIntervalOverride('FNAC_ES'),
      meta: { retailerProductId: 'a13481099' },
    },
    {
      id: 'amazon-es',
      name: 'Amazon ES',
      productUrl: amazonAsin ? `https://www.amazon.es/dp/${amazonAsin}` : '',
      // Disabled by default: no verified ASIN for this exact bundle yet.
      // Set AMAZON_ES_ASIN and AMAZON_ES_ENABLED=true once confirmed.
      enabled: Boolean(amazonAsin) && process.env.AMAZON_ES_ENABLED === 'true',
      checkIntervalMsOverride: loadIntervalOverride('AMAZON_ES'),
      meta: { asin: amazonAsin ?? null },
    },
  ];
}

function loadIntervalOverride(prefix: string): RetailerConfig['checkIntervalMsOverride'] {
  const minSeconds = Number(process.env[`${prefix}_CHECK_INTERVAL_MIN_SECONDS`]);
  const maxSeconds = Number(process.env[`${prefix}_CHECK_INTERVAL_MAX_SECONDS`]);
  if (!Number.isFinite(minSeconds) && !Number.isFinite(maxSeconds)) return undefined;
  if (!Number.isFinite(minSeconds) || !Number.isFinite(maxSeconds) || minSeconds <= 0 || maxSeconds < minSeconds) {
    throw new Error(
      `${prefix}_CHECK_INTERVAL_MIN_SECONDS and ${prefix}_CHECK_INTERVAL_MAX_SECONDS must be positive numbers with max >= min`,
    );
  }
  return { min: minSeconds * 1000, max: maxSeconds * 1000 };
}
