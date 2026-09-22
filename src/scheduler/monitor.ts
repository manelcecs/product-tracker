import { RetailerAdapter } from '../adapters/base';
import { JsonStateStore } from '../persistence/store';
import { TelegramNotifier } from '../notifications/telegram';
import { formatInitMessage, formatPriceChangeMessage, formatTransitionMessage } from '../notifications/messages';
import { shouldNotifyPriceChange, shouldNotifyStatusChange } from '../domain/transitions';
import { logger } from '../utils/logger';
import { PersistedRetailerState, ProductAvailability } from '../domain/retailer';

export interface MonitorRetailerParams {
  adapter: RetailerAdapter;
  retailerName: string;
  store: JsonStateStore;
  notifier: TelegramNotifier;
  significantPriceChangePercent: number;
}

export interface MonitorRetailerResult {
  state: PersistedRetailerState;
  availability: ProductAvailability;
}

/** Runs one check for a retailer, persists the result, and sends notifications for meaningful changes. */
export async function runRetailerCheck(params: MonitorRetailerParams): Promise<MonitorRetailerResult> {
  const { adapter, retailerName, store, notifier, significantPriceChangePercent } = params;
  const previous = store.get(adapter.id);
  const availability = await adapter.check();

  const isError = availability.status === 'ERROR';
  const consecutiveFailures = isError ? (previous?.consecutiveFailures ?? 0) + 1 : 0;
  // Errors don't overwrite the last known real status; they're transient by definition.
  const effectiveStatus = isError && previous ? previous.status : availability.status;
  const stateChanged = !previous || previous.status !== effectiveStatus;

  const nextState: PersistedRetailerState = {
    retailerId: adapter.id,
    retailerName,
    productUrl: availability.productUrl,
    status: effectiveStatus,
    price: availability.price ?? previous?.price,
    currency: availability.currency ?? previous?.currency,
    seller: availability.seller ?? previous?.seller,
    lastSuccessfulCheckAt: isError ? previous?.lastSuccessfulCheckAt : availability.checkedAt,
    lastAttemptedCheckAt: availability.checkedAt,
    lastStateChangeAt: stateChanged ? availability.checkedAt : previous?.lastStateChangeAt,
    lastHttpStatus: availability.httpStatus ?? previous?.lastHttpStatus,
    consecutiveFailures,
    initialized: true,
  };

  logger.info(
    {
      retailer: adapter.id,
      status: availability.status,
      previousStatus: previous?.status,
      httpStatus: availability.httpStatus,
      durationMs: availability.durationMs,
      price: availability.price,
      consecutiveFailures,
    },
    'retailer check completed',
  );

  if (!previous || !previous.initialized) {
    await notifier.send(formatInitMessage(retailerName, availability), `init:${adapter.id}`);
  } else if (!isError) {
    if (shouldNotifyStatusChange(previous.status, availability.status)) {
      await notifier.send(
        formatTransitionMessage(retailerName, previous.status, availability),
        `transition:${adapter.id}:${previous.status}->${availability.status}:${availability.checkedAt}`,
      );
    } else if (
      shouldNotifyPriceChange(
        previous.price,
        previous.status,
        availability.price,
        availability.status,
        significantPriceChangePercent,
      )
    ) {
      await notifier.send(
        formatPriceChangeMessage(retailerName, previous.price as number, availability),
        `price:${adapter.id}:${availability.price}:${availability.checkedAt}`,
      );
    }
  }

  await store.set(nextState);
  return { state: nextState, availability };
}
