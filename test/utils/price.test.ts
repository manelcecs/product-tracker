import { describe, expect, it } from 'vitest';
import { parsePrice } from '../../src/utils/price';

describe('parsePrice', () => {
  it('parses a comma-decimal euro price', () => {
    expect(parsePrice('579,99 €')).toEqual({ amount: 579.99, currency: 'EUR' });
  });

  it('parses a dot-decimal price with no symbol as EUR', () => {
    expect(parsePrice('579.99')).toEqual({ amount: 579.99, currency: 'EUR' });
  });

  it('parses a thousands-separated euro price', () => {
    expect(parsePrice('1.234,50€')).toEqual({ amount: 1234.5, currency: 'EUR' });
  });

  it('returns undefined for non-numeric input', () => {
    expect(parsePrice('no price available')).toBeUndefined();
  });
});
