# product-tracker

Self-hosted stock/price monitor for a configurable retail product. Ships configured by default for **Nintendo Switch 2 — The Legend of Zelda 40th Anniversary Edition** (EAN 0045496337292, Nintendo MPN 10019448, release date 2026-10-29), but the product identity and retailer list are fully driven by environment variables — nothing is hard-coded to Zelda.

Sends Telegram notifications when a tracked retailer's page transitions between stock states (e.g. `OUT_OF_STOCK` → `PREORDER` → `AVAILABLE`), and never performs any purchase, checkout, authentication, CAPTCHA-solving, or payment action. It only reads publicly served product pages.

## Stock states

| Status            | Meaning                                                              |
|-------------------|-----------------------------------------------------------------------|
| `AVAILABLE`       | Verified product, in stock, buyable now.                             |
| `PREORDER`        | Verified product, reservable ahead of release.                       |
| `OUT_OF_STOCK`     | Verified product, currently sold out.                                 |
| `COMING_SOON`     | Verified product, listed but not yet orderable.                      |
| `PRODUCT_REMOVED` | The page returned HTTP 404 (listing gone).                           |
| `BLOCKED`         | Retailer returned HTTP 403 or a CAPTCHA/anti-bot challenge page.     |
| `UNKNOWN`         | Product identity or availability could not be confidently determined. Default whenever parsing is ambiguous — **never** reported as a false `AVAILABLE`. |
| `ERROR`           | Transient failure (network error, HTTP 429, 5xx). Previous known status is preserved in persisted state until a successful check updates it. |

## Verified retailer coverage (as of this V1)

| Retailer      | Coverage                                                                                   |
|---------------|-----------------------------------------------------------------------------------------------|
| MediaMarkt ES | Known product URL/ID provided by the user (`1674231`). Adapter parses JSON-LD `schema.org/Product`. **Not live-verified against the real page in this session** — verify the JSON-LD shape against the live page before relying on it. |
| Fnac ES       | Known product URL/slug provided by the user (`a13481099`). Adapter tries JSON-LD first, falls back to schema.org microdata. **Not live-verified** — confirm which structured-data format Fnac actually serves before relying on it. |
| Amazon ES     | Structural adapter template only, **disabled by default**. No verified ASIN for this exact bundle was available at implementation time. TODO: research the correct ASIN, set `AMAZON_ES_ASIN` and `AMAZON_ES_ENABLED=true` in `.env`, and validate the adapter's DOM selectors (`#productTitle`, `#availability`, `.a-price`) against the real page before trusting it. |
| El Corte Inglés ES | Structured-data adapter (JSON-LD first, microdata fallback), **disabled by default**. No verified direct product page for this exact bundle was found at implementation time — only a category page (`elcorteingles.pt/gaming/nintendo/nintendo-switch-2/`) listing an unrelated accessory (a 40th Anniversary case/screen protector bundle, not the console) was located. TODO: research the correct direct product URL, set `ELCORTEINGLES_ES_URL` and `ELCORTEINGLES_ES_ENABLED=true` in `.env`. **Do not** configure a category or accessory page as the product URL — the adapter's EAN/MPN/keyword matching will correctly reject it as `UNKNOWN`, but it wastes a check cycle and risks confusion. |

**TODO before broad rollout:** re-verify the EAN/MPN and each retailer's current page structure close to the product's actual release window (2026-10-29), since retailer markup and structured data change over time.

## Non-goals / safety boundaries

- No cart automation, login, CAPTCHA solving, or checkout of any kind.
- No anti-bot evasion (no proxy rotation for evasion, no browser fingerprint spoofing, no CAPTCHA solvers).
- Adapters bias toward `UNKNOWN` over a false `AVAILABLE` whenever product identity or availability can't be confidently determined.

## Architecture

```
src/
  domain/          stock-status.ts, product.ts, retailer.ts, transitions.ts — pure types & logic
  adapters/         base.ts (RetailerAdapter interface) + one file per retailer + registry.ts
  config/            index.ts (app config), product.ts (product identity), retailers.ts (retailer list) — env validated with Zod schemas
  http/client.ts     shared fetch wrapper: realistic UA, Accept-Language, timeout, Retry-After parsing
  http/status.ts     classifyHttpStatus() — HTTP status classification using http-status-codes StatusCodes constants
  notifications/    telegram.ts (client), messages.ts (message formatting)
  persistence/       store.ts — atomic JSON state store
  scheduler/         monitor.ts (single check + notify), scheduler.ts (per-retailer timers/jitter/backoff)
  utils/             logger.ts, backoff.ts, jitter.ts, price.ts, json-ld.ts, microdata.ts
  index.ts           entrypoint
test/
  fixtures/<retailer>/   static HTML used by adapter tests (no live network)
  adapters/, domain/, utils/, persistence/, notifications/, scheduler/
```

See `AGENTS.md` for the contract each adapter must follow and instructions for adding a new retailer.

