import { loadAppConfig } from './config';
import { loadProductIdentity } from './config/product';
import { loadRetailerConfigs } from './config/retailers';
import { buildAdapters } from './adapters/registry';
import { JsonStateStore } from './persistence/store';
import { TelegramNotifier } from './notifications/telegram';
import { RetailerScheduler } from './scheduler/scheduler';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  const appConfig = loadAppConfig();
  const product = loadProductIdentity();
  const retailerConfigs = loadRetailerConfigs();
  const enabledConfigs = retailerConfigs.filter((config) => config.enabled);

  if (enabledConfigs.length === 0) {
    logger.warn('No retailers enabled; check your .env configuration');
  }

  const adapters = buildAdapters(retailerConfigs, product);

  const store = new JsonStateStore(appConfig.dataDir);
  await store.load();

  const notifier = new TelegramNotifier({
    botToken: appConfig.telegramBotToken,
    chatId: appConfig.telegramChatId,
  });
  if (!notifier.isConfigured) {
    logger.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; notifications are disabled');
  }

  const scheduler = new RetailerScheduler({
    adapters,
    retailerConfigs,
    store,
    notifier,
    defaultIntervalMinMs: appConfig.checkIntervalMinMs,
    defaultIntervalMaxMs: appConfig.checkIntervalMaxMs,
    significantPriceChangePercent: appConfig.significantPriceChangePercent,
  });

  scheduler.start();
  logger.info(
    { retailers: adapters.map((adapter) => adapter.id), product: product.name },
    'stock monitor started',
  );

  const shutdown = (): void => {
    logger.info('shutting down');
    scheduler.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ err: (error as Error).message }, 'fatal error during startup');
  process.exit(1);
});
