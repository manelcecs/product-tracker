# product-tracker

A small self-hosted service that watches retailer product pages and sends you a **Telegram message when a product's stock status changes** — for example when it goes from `OUT_OF_STOCK` to `PREORDER` or `AVAILABLE`.

It ships configured for the **Nintendo Switch 2 — The Legend of Zelda 40th Anniversary Edition** (EAN `0045496337292`, MPN `10019448`) at Spanish retailers, but the product identity and retailer URLs are all set through environment variables. Nothing is hard-coded to that product.

> **It only watches. It never buys.** product-tracker reads publicly served product pages and nothing else: no carts, logins, checkout, payments, CAPTCHA solving, or anti-bot evasion. See [Safety boundaries](#safety-boundaries).

## Features

- **Per-retailer monitoring** on independent timers with random jitter and a staggered start, so requests never fire in lockstep.
- **Confident product matching**: identity is verified from structured data (JSON-LD `schema.org/Product`, EAN/MPN) or strict keyword rules. Anything ambiguous is reported as `UNKNOWN`, **never** as a false `AVAILABLE`.
- **Useful notifications only**: meaningful status transitions and significant price changes while buyable. Transient `ERROR`/`UNKNOWN` flapping is silenced.
- **Polite back-off**: honours `Retry-After` on HTTP 429, uses capped exponential back-off, and slows down when a retailer blocks it.
- **Survives restarts**: state is kept in an atomic JSON file with no database or native dependencies.
- **Fully offline test suite**: adapters are tested against saved HTML fixtures and never hit the network.

## Supported retailers

| Retailer      | How the product is read                                                                                                              | Default                                     |
|---------------|--------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
| MediaMarkt ES | JSON-LD `BuyAction` → `ProductGroup` offers. Add-on services (installation, insurance) are ignored so they can't fake "in stock".      | Enabled                                     |
| Amazon ES     | Identity verified by the model number (MPN) in the product details; price is read from the buy box only.                               | Opt-in: set `AMAZON_ES_ASIN` and `AMAZON_ES_ENABLED=true` |
| GAME ES       | JSON-LD `Product` with nested `AggregateOffer`s.                                                                                      | Enabled                                     |

Page structures were live-verified on 2026-09-24. Retailer markup changes over time, so re-check the adapters close to a product's release date.

**Not supported: Fnac ES and El Corte Inglés ES.** Both sit behind Akamai Bot Manager, which returns HTTP 403 to every automated client (even real headless Chrome). Getting past it would require anti-bot evasion, which this project won't do. For those stores, use their official alert channels instead.

## Quick start (Docker)

You need Docker with Compose, and optionally a Telegram bot (see [Telegram setup](#telegram-setup)).

```bash
git clone https://github.com/manelcecs/product-tracker.git
cd product-tracker
cp .env.example .env        # then fill in TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
docker compose up -d --build
docker compose logs -f
```

State is written to `./data/state.json` on the host (mounted at `/app/data` in the container), so it survives restarts and upgrades.

To stop it:

```bash
docker compose down
```

This works on any Docker host, including home-server platforms like CasaOS: import `docker-compose.yml` as a custom app, and make sure `./data` points to persistent storage.

## Telegram setup

1. Message [@BotFather](https://t.me/BotFather), send `/newbot`, and follow the prompts. The token it gives you (`123456789:AA...`) is `TELEGRAM_BOT_TOKEN`.
2. Open a chat with your new bot (or add it to a group) and send it any message.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `message.chat.id`. That's `TELEGRAM_CHAT_ID`.
4. Put both in `.env`.

Without these two values the monitor still runs and logs results. It just doesn't send notifications.

## Configuration

Everything is configured through environment variables. [`.env.example`](.env.example) is the full, commented reference; these are the main ones:

| Variable                              | Default            | Purpose                                                                 |
|---------------------------------------|--------------------|-------------------------------------------------------------------------|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | —               | Where notifications go.                                                  |
| `CHECK_INTERVAL_MIN_SECONDS` / `_MAX_SECONDS` | `60` / `80` | Random delay window between checks for each retailer.                    |
| `SIGNIFICANT_PRICE_CHANGE_PERCENT`    | `5`                | Minimum price change (%) that triggers a notification while buyable.    |
| `DATA_DIR`                            | `./data`           | Where `state.json` is stored.                                            |
| `LOG_LEVEL`, `LOG_PRETTY`             | `info`, `false`    | Structured logging (pino). Set `LOG_PRETTY=true` for readable local logs. |
| `PRODUCT_NAME`, `PRODUCT_EAN`, `PRODUCT_MPN`, `PRODUCT_RELEASE_DATE` | Zelda bundle | Identity of the product to track.                      |
| `PRODUCT_REQUIRED_KEYWORDS`           | `nintendo switch 2,zelda,40` | All must appear in the title when EAN/MPN aren't available.    |
| `PRODUCT_EXCLUDED_KEYWORDS`           | accessories list   | Any of these rules out a match (cases, controllers, amiibo…).            |
| `<RETAILER>_ENABLED`, `<RETAILER>_URL` (Amazon: `AMAZON_ES_ASIN`) | see above | Turn a retailer on or off and point it at the product page. |
| `<RETAILER>_CHECK_INTERVAL_MIN_SECONDS` / `_MAX_SECONDS` | global values | Per-retailer interval override.                        |

### Tracking a different product

Set the `PRODUCT_*` variables to the new product's identity, then point each retailer's `_URL` (or `AMAZON_ES_ASIN`) at its product page. Always set `PRODUCT_EAN`/`PRODUCT_MPN` when you know them, since they're the most reliable way to match a product. Keywords are the fallback.

## How it behaves

### Stock states

| Status            | Meaning                                                                                   |
|-------------------|-------------------------------------------------------------------------------------------|
| `AVAILABLE`       | Verified product, in stock, buyable now.                                                  |
| `PREORDER`        | Verified product, can be reserved before release.                                         |
| `OUT_OF_STOCK`    | Verified product, currently sold out.                                                     |
| `COMING_SOON`     | Verified product, listed but not yet orderable.                                           |
| `PRODUCT_REMOVED` | The page returned HTTP 404.                                                               |
| `BLOCKED`         | HTTP 403 or an anti-bot/CAPTCHA page. Checks slow down automatically.                    |
| `UNKNOWN`         | Identity or availability couldn't be confidently determined.                              |
| `ERROR`           | Network error, HTTP 429 or 5xx. The last known good status is kept.                       |

### Notifications

- **First run**: one message per retailer with its initial status, price, and link.
- **After that**: only for real transitions involving `AVAILABLE`, `PREORDER`, `OUT_OF_STOCK`, `COMING_SOON`, `PRODUCT_REMOVED`, or `BLOCKED`.
- **Price changes**: only while the status is unchanged and buyable (`AVAILABLE`/`PREORDER`), and only above `SIGNIFICANT_PRICE_CHANGE_PERCENT`.
- Telegram failures are retried up to 3 times and de-duplicated. A failure never stops monitoring.

### Rate limiting and errors

- **HTTP 429** backs off using `Retry-After` when given, otherwise 60s → 120s → 240s → 480s → 960s (capped).
- **HTTP 403 or a challenge page** results in `BLOCKED` and a slower check rate. This is expected, not something to "fix" by evading it.
- **Network errors and 5xx** result in `ERROR` and never overwrite the last successful status.

## Development

Requires [Bun](https://bun.sh) 1.2 or newer.

```bash
cp .env.example .env
bun install
bun run dev         # watch mode, runs src/index.ts directly
bun run test        # Vitest against saved HTML fixtures, no network
bun run typecheck   # tsc --noEmit
bun run build       # compile to dist/; `bun run start` runs it
```

Use `bun run test`, not `bun test`. The latter runs Bun's built-in test runner instead of Vitest.

### Project layout

```
src/
  domain/          pure types and matching/transition logic (no I/O)
  adapters/        one file per retailer + registry.ts
  config/          Zod-validated env config: app, product identity, retailers
  http/            shared HTTP client and status classification
  notifications/   Telegram client and message formatting
  persistence/     atomic JSON state store
  scheduler/       per-check monitor and per-retailer timers
  utils/           logging, back-off, jitter, price and JSON-LD parsing, challenge detection
test/
  fixtures/<retailer>/   saved HTML pages used by adapter tests
```

### Adding a retailer

Each retailer is an adapter with a pure `parse(html, httpStatus)` method that tests call directly with fixture HTML. In short:

1. Add a `RetailerConfig` in `src/config/retailers.ts`.
2. Implement `src/adapters/<id>.ts`, preferring structured data and returning `UNKNOWN` whenever identity can't be confirmed.
3. Register it in `src/adapters/registry.ts`.
4. Add fixtures (available, unavailable, wrong product, malformed, 403, 429) and a test file.

[`AGENTS.md`](AGENTS.md) has the full adapter contract.

### Debugging an adapter

- Run with `LOG_LEVEL=debug LOG_PRETTY=true` to see status, HTTP code, price, duration, and next check time for each retailer.
- Every result carries an `evidence` field recording which source (`json-ld:availability`, `dom:#availability`, …) drove the verdict.
- To reproduce a parsing problem offline, save the page HTML under `test/fixtures/<id>/` and write a Vitest case that calls `parse()` on it.

## Safety boundaries

These are deliberate design constraints, not missing features:

- No purchase, cart, checkout, login, or payment automation of any kind.
- No anti-bot evasion: no CAPTCHA solvers, proxy rotation, or browser fingerprint spoofing.
- Only publicly served product pages are read, at a modest, jittered rate.
- When in doubt, report `UNKNOWN`. A false "in stock" alert is worse than a missed one.

Please respect each retailer's terms of use and keep check intervals reasonable.

## License

[MIT](LICENSE)
