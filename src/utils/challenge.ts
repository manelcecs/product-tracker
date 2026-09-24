import * as cheerio from 'cheerio';

/**
 * Title text that reliably indicates a challenge/interstitial page rather
 * than real content, regardless of retailer.
 */
const CHALLENGE_TITLE_PATTERNS = [
  /just a moment/i,
  /attention required/i,
  /robot check/i,
  /access denied/i,
  /pardon our interruption/i,
];

/**
 * DOM markers used by known anti-bot vendors. These only ever appear on an
 * actual challenge page, never inside a normal product page's app-config
 * JSON (unlike bare substrings like "captcha" or "cloudflare").
 */
const CHALLENGE_DOM_SELECTORS = [
  '.cf-browser-verification',
  '#cf-wrapper',
  '[class*="cf-challenge"]',
  '#challenge-running',
  '[class*="challenge-platform"]',
  // Amazon's CAPTCHA verification form.
  'form[action*="validateCaptcha"]',
  '#captchacharacters',
];

const CHALLENGE_SCRIPT_SRC_MARKERS = ['captcha-delivery.com'];

/** Checked against visible body text only, after stripping script/style/noscript. */
const CHALLENGE_BODY_TEXT_MARKERS = [
  'verify you are human',
  'are you a robot',
  'unusual traffic',
  'automated access',
  'enter the characters you see below',
  'please complete the captcha',
  'complete the captcha to continue',
  'access denied',
  'robot check',
  "you don't have permission to access",
  'you do not have permission to access',
];

/**
 * Detects real anti-bot challenge/interstitial pages. Deliberately avoids
 * plain substring matching over the entire raw HTML (e.g. "captcha",
 * "cloudflare"), since retailer app-config JSON blobs routinely embed
 * unrelated third-party site keys (reCAPTCHA, Turnstile) on legitimate 200
 * product pages. Detection instead relies on the page <title>, known
 * challenge-vendor DOM markers, and specific phrases in visible body text.
 */
export function isChallengePage(html: string): boolean {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim();
  if (CHALLENGE_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return true;

  if (CHALLENGE_DOM_SELECTORS.some((selector) => $(selector).length > 0)) return true;

  if (
    CHALLENGE_SCRIPT_SRC_MARKERS.some((marker) => $(`script[src*="${marker}"]`).length > 0)
  ) {
    return true;
  }

  $('script, style, noscript').remove();
  const bodyText = $('body').text().toLowerCase().replace(/\s+/g, ' ');
  return CHALLENGE_BODY_TEXT_MARKERS.some((marker) => bodyText.includes(marker));
}
