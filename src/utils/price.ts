export interface ParsedPrice {
  amount: number;
  currency: string;
}

/**
 * Normalizes retailer price strings ("579,99 €", "1.234,50€", "579.99") into
 * a numeric amount + ISO currency code. Defaults to EUR when no symbol is
 * present, since all current adapters target Spanish retailers.
 */
export function parsePrice(raw: string): ParsedPrice | undefined {
  const currencySymbolMatch = raw.match(/[€$£]/);
  const currency = currencySymbolMatch ? symbolToCurrency(currencySymbolMatch[0]) : 'EUR';

  const numericPart = raw.replace(/[^\d.,]/g, '').trim();
  if (!numericPart) return undefined;

  let normalized: string;
  if (numericPart.includes(',') && numericPart.includes('.')) {
    normalized = numericPart.replace(/\./g, '').replace(',', '.');
  } else if (numericPart.includes(',')) {
    normalized = numericPart.replace(',', '.');
  } else {
    normalized = numericPart;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return undefined;
  return { amount, currency };
}

function symbolToCurrency(symbol: string): string {
  switch (symbol) {
    case '€':
      return 'EUR';
    case '$':
      return 'USD';
    case '£':
      return 'GBP';
    default:
      return 'EUR';
  }
}
