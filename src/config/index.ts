import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  CHECK_INTERVAL_MIN_SECONDS: z.coerce.number().default(60),
  CHECK_INTERVAL_MAX_SECONDS: z.coerce.number().default(80),
  DATA_DIR: z.string().default('./data'),
  SIGNIFICANT_PRICE_CHANGE_PERCENT: z.coerce.number().default(5),
});

export interface AppConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  checkIntervalMinMs: number;
  checkIntervalMaxMs: number;
  dataDir: string;
  significantPriceChangePercent: number;
}

export function loadAppConfig(): AppConfig {
  const env = envSchema.parse(process.env);
  const minSeconds = env.CHECK_INTERVAL_MIN_SECONDS;
  const maxSeconds = env.CHECK_INTERVAL_MAX_SECONDS;

  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: env.TELEGRAM_CHAT_ID || undefined,
    checkIntervalMinMs: minSeconds * 1000,
    checkIntervalMaxMs: Math.max(maxSeconds, minSeconds) * 1000,
    dataDir: env.DATA_DIR,
    significantPriceChangePercent: env.SIGNIFICANT_PRICE_CHANGE_PERCENT,
  };
}
