const EXPONENTIAL_BACKOFF_MS = [60_000, 120_000, 240_000, 480_000, 960_000];

/**
 * Backoff delay for the next check after a failed/rate-limited attempt.
 * Honors Retry-After when the server provided one; otherwise escalates
 * through a capped exponential sequence keyed by consecutive failures.
 */
export function computeBackoffDelayMs(consecutiveFailures: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  const index = Math.min(Math.max(consecutiveFailures - 1, 0), EXPONENTIAL_BACKOFF_MS.length - 1);
  return EXPONENTIAL_BACKOFF_MS[index];
}
