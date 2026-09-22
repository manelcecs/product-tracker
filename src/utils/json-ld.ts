import * as cheerio from 'cheerio';

export interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  seller?: { name?: string };
}

export interface JsonLdProduct {
  name?: string;
  sku?: string;
  gtin13?: string;
  gtin?: string;
  mpn?: string;
  offers?: JsonLdOffer | JsonLdOffer[];
  [key: string]: unknown;
}

/** Extracts all schema.org Product nodes from <script type="application/ld+json"> blocks. */
export function extractJsonLdProducts(html: string): JsonLdProduct[] {
  const $ = cheerio.load(html);
  const results: JsonLdProduct[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) collectProductNodes(item, results);
    } catch {
      // Malformed JSON-LD block; skip rather than throw.
    }
  });

  return results;
}

function collectProductNodes(node: unknown, results: JsonLdProduct[]): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('Product')) {
    results.push(record as JsonLdProduct);
  }
  if (Array.isArray(record['@graph'])) {
    for (const child of record['@graph'] as unknown[]) {
      collectProductNodes(child, results);
    }
  }
}

export type SchemaAvailabilityStatus = 'AVAILABLE' | 'PREORDER' | 'OUT_OF_STOCK' | 'COMING_SOON';

export function availabilityToStatus(availability?: string): SchemaAvailabilityStatus | undefined {
  if (!availability) return undefined;
  const normalized = availability.replace('https://schema.org/', '').replace('http://schema.org/', '');
  switch (normalized) {
    case 'InStock':
    case 'LimitedAvailability':
      return 'AVAILABLE';
    case 'PreOrder':
      return 'PREORDER';
    case 'OutOfStock':
    case 'SoldOut':
    case 'Discontinued':
      return 'OUT_OF_STOCK';
    case 'PreSale':
    case 'ComingSoon':
      return 'COMING_SOON';
    default:
      return undefined;
  }
}
