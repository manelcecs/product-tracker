import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonStateStore } from '../../src/persistence/store';

describe('JsonStateStore', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('persists and reloads state across separate instances (simulating a restart)', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'product-tracker-'));
    const store = new JsonStateStore(dir);
    await store.load();
    expect(store.get('mediamarkt-es')).toBeUndefined();

    await store.set({
      retailerId: 'mediamarkt-es',
      retailerName: 'MediaMarkt ES',
      productUrl: 'https://example.com',
      status: 'AVAILABLE',
      price: 579.99,
      currency: 'EUR',
      consecutiveFailures: 0,
      initialized: true,
    });

    const reloaded = new JsonStateStore(dir);
    await reloaded.load();
    expect(reloaded.get('mediamarkt-es')?.status).toBe('AVAILABLE');
    expect(reloaded.get('mediamarkt-es')?.price).toBeCloseTo(579.99);
  });

  it('throws if accessed before load()', () => {
    const store = new JsonStateStore('/tmp/product-tracker-unused');
    expect(() => store.get('x')).toThrow();
  });

  it('serializes concurrent writes without dropping retailer state', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'product-tracker-'));
    const store = new JsonStateStore(dir);
    await store.load();

    await Promise.all([
      store.set({
        retailerId: 'mediamarkt-es',
        retailerName: 'MediaMarkt ES',
        productUrl: 'https://example.com/mediamarkt',
        status: 'OUT_OF_STOCK',
        consecutiveFailures: 0,
        initialized: true,
      }),
      store.set({
        retailerId: 'fnac-es',
        retailerName: 'Fnac ES',
        productUrl: 'https://example.com/fnac',
        status: 'PREORDER',
        price: 579.99,
        currency: 'EUR',
        consecutiveFailures: 0,
        initialized: true,
      }),
    ]);

    const raw = await readFile(path.join(dir, 'state.json'), 'utf-8');
    const persisted = JSON.parse(raw);
    expect(persisted['mediamarkt-es'].status).toBe('OUT_OF_STOCK');
    expect(persisted['fnac-es'].status).toBe('PREORDER');
  });
});
