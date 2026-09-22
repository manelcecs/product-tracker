import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RetailerAdapter } from '../../src/adapters/base';
import { ProductAvailability, RetailerConfig } from '../../src/domain/retailer';
import { ProductIdentity } from '../../src/domain/product';
import { JsonStateStore } from '../../src/persistence/store';
import { TelegramNotifier } from '../../src/notifications/telegram';
import { runRetailerCheck } from '../../src/scheduler/monitor';

class FakeAdapter extends RetailerAdapter {
  readonly id = 'fake-retailer';
  readonly name = 'Fake Retailer';
  private readonly queue: ProductAvailability[];

  constructor(config: RetailerConfig, product: ProductIdentity, results: ProductAvailability[]) {
    super(config, product);
    this.queue = [...results];
  }

  async check(): Promise<ProductAvailability> {
    const next = this.queue.shift();
    if (!next) throw new Error('FakeAdapter: no more queued results');
    return next;
  }
}

function makeAvailability(overrides: Partial<ProductAvailability>): ProductAvailability {
  return {
    retailerId: 'fake-retailer',
    status: 'UNKNOWN',
    productVerified: false,
    productUrl: 'https://example.com',
    checkedAt: new Date().toISOString(),
    evidence: [],
    ...overrides,
  };
}

const retailerConfig: RetailerConfig = {
  id: 'fake-retailer',
  name: 'Fake Retailer',
  productUrl: 'https://example.com',
  enabled: true,
};
const product: ProductIdentity = { name: 'Fake Product', requiredKeywords: [] };

describe('runRetailerCheck', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function setup(results: ProductAvailability[]) {
    dir = mkdtempSync(path.join(tmpdir(), 'product-tracker-monitor-'));
    const store = new JsonStateStore(dir);
    await store.load();
    const adapter = new FakeAdapter(retailerConfig, product, results);
    const notifier = new TelegramNotifier({});
    const sendSpy = vi.spyOn(notifier, 'send').mockResolvedValue();
    return { store, adapter, notifier, sendSpy };
  }

  it('sends exactly one init notification on the first check', async () => {
    const { store, adapter, notifier, sendSpy } = await setup([makeAvailability({ status: 'OUT_OF_STOCK' })]);
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toBe('init:fake-retailer');
  });

  it('notifies on a meaningful status transition after init', async () => {
    const { store, adapter, notifier, sendSpy } = await setup([
      makeAvailability({ status: 'OUT_OF_STOCK' }),
      makeAvailability({ status: 'AVAILABLE', price: 579.99, currency: 'EUR' }),
    ]);
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    sendSpy.mockClear();
    const { state } = await runRetailerCheck({
      adapter,
      retailerName: 'Fake Retailer',
      store,
      notifier,
      significantPriceChangePercent: 5,
    });
    expect(state.status).toBe('AVAILABLE');
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toContain('transition:');
  });

  it('does not notify again when the status is unchanged', async () => {
    const { store, adapter, notifier, sendSpy } = await setup([
      makeAvailability({ status: 'OUT_OF_STOCK' }),
      makeAvailability({ status: 'OUT_OF_STOCK' }),
    ]);
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    sendSpy.mockClear();
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('preserves the previous status on ERROR and does not notify', async () => {
    const { store, adapter, notifier, sendSpy } = await setup([
      makeAvailability({ status: 'AVAILABLE', price: 579.99, currency: 'EUR' }),
      makeAvailability({ status: 'ERROR', errorMessage: 'network timeout' }),
    ]);
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    sendSpy.mockClear();
    const { state } = await runRetailerCheck({
      adapter,
      retailerName: 'Fake Retailer',
      store,
      notifier,
      significantPriceChangePercent: 5,
    });
    expect(state.status).toBe('AVAILABLE');
    expect(state.consecutiveFailures).toBe(1);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('notifies on a significant price change while AVAILABLE', async () => {
    const { store, adapter, notifier, sendSpy } = await setup([
      makeAvailability({ status: 'AVAILABLE', price: 500, currency: 'EUR' }),
      makeAvailability({ status: 'AVAILABLE', price: 550, currency: 'EUR' }),
    ]);
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    sendSpy.mockClear();
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][1]).toContain('price:');
  });

  it('does not notify on a price-only change while unavailable', async () => {
    const { store, adapter, notifier, sendSpy } = await setup([
      makeAvailability({ status: 'OUT_OF_STOCK', price: 500, currency: 'EUR' }),
      makeAvailability({ status: 'OUT_OF_STOCK', price: 600, currency: 'EUR' }),
    ]);
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    sendSpy.mockClear();
    await runRetailerCheck({ adapter, retailerName: 'Fake Retailer', store, notifier, significantPriceChangePercent: 5 });
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
