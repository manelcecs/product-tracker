import 'dotenv/config';

export interface AppConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  checkIntervalMinMs: number;
  checkIntervalMaxMs: number;
  dataDir: string;
  significantPriceChangePercent: number;
}

export function loadAppConfig(): AppConfig {
  const minSeconds = Number(process.env.CHECK_INTERVAL_MIN_SECONDS ?? 60);
  const maxSeconds = Number(process.env.CHECK_INTERVAL_MAX_SECONDS ?? 80);

  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: process.env.TELEGRAM_CHAT_ID || undefined,
    checkIntervalMinMs: minSeconds * 1000,
    checkIntervalMaxMs: Math.max(maxSeconds, minSeconds) * 1000,
    dataDir: process.env.DATA_DIR ?? './data',
    significantPriceChangePercent: Number(process.env.SIGNIFICANT_PRICE_CHANGE_PERCENT ?? 5),
  };
}