## Telegram bot setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and follow the prompts. You'll receive a bot token like `123456789:AA...` — this is `TELEGRAM_BOT_TOKEN`.
2. Start a chat with your new bot (or add it to a group) and send it any message.
3. Get your chat ID: visit `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser after sending the bot a message, and read `message.chat.id` from the JSON response. This is `TELEGRAM_CHAT_ID`.
4. Put both values in `.env`. If they're missing, the monitor still runs and logs a warning — it just won't send notifications.

## Local development

Requires [Bun](https://bun.sh) 1.2+.

```bash
cp .env.example .env
# edit .env: at minimum set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID if you want notifications
bun install
bun run dev        # bun --watch, runs src/index.ts directly
bun run test       # vitest, fixture-based, no live network — use "bun run test", not "bun test" (Bun's own runner)
bun run typecheck  # tsc --noEmit
bun run build      # compiles to dist/
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f
```

State is persisted under `./data` on the host (`state.json`), mounted into the container at `/app/data`, so it survives container restarts/recreation.

## CasaOS

1. Copy this repository (or just `docker-compose.yml`, `Dockerfile`, `src/`, `package.json`, `bun.lock`, `tsconfig.json`) to your CasaOS host.
2. Create `.env` from `.env.example` and fill in your Telegram credentials.
3. In CasaOS, use "Install a customized app" / compose import and point it at this `docker-compose.yml`, or run `docker compose up -d --build` over SSH in the project directory.
4. Confirm the `./data` bind mount resolves to a persistent path on the CasaOS host so state survives app updates/reboots.

## Adding a retailer

See the "Adding a retailer" section in `AGENTS.md`. Summary: add a `RetailerConfig` in `src/config/retailers.ts`, implement `src/adapters/<id>.ts` with a pure `parse()` method, register it in `src/adapters/registry.ts`, and add fixtures + tests under `test/`.

## Development workflow

This repository follows trunk-based development. Keep branches short-lived, keep commits atomic with one closed scope per commit, and squash merge reviewed pull requests into the main branch so history stays linear and easy to audit.

## Debugging an adapter

- Set `LOG_LEVEL=debug` and `LOG_PRETTY=true` in `.env` for readable structured logs (retailer, status, previous status, HTTP status, duration, price, consecutive failures, next scheduled check).
- To debug parsing logic without hitting the network, save a copy of the retailer's page HTML into `test/fixtures/<id>/` and write/run a quick Vitest case calling the adapter's `parse()` method directly with that HTML and the observed HTTP status.
- `evidence` on every `ProductAvailability` result records exactly which structured-data source (`json-ld:name`, `microdata:availability`, `dom:#availability`, ...) drove the verdict — log or inspect it when a result looks wrong.
- A `BLOCKED` result usually means the retailer served a CAPTCHA/Cloudflare-style challenge page (403 or detected anti-bot markers) — this is expected behavior, not a bug to "fix" by evading the block.

## Configuration reference

See `.env.example` for the full list with defaults and comments: Telegram credentials, scheduling window (`CHECK_INTERVAL_MIN_SECONDS`/`MAX_SECONDS`, default 60–80s with jitter), `SIGNIFICANT_PRICE_CHANGE_PERCENT`, `DATA_DIR`, logging, product identity (`PRODUCT_NAME`, `PRODUCT_EAN`, `PRODUCT_MPN`, `PRODUCT_RELEASE_DATE`, `PRODUCT_REQUIRED_KEYWORDS`, `PRODUCT_EXCLUDED_KEYWORDS`), and per-retailer URL/enabled flags.

## Notification behavior

- **Initialization**: the first time a retailer has no persisted state, one Telegram message is sent with its status, price (if known), URL, and timestamp — regardless of what that initial status is.
- **After initialization**: notifications are sent only for meaningful status transitions (anything involving `AVAILABLE`, `PREORDER`, `OUT_OF_STOCK`, `COMING_SOON`, `PRODUCT_REMOVED`, or `BLOCKED`). Flapping between `ERROR`/`UNKNOWN` is silenced.
- **Price changes**: only notified when the status is unchanged and purchasable (`AVAILABLE`/`PREORDER`), and the relative change exceeds `SIGNIFICANT_PRICE_CHANGE_PERCENT`. Price-only changes while unavailable never notify.
- Telegram failures are retried (up to 3 attempts with backoff) and deduped by key for 60s, but never stop the monitoring loop.

## Scheduling & resilience

- Each retailer runs on its own independent timer with a random delay inside `[CHECK_INTERVAL_MIN_SECONDS, CHECK_INTERVAL_MAX_SECONDS]` (default 60–80s), plus a staggered initial start so retailers don't all fire at once.
- HTTP 429: backs off using `Retry-After` if the server provided it; otherwise escalates through a capped exponential sequence (60s → 120s → 240s → 480s → 960s) keyed by consecutive failures.
- HTTP 403 or a detected CAPTCHA/anti-bot page → `BLOCKED`, which also forces a reduced check frequency.
- Network errors / 5xx → `ERROR`; the previously known status is preserved in persisted state (an `ERROR` never overwrites `AVAILABLE`/`OUT_OF_STOCK`/etc. from the last successful check).
