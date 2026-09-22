import { RetailerAdapter } from './base';
import { EvidenceSource, ProductAvailability } from '../domain/retailer';
import { httpGet, parseRetryAfterSeconds } from '../http/client';
import { classifyHttpStatus } from '../http/status';
import { availabilityToStatus, extractJsonLdProducts } from '../utils/json-ld';
import { isProductMatch } from '../domain/product';
import { parsePrice } from '../utils/price';
import { logger } from '../utils/logger';
import { stringOrUndefined } from '../utils/string';
import { isChallengePage } from '../utils/challenge';

export class MediaMarktEsAdapter extends RetailerAdapter {
  readonly id = 'mediamarkt-es';
  readonly name = 'MediaMarkt ES';

  async check(): Promise<ProductAvailability> {
    const startedAt = new Date().toISOString();
    try {
      const response = await httpGet(this.config.productUrl);
      const retryAfterSeconds = parseRetryAfterSeconds(response.headers);
      return this.parse(response.body, response.status, response.durationMs, retryAfterSeconds);
    } catch (error) {
      logger.warn({ retailer: this.id, err: (error as Error).message }, 'network error during check');
      return this.unknown({ status: 'ERROR', checkedAt: startedAt, errorMessage: (error as Error).message });
    }
  }

  parse(html: string, httpStatus: number, durationMs?: number, retryAfterSeconds?: number): ProductAvailability {
    const checkedAt = new Date().toISOString();
    const base = { checkedAt, httpStatus, durationMs, productUrl: this.config.productUrl };

    const classification = classifyHttpStatus(httpStatus, retryAfterSeconds);
    if (classification) {
      return this.unknown({ ...base, ...classification });
    }
    if (isChallengePage(html)) {
      return this.unknown({ ...base, status: 'BLOCKED', errorMessage: 'CAPTCHA / anti-bot challenge detected' });
    }

    const products = extractJsonLdProducts(html);
    if (products.length === 0) {
      return this.unknown({ ...base, status: 'UNKNOWN', errorMessage: 'no JSON-LD product data found' });
    }

    const evidence: EvidenceSource[] = [];
    for (const product of products) {
      const text = String(product.name ?? '');
      evidence.push({ source: 'json-ld:name', value: text });

      const matched = isProductMatch(this.product, text, {
        ean: stringOrUndefined(product.gtin13 ?? product.gtin),
        mpn: stringOrUndefined(product.mpn),
      });
      if (!matched) continue;

      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const availability = offers?.availability;
      const status = availabilityToStatus(availability) ?? 'UNKNOWN';
      const parsedPrice = offers?.price !== undefined ? parsePrice(String(offers.price)) : undefined;
      evidence.push({ source: 'json-ld:availability', value: availability ?? 'unknown' });

      return {
        retailerId: this.id,
        status,
        productVerified: true,
        price: parsedPrice?.amount,
        currency: offers?.priceCurrency ?? parsedPrice?.currency,
        seller: offers?.seller?.name,
        productUrl: this.config.productUrl,
        checkedAt,
        evidence,
        httpStatus,
        durationMs,
      };
    }

    return this.unknown({
      ...base,
      status: 'UNKNOWN',
      productVerified: false,
      evidence,
      errorMessage: 'product identity did not match JSON-LD data',
    });
  }
}
