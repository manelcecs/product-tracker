import { logger } from '../utils/logger';

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

/** Minimal Telegram Bot API client with basic retry and dedupe by key. */
export class TelegramNotifier {
  private static readonly DEDUPE_WINDOW_MS = 60_000;
  private static readonly SEND_ATTEMPTS = 3;

  private readonly recentlySent = new Map<string, number>();

  constructor(private readonly config: TelegramConfig) {}

  get isConfigured(): boolean {
    return Boolean(this.config.botToken && this.config.chatId);
  }

  async send(message: string, dedupeKey?: string): Promise<void> {
    if (!this.isConfigured) {
      logger.warn('Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing); skipping notification');
      return;
    }

    if (dedupeKey) {
      const lastSentAt = this.recentlySent.get(dedupeKey);
      if (lastSentAt && Date.now() - lastSentAt < TelegramNotifier.DEDUPE_WINDOW_MS) {
        return;
      }
    }

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

    for (let attempt = 1; attempt <= TelegramNotifier.SEND_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.config.chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
        });
        if (response.ok) {
          if (dedupeKey) this.recentlySent.set(dedupeKey, Date.now());
          return;
        }
        logger.warn({ status: response.status }, 'Telegram API returned a non-OK status');
      } catch (error) {
        logger.warn({ err: (error as Error).message, attempt }, 'Telegram send failed');
      }
      if (attempt < TelegramNotifier.SEND_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    logger.error('Telegram notification failed after retries; monitoring continues');
  }
}
