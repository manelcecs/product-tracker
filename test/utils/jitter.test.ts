import { describe, expect, it } from 'vitest';
import { randomIntervalMs } from '../../src/utils/jitter';

describe('randomIntervalMs', () => {
  it('returns a value within [min, max)', () => {
    for (let i = 0; i < 50; i += 1) {
      const value = randomIntervalMs(60_000, 80_000);
      expect(value).toBeGreaterThanOrEqual(60_000);
      expect(value).toBeLessThan(80_000);
    }
  });

  it('returns min when max <= min', () => {
    expect(randomIntervalMs(1000, 1000)).toBe(1000);
    expect(randomIntervalMs(1000, 500)).toBe(1000);
  });
});
