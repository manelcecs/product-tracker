import { ProductAvailability } from '../domain/retailer';

function formatPrice(availability: ProductAvailability): string {
  if (availability.price === undefined) return 'unknown';
  return `${availability.price} ${availability.currency ?? ''}`.trim();
}

export function formatInitMessage(retailerName: string, availability: ProductAvailability): string {
  return [
    '🆕 <b>Monitoring initialized</b>',
    `Retailer: ${retailerName}`,
    `Status: ${availability.status}`,
    `Price: ${formatPrice(availability)}`,
    `URL: ${availability.productUrl}`,
    `Checked at: ${availability.checkedAt}`,
  ].join('\n');
}

export function formatTransitionMessage(
  retailerName: string,
  previousStatus: string,
  availability: ProductAvailability,
): string {
  return [
    '🔔 <b>Status change</b>',
    `Retailer: ${retailerName}`,
    `${previousStatus} → ${availability.status}`,
    `Price: ${formatPrice(availability)}`,
    `URL: ${availability.productUrl}`,
    `Checked at: ${availability.checkedAt}`,
  ].join('\n');
}

export function formatPriceChangeMessage(
  retailerName: string,
  previousPrice: number,
  availability: ProductAvailability,
): string {
  return [
    '💰 <b>Price change</b>',
    `Retailer: ${retailerName}`,
    `${previousPrice} → ${formatPrice(availability)}`,
    `Status: ${availability.status}`,
    `URL: ${availability.productUrl}`,
    `Checked at: ${availability.checkedAt}`,
  ].join('\n');
}
