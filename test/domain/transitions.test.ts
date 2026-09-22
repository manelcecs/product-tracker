import { describe, expect, it } from 'vitest';
import { shouldNotifyPriceChange, shouldNotifyStatusChange } from '../../src/domain/transitions';

describe('shouldNotifyStatusChange', () => {
  it('does not notify when the status is unchanged', () => {
    expect(shouldNotifyStatusChange('AVAILABLE', 'AVAILABLE')).toBe(false);
  });

  it('notifies on OUT_OF_STOCK -> AVAILABLE', () => {
    expect(shouldNotifyStatusChange('OUT_OF_STOCK', 'AVAILABLE')).toBe(true);
  });

  it('notifies on PREORDER -> AVAILABLE', () => {
    expect(shouldNotifyStatusChange('PREORDER', 'AVAILABLE')).toBe(true);
  });

  it('silences flapping between ERROR and UNKNOWN', () => {
    expect(shouldNotifyStatusChange('ERROR', 'UNKNOWN')).toBe(false);
    expect(shouldNotifyStatusChange('UNKNOWN', 'ERROR')).toBe(false);
  });

  it('notifies when recovering from UNKNOWN to a confirmed status', () => {
    expect(shouldNotifyStatusChange('UNKNOWN', 'OUT_OF_STOCK')).toBe(true);
  });
});

describe('shouldNotifyPriceChange', () => {
  it('notifies on a significant price increase while AVAILABLE', () => {
    expect(shouldNotifyPriceChange(500, 'AVAILABLE', 550, 'AVAILABLE', 5)).toBe(true);
  });

  it('does not notify on a small price change below the threshold', () => {
    expect(shouldNotifyPriceChange(500, 'AVAILABLE', 505, 'AVAILABLE', 5)).toBe(false);
  });

  it('does not notify on price changes while unavailable', () => {
    expect(shouldNotifyPriceChange(500, 'OUT_OF_STOCK', 550, 'OUT_OF_STOCK', 5)).toBe(false);
  });

  it('does not double-notify when the status also changed', () => {
    expect(shouldNotifyPriceChange(500, 'PREORDER', 550, 'AVAILABLE', 5)).toBe(false);
  });
});
