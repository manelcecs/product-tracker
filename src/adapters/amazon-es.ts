import * as cheerio from 'cheerio';
import { RetailerAdapter } from './base';
import { EvidenceSource, ProductAvailability } from '../domain/retailer';
import { httpGet, parseRetryAfterSeconds } from '../http/client';
import { isProductMatch } from '../domain/product';
import { parsePrice } from '../utils/price';
import { logger } from '../utils/logger';
import { isChallengePage } from '../utils/challenge';

/**
 * Amazon ES structural template. Amazon rarely exposes clean JSON-LD product
 * data and aggressively challenges scrapers, so this adapter relies on
 * specific PDP DOM ids and explicit Spanish availability phrases rather than
 * generic "buy button present" heuristics. It is intentionally conservative:
 * any layout it doesn't recognize (including CAPTCHA/"Robot Check" pages)
 * resolves to BLOCKED or UNKNOWN, never a false AVAILABLE.
 *
 * DISABLED BY DEFAULT — see AMAZON_ES_ASIN / AMAZON_ES_ENABLED in
 * .env.example. No verified ASIN for the Zelda 40th Anniversary bundle has
 * been confirmed yet; research it before enabling in production.
 */

const PREORDER_PATTERNS = [/reserva/i, /disponible el \d/i, /pre-?venta/i, /preorder/i];
const OUT_OF_STOCK_PATTERNS = [/no disponible/i, /actualmente no disponible/i, /agotado/i];
const AVAILABLE_PATTERNS = [/en stock/i, /disponible/i];
export class AmazonEsAdapter extends RetailerAdapter {
  readonly id = 'amazon-es';
  readonly name = 'Amazon ES';

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

    if (httpStatus === 429) {
      return this.unknown({ ...base, status: 'ERROR', errorMessage: 'rate limited (429)', retryAfterSeconds });
    }
    if (httpStatus === 403) {
      return this.unknown({ ...base, status: 'BLOCKED', errorMessage: 'forbidden (403)' });
    }
    if (httpStatus === 404) {
      return this.unknown({ ...base, status: 'PRODUCT_REMOVED' });
    }
    if (httpStatus >= 500) {
      return this.unknown({ ...base, status: 'ERROR', errorMessage: `server error (${httpStatus})` });
    }

    if (isChallengePage(html)) {
      return this.unknown({ ...base, status: 'BLOCKED', errorMessage: 'CAPTCHA / anti-bot challenge detected' });
    }

    const $ = cheerio.load(html);
    const title = $('#productTitle').first().text().trim();
    const evidence: EvidenceSource[] = [{ source: 'dom:#productTitle', value: title }];

    if (!title) {
      return this.unknown({
        ...base,
        status: 'UNKNOWN',
        evidence,
        errorMessage: 'product title not found (layout changed or page blocked)',
      });
    }

    const matched = isProductMatch(this.product, title);
    if (!matched) {
      return this.unknown({
        ...base,
        status: 'UNKNOWN',
        evidence,
        errorMessage: 'product identity did not match page title',
      });
    }

    const availabilityText = $('#availability').text().trim() || $('#outOfStock').text().trim();
    evidence.push({ source: 'dom:#availability', value: availabilityText });

    let status: ProductAvailability['status'] = 'UNKNOWN';
    if (PREORDER_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'PREORDER';
    } else if (OUT_OF_STOCK_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'OUT_OF_STOCK';
    } else if (AVAILABLE_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'AVAILABLE';
    }

    const priceText =
      $('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen').first().text().trim() ||
      $('.a-price .a-offscreen').first().text().trim();
    if (priceText) evidence.push({ source: 'dom:.a-price', value: priceText });
    const parsedPrice = priceText ? parsePrice(priceText) : undefined;

    const sellerText = $('#sellerProfileTriggerId').first().text().trim() || $('#merchant-info').first().text().trim();

    return {
      retailerId: this.id,
      status,
      productVerified: true,
      price: parsedPrice?.amount,
      currency: parsedPrice?.currency,
      seller: sellerText || undefined,
      productUrl: this.config.productUrl,
      checkedAt,
      evidence,
      httpStatus,
      durationMs,
    };
  }
}
