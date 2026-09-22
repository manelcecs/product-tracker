# AGENTS.md

Instructions for AI coding agents working in this repository.

## Non-negotiable boundaries

- This project **never** automates purchase, checkout, authentication, CAPTCHA solving, or payment flows. Do not add code that fills carts, logs into retailer accounts, or bypasses anti-bot protections.
- Adapters only read publicly served HTML/JSON of product pages. No headless-browser automation of checkout, no credential storage for retailers.
- When product identity or availability cannot be confidently verified, adapters must return `UNKNOWN` — never guess `AVAILABLE`.
- Never log `TELEGRAM_BOT_TOKEN`, chat IDs, or any other secret.

## Architecture

- `src/domain` — pure types and matching/transition logic, no I/O (`stock-status.ts`, `product.ts`, `retailer.ts`, `transitions.ts`).
- `src/adapters` — one file per retailer implementing `RetailerAdapter` (`src/adapters/base.ts`). Each adapter exposes:
  - `check()` — performs the live HTTP GET and delegates to `parse()`.
  - `parse(html, httpStatus, durationMs?, retryAfterSeconds?)` — pure, synchronous, and what tests call directly with fixture HTML. Never make network calls from `parse()`.
- `src/config` — env-driven configuration for the product identity (`product.ts`) and retailer list (`retailers.ts`).
- `src/http/client.ts` — shared `httpGet` wrapper (timeout, realistic UA/Accept-Language headers, Retry-After parsing). No asset downloads, no proxy rotation for evasion.
- `src/notifications` — Telegram client (`telegram.ts`) and message formatting (`messages.ts`).
- `src/persistence/store.ts` — atomic JSON state store (survives restarts, no native/SQLite dependency).
- `src/scheduler` — `monitor.ts` runs one check + persists + decides notifications; `scheduler.ts` handles independent per-retailer timers with jitter/stagger/backoff.

## Adding a retailer

1. Add a `RetailerConfig` entry in `src/config/retailers.ts` (id, name, default `productUrl`, `enabled` flag driven by an env var).
2. Implement `src/adapters/<id>.ts` extending `RetailerAdapter`. Prefer structured data (JSON-LD `schema.org/Product`, microdata) over generic text/button matching. Verify product identity via EAN/MPN or exact required-keyword matching (`src/domain/product.ts#isProductMatch`), and return `UNKNOWN` whenever identity can't be confirmed. Map HTTP 403 → `BLOCKED`, 404 → `PRODUCT_REMOVED`, 429 → `ERROR` with `retryAfterSeconds` set, 5xx → `ERROR`.
3. Register the adapter constructor in `src/adapters/registry.ts`.
4. Add fixture HTML files under `test/fixtures/<id>/` covering at minimum: correct product available, correct product unavailable/preorder, wrong product/accessory, malformed HTML, HTTP 403, HTTP 429.
5. Add `test/adapters/<id>.test.ts` exercising `parse()` against those fixtures — no live network calls in tests.

## Testing

- `bun run test` runs Vitest against fixtures only (use `bun run test`, not `bun test` — the latter invokes Bun's own built-in test runner instead of the `test` script). No test should perform a real HTTP request.
- Bias every ambiguous parsing result toward `UNKNOWN` rather than risking a false positive `AVAILABLE`.

## Development workflow

- Follow trunk-based development: keep branches short-lived and integrate into the main branch frequently after validation.
- Use squash merges for pull requests so the main branch history stays linear and each merged change reads as one reviewed unit.
- Keep local commits atomic. Each commit should have a closed scope, pass the relevant checks for that scope, and avoid mixing unrelated adapter, scheduler, documentation, or infrastructure changes.
- Do not auto-commit, push, merge, publish, or deploy unless the user explicitly asks for that action.

## Do not

- Do not add anti-bot bypass (proxy rotation for evasion, CAPTCHA solvers, browser fingerprint spoofing, residential proxy pools).
- Do not commit `.env`, tokens, or the `data/` runtime state (already gitignored except `data/.gitkeep`).
- Do not silently rewrite `bun.lock` via `bun install` without flagging the diff for review.
- Do not remove the "bias toward UNKNOWN" behavior when refactoring adapters, even for the sake of DRY-ing up code.
