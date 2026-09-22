import * as cheerio from 'cheerio';

export interface MicrodataProduct {
  name?: string;
  price?: string;
  priceCurrency?: string;
  availability?: string;
  sku?: string;
  mpn?: string;
  gtin13?: string;
}

/** Fallback structured-data extraction for retailers using schema.org microdata instead of JSON-LD. */
export function extractMicrodataProduct(html: string): MicrodataProduct | undefined {
  const $ = cheerio.load(html);
  const productScope = $('[itemtype*="schema.org/Product"]').first();
  if (productScope.length === 0) return undefined;

  const read = (prop: string): string | undefined => {
    const element = productScope.find(`[itemprop="${prop}"]`).first();
    if (element.length === 0) return undefined;
    return element.attr('content') ?? element.attr('href') ?? element.text().trim();
  };

  return {
    name: read('name'),
    price: read('price'),
    priceCurrency: read('priceCurrency'),
    availability: read('availability'),
    sku: read('sku'),
    mpn: read('mpn'),
    gtin13: read('gtin13'),
  };
}
