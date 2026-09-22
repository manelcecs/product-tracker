import { z } from 'zod';
import { ProductIdentity } from '../domain/product';

const envSchema = z.object({
  PRODUCT_NAME: z.string().default('Nintendo Switch 2 - The Legend of Zelda 40th Anniversary Edition'),
  PRODUCT_EAN: z.string().default('0045496337292'),
  PRODUCT_MPN: z.string().default('10019448'),
  PRODUCT_RELEASE_DATE: z.string().default('2026-10-29'),
  PRODUCT_REQUIRED_KEYWORDS: z.string().default('nintendo switch 2,zelda,40'),
  PRODUCT_EXCLUDED_KEYWORDS: z
    .string()
    .default('funda,carcasa,mando,case,grip,protector,cable,soporte,figura,amiibo,dock'),
});

function splitKeywords(value: string): string[] {
  return value
    .split(',')
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

export function loadProductIdentity(): ProductIdentity {
  const env = envSchema.parse(process.env);

  return {
    name: env.PRODUCT_NAME,
    ean: env.PRODUCT_EAN,
    mpn: env.PRODUCT_MPN,
    releaseDate: env.PRODUCT_RELEASE_DATE,
    requiredKeywords: splitKeywords(env.PRODUCT_REQUIRED_KEYWORDS),
    excludedKeywords: splitKeywords(env.PRODUCT_EXCLUDED_KEYWORDS),
  };
}
