import { describe, expect, it } from 'vitest';
import { computeBackoffDelayMs } from '../../src/utils/backoff';

describe('computeBackoffDelayMs', () => {
  it('honors Retry-After when provided', () => {
    expect(computeBackoffDelayMs(1, 30)).toBe(30_000);
  });

  it('escalates exponentially with consecutive failures', () => {
    expect(computeBackoffDelayMs(1)).toBe(60_000);
    expect(computeBackoffDelayMs(2)).toBe(120_000);
    expect(computeBackoffDelayMs(3)).toBe(240_000);
  });

  it('caps at the highest step for many failures', () => {
    expect(computeBackoffDelayMs(100)).toBe(960_000);
  });
});
