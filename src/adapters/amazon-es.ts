import * as cheerio from 'cheerio';
import { RetailerAdapter } from './base';
import { EvidenceSource, ProductAvailability } from '../domain/retailer';
import { httpGet, parseRetryAfterSeconds } from '../http/client';
import { classifyHttpStatus } from '../http/status';
import { isProductMatch } from '../domain/product';
import { parsePrice } from '../utils/price';
import { logger } from '../utils/logger';
import { isChallengePage } from '../utils/challenge';

/**
 * Amazon ES structural adapter. Amazon rarely exposes clean JSON-LD product
 * data and aggressively challenges scrapers, so this adapter relies on
 * specific PDP DOM ids and explicit Spanish availability phrases rather than
 * generic "buy button present" heuristics. It is intentionally conservative:
 * any layout it doesn't recognize (including CAPTCHA/"Robot Check" pages)
 * resolves to BLOCKED or UNKNOWN, never a false AVAILABLE.
 *
 * Product identity is verified primarily via the "Número de modelo del
 * producto" (MPN) detail bullet, since Amazon's page title often omits
 * distinguishing keywords (e.g. no "40" on the Zelda 40th Anniversary ASIN
 * B0F2TN43GH's title). See AMAZON_ES_ASIN / AMAZON_ES_ENABLED in
 * .env.example.
 */

const PREORDER_PATTERNS = [/reserva/i, /disponible el \d/i, /pre-?venta/i, /preorder/i];
// Future-availability phrasing without an explicit "reserve now" call to
// action — distinct from PREORDER_PATTERNS above.
const COMING_SOON_PATTERNS = [
  /pr[oó]ximamente/i,
  /disponible a partir d/i,
  /estar[aá] disponible/i,
  /saldr[aá] a la venta/i,
];
const OUT_OF_STOCK_PATTERNS = [
  /no disponible/i,
  /actualmente no disponible/i,
  /agotado/i,
  /no\s+hay\s+existencias/i,
  // Broad negation guard: catches "no ... disponible" phrasing not covered
  // above so AVAILABLE_PATTERNS never wins on a negated sentence.
  /\bno\b[^.,;\n]{0,30}\bdisponible\b/i,
];
// Deliberately narrow: unlike a generic /disponible/i, this only matches
// unambiguous in-stock phrasing. Any other text merely containing
// "disponible" (e.g. "Disponible mediante otros vendedores") falls through
// to UNKNOWN rather than risking a false AVAILABLE.
const AVAILABLE_PATTERNS = [
  /^\s*en stock\.?\s*$/i,
  /^\s*disponible\.?\s*$/i,
  /^\s*(s[oó]lo\s+)?queda[n]?\s+\d+/i,
];

const MODEL_NUMBER_LABEL_PATTERNS = [/n[uú]mero de modelo/i];
const EAN_LABEL_PATTERNS = [/c[oó]digo de barras/i, /\bean\b/i, /\bgtin\b/i];

const BUY_BOX_PRICE_CONTAINER_SELECTORS = [
  '#corePriceDisplay_desktop_feature_div',
  '#corePrice_feature_div',
  '#apex_desktop',
  '#buybox',
];

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

    const classification = classifyHttpStatus(httpStatus, retryAfterSeconds);
    if (classification) {
      return this.unknown({ ...base, ...classification });
    }

    if (isChallengePage(html)) {
      return this.unknown({ ...base, status: 'BLOCKED', errorMessage: 'CAPTCHA / anti-bot challenge detected' });
    }

    const $ = cheerio.load(html);
    // Inline <script>/<style> noise inside #availability (seen on real PDPs)
    // must not leak into the text we pattern-match against.
    $('script, style, noscript').remove();

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

    const modelNumber = readDetailBulletValue($, MODEL_NUMBER_LABEL_PATTERNS);
    if (modelNumber) evidence.push({ source: 'dom:detailBullets:modelNumber', value: modelNumber });
    const ean = readDetailBulletValue($, EAN_LABEL_PATTERNS);
    if (ean) evidence.push({ source: 'dom:detailBullets:ean', value: ean });

    const matched = isProductMatch(this.product, title, { mpn: modelNumber, ean });
    if (!matched) {
      return this.unknown({
        ...base,
        status: 'UNKNOWN',
        evidence,
        errorMessage: 'product identity did not match page title or identifiers',
      });
    }

    const availabilityText = $('#availability').text().trim() || $('#outOfStock').text().trim();
    evidence.push({ source: 'dom:#availability', value: availabilityText });

    let status: ProductAvailability['status'] = 'UNKNOWN';
    if (PREORDER_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'PREORDER';
    } else if (COMING_SOON_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'COMING_SOON';
    } else if (OUT_OF_STOCK_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'OUT_OF_STOCK';
    } else if (AVAILABLE_PATTERNS.some((pattern) => pattern.test(availabilityText))) {
      status = 'AVAILABLE';
    }

    const priceText = readBuyBoxPriceText($);
    if (priceText) evidence.push({ source: 'dom:buybox-price', value: priceText });
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

/**
 * Reads a value from the #detailBullets_feature_div list by matching the
 * bold label (e.g. "Número de modelo del producto"). Strips the
 * left-to-right/right-to-left marks (&lrm;/&rlm;) Amazon wraps labels in.
 */
function readDetailBulletValue($: cheerio.CheerioAPI, labelPatterns: RegExp[]): string | undefined {
  let value: string | undefined;
  $('#detailBullets_feature_div li').each((_, element) => {
    if (value) return;
    const item = $(element);
    const boldSpan = item.find('.a-text-bold').first();
    if (boldSpan.length === 0) return;
    const label = boldSpan
      .text()
      .replace(/[‎‏]/g, '')
      .replace(/:\s*$/, '')
      .trim();
    if (!labelPatterns.some((pattern) => pattern.test(label))) return;
    const valueSpan = boldSpan.closest('.a-list-item').children('span').not('.a-text-bold').first();
    const text = valueSpan.text().trim();
    if (text) value = text;
  });
  return value;
}

/**
 * Only reads price from buy-box containers, never a generic first
 * `.a-price .a-offscreen` on the page — unrelated carousel/sponsored items
 * (e.g. accessories, "frequently bought together") also use that class and
 * can otherwise be picked up as the product's own price.
 */
function readBuyBoxPriceText($: cheerio.CheerioAPI): string {
  const direct = $('#price_inside_buybox').first().text().trim();
  if (direct) return direct;

  for (const selector of BUY_BOX_PRICE_CONTAINER_SELECTORS) {
    const text = $(selector).find('.a-price .a-offscreen').first().text().trim();
    if (text) return text;
  }
  return '';
}
