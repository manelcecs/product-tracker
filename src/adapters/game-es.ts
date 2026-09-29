import * as cheerio from 'cheerio';
import { RetailerAdapter } from './base';
import { EvidenceSource, ProductAvailability } from '../domain/retailer';
import { httpGet, parseRetryAfterSeconds } from '../http/client';
import { classifyHttpStatus } from '../http/status';
import { availabilityToStatus, extractJsonLdProducts, JsonLdOffer } from '../utils/json-ld';
import { isProductMatch } from '../domain/product';
import { parsePrice } from '../utils/price';
import { logger } from '../utils/logger';
import { stringOrUndefined } from '../utils/string';
import { isChallengePage } from '../utils/challenge';

export class GameEsAdapter extends RetailerAdapter {
  readonly id = 'game-es';
  readonly name = 'GAME ES';

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

    const evidence: EvidenceSource[] = [];

    for (const product of extractJsonLdProducts(html)) {
      // GAME.es JSON-LD text is HTML-entity-encoded even inside the script
      // block (e.g. "Edici&#243;n"), so decode before keyword matching.
      const text = decodeHtmlEntities(String(product.name ?? ''));
      evidence.push({ source: 'json-ld:name', value: text });

      const matched = isProductMatch(this.product, text, {
        ean: stringOrUndefined(product.gtin13 ?? product.gtin),
        mpn: stringOrUndefined(product.mpn),
      });
      if (!matched) continue;

      const resolution = resolvePrimaryOffer(product.offers);
      if (resolution && 'ambiguous' in resolution) {
        return this.unknown({
          ...base,
          status: 'UNKNOWN',
          productVerified: true,
          evidence,
          errorMessage: `ambiguous offers: ${resolution.reason}`,
        });
      }

      const offer = resolution?.offer;
      const availability = offer?.availability;
      const status = availabilityToStatus(availability) ?? 'UNKNOWN';
      const parsedPrice = offer?.price !== undefined ? parsePrice(String(offer.price)) : undefined;
      evidence.push({ source: 'json-ld:availability', value: availability ?? 'unknown' });

      return {
        retailerId: this.id,
        status,
        productVerified: true,
        price: parsedPrice?.amount,
        currency: offer?.priceCurrency ?? parsedPrice?.currency,
        seller: offer?.seller?.name,
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

type OfferResolution = { offer: JsonLdOffer } | { ambiguous: true; reason: string };

/**
 * GAME.es wraps its actual offer(s) inside a top-level AggregateOffer (with
 * highPrice/lowPrice summary fields and no availability of its own) rather
 * than exposing a plain Offer/array directly. Falls back to treating
 * `offers` as a plain Offer for other shapes.
 *
 * With a single offer, use it directly. With multiple offers (e.g. new +
 * "segunda mano"/pre-owned, or third-party marketplace sellers), never let a
 * used/refurbished or non-GAME-sold offer drive the reported status: filter
 * down to offers that are clearly new and (when a seller is stated) sold by
 * GAME. If exactly one remains, use it. If several remain but all report the
 * same availability, that availability is safe to use. Otherwise the offers
 * are genuinely ambiguous and must resolve to UNKNOWN rather than risk a
 * false AVAILABLE from the wrong offer.
 */
function resolvePrimaryOffer(offers: JsonLdOffer | JsonLdOffer[] | undefined): OfferResolution | undefined {
  const list = normalizeOfferList(offers);
  if (list.length === 0) return undefined;
  if (list.length === 1) {
    // A lone used/refurbished offer must never drive the new console's status.
    if (!isNewCondition(list[0].itemCondition)) {
      return { ambiguous: true, reason: 'only offer is not in new condition' };
    }
    return { offer: list[0] };
  }

  const eligible = list.filter(
    (offer) => isNewCondition(offer.itemCondition) && isGameSeller(offer.seller?.name),
  );

  if (eligible.length === 0) {
    return { ambiguous: true, reason: 'multiple offers, none clearly a new offer sold by GAME' };
  }
  if (eligible.length === 1) return { offer: eligible[0] };

  const availabilities = new Set(eligible.map((offer) => offer.availability));
  if (availabilities.size === 1) return { offer: eligible[0] };

  return { ambiguous: true, reason: 'multiple new offers with conflicting availability' };
}

function normalizeOfferList(offers: JsonLdOffer | JsonLdOffer[] | undefined): JsonLdOffer[] {
  if (!offers) return [];
  if (Array.isArray(offers)) return offers;
  const record = offers as unknown as Record<string, unknown>;
  if (record['@type'] === 'AggregateOffer' && Array.isArray(record['offers'])) {
    return record['offers'] as JsonLdOffer[];
  }
  return [offers];
}

function isNewCondition(itemCondition: string | undefined): boolean {
  if (!itemCondition) return true;
  const normalized = itemCondition.replace('https://schema.org/', '').replace('http://schema.org/', '');
  return normalized === 'NewCondition';
}

function isGameSeller(sellerName: string | undefined): boolean {
  if (!sellerName) return true;
  return /\bgame\b/i.test(sellerName);
}

/** Decodes numeric/named HTML entities left undecoded inside <script> text content. */
function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text;
  return cheerio.load(`<div>${text}</div>`)('div').text();
}
