import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramNotifier } from '../../src/notifications/telegram';

describe('TelegramNotifier', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('skips sending when bot token/chat id are not configured', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const notifier = new TelegramNotifier({});
    await notifier.send('hello');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a message when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const notifier = new TelegramNotifier({ botToken: 'token', chatId: '123' });
    await notifier.send('hello');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/bottoken/sendMessage');
  });

  it('dedupes repeated sends with the same key within the dedupe window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const notifier = new TelegramNotifier({ botToken: 'token', chatId: '123' });
    await notifier.send('hello', 'key-1');
    await notifier.send('hello again', 'key-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on failure up to the attempt limit without throwing', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const notifier = new TelegramNotifier({ botToken: 'token', chatId: '123' });

    const sendPromise = notifier.send('hello');
    await vi.runAllTimersAsync();
    await sendPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
