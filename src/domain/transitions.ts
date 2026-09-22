import { StockStatus } from './stock-status';

const NOTIFY_WORTHY_STATUSES: ReadonlySet<StockStatus> = new Set([
  'AVAILABLE',
  'PREORDER',
  'OUT_OF_STOCK',
  'COMING_SOON',
  'PRODUCT_REMOVED',
  'BLOCKED',
]);

export function isPurchasable(status: StockStatus): boolean {
  return status === 'AVAILABLE' || status === 'PREORDER';
}

/**
 * Decides whether a status transition is worth a Telegram message. Flapping
 * between the two "we don't know" states (ERROR/UNKNOWN) is intentionally
 * silenced to avoid noise from transient network issues.
 */
export function shouldNotifyStatusChange(previous: StockStatus, next: StockStatus): boolean {
  if (previous === next) return false;
  if ((previous === 'ERROR' || previous === 'UNKNOWN') && (next === 'ERROR' || next === 'UNKNOWN')) {
    return false;
  }
  return NOTIFY_WORTHY_STATUSES.has(next) || NOTIFY_WORTHY_STATUSES.has(previous);
}

export function shouldNotifyPriceChange(
  previousPrice: number | undefined,
  previousStatus: StockStatus,
  nextPrice: number | undefined,
  nextStatus: StockStatus,
  significantPercent: number,
): boolean {
  if (previousStatus !== nextStatus) return false;
  if (!isPurchasable(nextStatus)) return false;
  if (previousPrice === undefined || nextPrice === undefined) return false;
  if (previousPrice === 0) return false;
  const changePercent = Math.abs((nextPrice - previousPrice) / previousPrice) * 100;
  return changePercent >= significantPercent;
}
