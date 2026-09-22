export const STOCK_STATUSES = [
  'AVAILABLE',
  'PREORDER',
  'OUT_OF_STOCK',
  'COMING_SOON',
  'PRODUCT_REMOVED',
  'BLOCKED',
  'UNKNOWN',
  'ERROR',
] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export function isPurchasableStatus(status: StockStatus): boolean {
  return status === 'AVAILABLE' || status === 'PREORDER';
}
