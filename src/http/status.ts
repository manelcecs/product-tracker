import { StatusCodes } from 'http-status-codes';
import { ProductAvailability } from '../domain/retailer';

export interface HttpStatusClassification {
  status: ProductAvailability['status'];
  errorMessage?: string;
  retryAfterSeconds?: number;
}

/**
 * Maps well-known non-2xx HTTP responses to a stock status classification.
 * Returns undefined for statuses that require page-content inspection
 * (e.g. a 200 CAPTCHA/challenge page).
 */
export function classifyHttpStatus(
  httpStatus: number,
  retryAfterSeconds?: number,
): HttpStatusClassification | undefined {
  if (httpStatus === StatusCodes.TOO_MANY_REQUESTS) {
    return { status: 'ERROR', errorMessage: `rate limited (${httpStatus})`, retryAfterSeconds };
  }
  if (httpStatus === StatusCodes.FORBIDDEN) {
    return { status: 'BLOCKED', errorMessage: `forbidden (${httpStatus})` };
  }
  if (httpStatus === StatusCodes.NOT_FOUND) {
    return { status: 'PRODUCT_REMOVED' };
  }
  if (httpStatus >= StatusCodes.INTERNAL_SERVER_ERROR) {
    return { status: 'ERROR', errorMessage: `server error (${httpStatus})` };
  }
  return undefined;
}
