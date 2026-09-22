export interface HttpFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: string;
  headers: Headers;
  durationMs: number;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export async function httpGet(url: string, options: HttpFetchOptions = {}): Promise<HttpResponse> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        ...options.headers,
      },
    });
    const body = await response.text();
    return {
      status: response.status,
      body,
      headers: response.headers,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parseRetryAfterSeconds(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds;
  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.round((dateMs - Date.now()) / 1000));
  }
  return undefined;
}
