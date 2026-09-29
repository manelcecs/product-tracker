import { describe, expect, it } from 'vitest';
import { AmazonEsAdapter } from '../../src/adapters/amazon-es';
import { RetailerConfig } from '../../src/domain/retailer';
import { StockStatus } from '../../src/domain/stock-status';
import { loadProductIdentity } from '../../src/config/product';
import { loadFixture } from '../helpers/fixtures';

function buildAvailabilityFixture(availabilityText: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><title>Amazon.es</title></head>
<body>
<div id="productTitle">Nintendo Switch 2 - The Legend of Zelda 40th Anniversary Edition - Consola</div>
<div id="availability"><span class="a-size-medium">${availabilityText}</span></div>
</body>
</html>`;
}

const config: RetailerConfig = {
  id: 'amazon-es',
  name: 'Amazon ES',
  productUrl: 'https://www.amazon.es/dp/B0F2TN43GH',
  enabled: true,
};

const product = loadProductIdentity();

describe('AmazonEsAdapter (verified ASIN B0F2TN43GH)', () => {
  const adapter = new AmazonEsAdapter(config, product);

  it('reports AVAILABLE for a verified product with "En stock" text', () => {
    const result = adapter.parse(loadFixture('amazon/available.html'), 200);
    expect(result.status).toBe('AVAILABLE');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeCloseTo(579.99);
    expect(result.seller).toContain('Amazon');
  });

  it('reports PREORDER for "Disponible el <date>" text', () => {
    const result = adapter.parse(loadFixture('amazon/preorder.html'), 200);
    expect(result.status).toBe('PREORDER');
    expect(result.productVerified).toBe(true);
  });

  it('returns UNKNOWN for a mismatched accessory title', () => {
    const result = adapter.parse(loadFixture('amazon/wrong-product.html'), 200);
    expect(result.status).toBe('UNKNOWN');
    expect(result.productVerified).toBe(false);
  });

  it('returns BLOCKED when a CAPTCHA challenge page is detected', () => {
    const result = adapter.parse(loadFixture('amazon/captcha.html'), 200);
    expect(result.status).toBe('BLOCKED');
  });

  it('returns UNKNOWN when the layout has no recognizable product title', () => {
    const result = adapter.parse(loadFixture('amazon/malformed.html'), 200);
    expect(result.status).toBe('UNKNOWN');
  });

  it('maps HTTP 403 to BLOCKED', () => {
    expect(adapter.parse('', 403).status).toBe('BLOCKED');
  });

  it('maps HTTP 429 to ERROR and preserves retryAfterSeconds', () => {
    const result = adapter.parse('', 429, undefined, 60);
    expect(result.status).toBe('ERROR');
    expect(result.retryAfterSeconds).toBe(60);
  });

  it('verifies identity via the "Número de modelo del producto" MPN detail bullet even when the title omits "40", reports OUT_OF_STOCK, and ignores unrelated carousel prices', () => {
    const result = adapter.parse(loadFixture('amazon/live-model-number-out-of-stock.html'), 200);
    expect(result.status).toBe('OUT_OF_STOCK');
    expect(result.productVerified).toBe(true);
    expect(result.price).toBeUndefined();
    expect(result.evidence.some((e) => e.source === 'dom:detailBullets:modelNumber' && e.value === '10019448')).toBe(
      true,
    );
  });

  const availabilityTextCases: Array<[string, StockStatus]> = [
    ['No disponible.', 'OUT_OF_STOCK'],
    ['Actualmente no disponible.', 'OUT_OF_STOCK'],
    ['Disponible próximamente.', 'COMING_SOON'],
    ['Disponible a partir del 29 de octubre de 2026.', 'COMING_SOON'],
    ['Estará disponible en breve.', 'COMING_SOON'],
    ['Este producto saldrá a la venta el 29 de octubre de 2026.', 'COMING_SOON'],
    ['En stock', 'AVAILABLE'],
    ['Disponible.', 'AVAILABLE'],
    ['Sólo quedan 2 en stock', 'AVAILABLE'],
    ['Quedan 5', 'AVAILABLE'],
    ['Disponible mediante otros vendedores en Amazon.', 'UNKNOWN'],
  ];

  it.each(availabilityTextCases)('maps availability text %j to %s', (availabilityText, expectedStatus) => {
    const result = adapter.parse(buildAvailabilityFixture(availabilityText), 200);
    expect(result.status).toBe(expectedStatus);
  });
});
