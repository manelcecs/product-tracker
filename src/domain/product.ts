export interface ProductIdentity {
  name: string;
  ean?: string;
  mpn?: string;
  releaseDate?: string;
  /** Lowercase substrings that must ALL appear in matched text. */
  requiredKeywords: string[];
  /** Lowercase substrings that disqualify a match (accessories, etc). */
  excludedKeywords?: string[];
}

export interface ProductIdentifiers {
  ean?: string;
  mpn?: string;
}

/**
 * Confirms whether a piece of retailer text/identifier data refers to the
 * configured product. Exact EAN/MPN matches short-circuit to true; otherwise
 * falls back to keyword matching, which is deliberately conservative
 * (excluded keywords reject a match before required keywords are checked).
 */
export function isProductMatch(
  identity: ProductIdentity,
  text: string,
  identifiers: ProductIdentifiers = {},
): boolean {
  const normalizedText = text.toLowerCase();

  if (identity.ean && identifiers.ean && normalizeCode(identifiers.ean) === normalizeCode(identity.ean)) {
    return true;
  }
  if (identity.mpn && identifiers.mpn && identifiers.mpn.trim().toLowerCase() === identity.mpn.trim().toLowerCase()) {
    return true;
  }

  const hasExcludedKeyword = (identity.excludedKeywords ?? []).some((keyword) => normalizedText.includes(keyword));
  if (hasExcludedKeyword) return false;

  if (identity.requiredKeywords.length === 0) return false;
  return identity.requiredKeywords.every((keyword) => normalizedText.includes(keyword));
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '');
}
