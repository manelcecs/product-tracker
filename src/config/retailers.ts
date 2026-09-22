import { z } from 'zod';
import { RetailerConfig } from '../domain/retailer';

const intervalOverrideSchema = z
  .object({
    min: z.coerce.number().positive(),
    max: z.coerce.number().positive(),
  })
  .refine((value) => value.max >= value.min);

export function loadRetailerConfigs(): RetailerConfig[] {
  const amazonAsin = process.env.AMAZON_ES_ASIN || undefined;
  const elCorteInglesUrl = process.env.ELCORTEINGLES_ES_URL || undefined;

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
    {
      id: 'elcorteingles-es',
      name: 'El Corte Inglés ES',
      productUrl: elCorteInglesUrl ?? '',
      // Disabled by default: no verified direct product URL for this exact
      // bundle yet (category/accessory pages don't count). Set
      // ELCORTEINGLES_ES_URL and ELCORTEINGLES_ES_ENABLED=true once confirmed.
      enabled: Boolean(elCorteInglesUrl) && process.env.ELCORTEINGLES_ES_ENABLED === 'true',
      checkIntervalMsOverride: loadIntervalOverride('ELCORTEINGLES_ES'),
    },
  ];
}

function loadIntervalOverride(prefix: string): RetailerConfig['checkIntervalMsOverride'] {
  const minRaw = process.env[`${prefix}_CHECK_INTERVAL_MIN_SECONDS`];
  const maxRaw = process.env[`${prefix}_CHECK_INTERVAL_MAX_SECONDS`];
  if (minRaw === undefined && maxRaw === undefined) return undefined;

  const result = intervalOverrideSchema.safeParse({ min: minRaw, max: maxRaw });
  if (!result.success) {
    throw new Error(
      `${prefix}_CHECK_INTERVAL_MIN_SECONDS and ${prefix}_CHECK_INTERVAL_MAX_SECONDS must be positive numbers with max >= min`,
    );
  }
  return { min: result.data.min * 1000, max: result.data.max * 1000 };
}
