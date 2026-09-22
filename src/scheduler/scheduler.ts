import { RetailerAdapter } from '../adapters/base';
import { RetailerConfig } from '../domain/retailer';
import { JsonStateStore } from '../persistence/store';
import { TelegramNotifier } from '../notifications/telegram';
import { runRetailerCheck } from './monitor';
import { randomIntervalMs } from '../utils/jitter';
import { computeBackoffDelayMs } from '../utils/backoff';
import { logger } from '../utils/logger';

export interface SchedulerOptions {
  adapters: RetailerAdapter[];
  retailerConfigs: RetailerConfig[];
  store: JsonStateStore;
  notifier: TelegramNotifier;
  defaultIntervalMinMs: number;
  defaultIntervalMaxMs: number;
  significantPriceChangePercent: number;
  staggerMaxMs?: number;
}

/** Independent per-retailer scheduling loop with jitter, staggered starts, and failure backoff. */
export class RetailerScheduler {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private stopped = false;

  constructor(private readonly options: SchedulerOptions) {}

  start(): void {
    const stagger = this.options.staggerMaxMs ?? 15_000;
    this.options.adapters.forEach((adapter, index) => {
      const initialDelay =
        this.options.adapters.length > 1 ? Math.floor((stagger / this.options.adapters.length) * index) : 0;
      const timer = setTimeout(() => void this.runAndSchedule(adapter), initialDelay);
      this.timers.set(adapter.id, timer);
    });
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private async runAndSchedule(adapter: RetailerAdapter): Promise<void> {
    if (this.stopped) return;
    const retailerConfig = this.options.retailerConfigs.find((config) => config.id === adapter.id);
    const [minMs, maxMs] = this.resolveInterval(retailerConfig);

    let nextDelay = randomIntervalMs(minMs, maxMs);
    try {
      const { state, availability } = await runRetailerCheck({
        adapter,
        retailerName: retailerConfig?.name ?? adapter.name,
        store: this.options.store,
        notifier: this.options.notifier,
        significantPriceChangePercent: this.options.significantPriceChangePercent,
      });

      if (state.status === 'BLOCKED') {
        nextDelay = Math.max(nextDelay, computeBackoffDelayMs(3));
      } else if (state.consecutiveFailures > 0) {
        nextDelay = computeBackoffDelayMs(state.consecutiveFailures, availability.retryAfterSeconds);
      }
    } catch (error) {
      logger.error({ retailer: adapter.id, err: (error as Error).message }, 'unexpected error running retailer check');
    }

    if (this.stopped) return;
    logger.info({ retailer: adapter.id, nextCheckInMs: nextDelay }, 'scheduling next check');
    const timer = setTimeout(() => void this.runAndSchedule(adapter), nextDelay);
    this.timers.set(adapter.id, timer);
  }

  private resolveInterval(retailerConfig?: RetailerConfig): [number, number] {
    if (retailerConfig?.checkIntervalMsOverride) {
      return [retailerConfig.checkIntervalMsOverride.min, retailerConfig.checkIntervalMsOverride.max];
    }
    return [this.options.defaultIntervalMinMs, this.options.defaultIntervalMaxMs];
  }
}
