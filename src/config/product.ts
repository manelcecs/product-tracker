import { ProductIdentity } from '../domain/product';

function splitKeywords(value: string): string[] {
  return value
    .split(',')
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

export function loadProductIdentity(): ProductIdentity {
  return {
    name: process.env.PRODUCT_NAME ?? 'Nintendo Switch 2 - The Legend of Zelda 40th Anniversary Edition',
    ean: process.env.PRODUCT_EAN ?? '0045496337292',
    mpn: process.env.PRODUCT_MPN ?? '10019448',
    releaseDate: process.env.PRODUCT_RELEASE_DATE ?? '2026-10-29',
    requiredKeywords: splitKeywords(process.env.PRODUCT_REQUIRED_KEYWORDS ?? 'nintendo switch 2,zelda,40'),
    excludedKeywords: splitKeywords(
      process.env.PRODUCT_EXCLUDED_KEYWORDS ??
        'funda,carcasa,mando,case,grip,protector,cable,soporte,figura,amiibo,dock',
    ),
  };
}
