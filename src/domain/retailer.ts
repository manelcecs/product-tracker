import { StockStatus } from './stock-status';

export interface RetailerConfig {
  id: string;
  name: string;
  productUrl: string;
  enabled: boolean;
  checkIntervalMsOverride?: { min: number; max: number };
  meta?: Record<string, unknown>;
}

export interface EvidenceSource {
  /** e.g. 'json-ld:availability', 'microdata:price', 'dom:#availability' */
  source: string;
  value: string;
}

export interface ProductAvailability {
  retailerId: string;
  status: StockStatus;
  productVerified: boolean;
  price?: number;
  currency?: string;
  seller?: string;
  fulfillment?: string;
  productUrl: string;
  checkedAt: string;
  evidence: EvidenceSource[];
  httpStatus?: number;
  durationMs?: number;
  errorMessage?: string;
  retryAfterSeconds?: number;
}

export interface PersistedRetailerState {
  retailerId: string;
  retailerName: string;
  productUrl: string;
  status: StockStatus;
  price?: number;
  currency?: string;
  seller?: string;
  lastSuccessfulCheckAt?: string;
  lastAttemptedCheckAt?: string;
  lastStateChangeAt?: string;
  lastHttpStatus?: number;
  consecutiveFailures: number;
  initialized: boolean;
}
