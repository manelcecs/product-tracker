import { describe, expect, it } from 'vitest';
import { isChallengePage } from '../../src/utils/challenge';
import { loadFixture } from '../helpers/fixtures';

describe('isChallengePage', () => {
  it('detects a Cloudflare-style "Just a moment..." interstitial', () => {
    expect(isChallengePage(loadFixture('mediamarkt/challenge.html'))).toBe(true);
  });

  it('detects an "Access denied / are you a robot" interstitial (Fnac)', () => {
    expect(isChallengePage(loadFixture('challenge/access-denied-robot-fnac.html'))).toBe(true);
  });

  it('detects an "Access denied / are you a robot" interstitial (El Corte Inglés)', () => {
    expect(isChallengePage(loadFixture('challenge/access-denied-robot-elcorteingles.html'))).toBe(true);
  });

  it('detects an Amazon CAPTCHA form page', () => {
    expect(isChallengePage(loadFixture('amazon/captcha.html'))).toBe(true);
  });

  it('does NOT flag a real MediaMarkt product page whose app-config JSON embeds reCAPTCHA/Turnstile site keys', () => {
    expect(isChallengePage(loadFixture('mediamarkt/app-config-recaptcha-turnstile.html'))).toBe(false);
  });

  it('detects an "Access Denied" page from visible body text alone, even with a generic <title>', () => {
    expect(isChallengePage(loadFixture('challenge/generic-title-access-denied-body.html'))).toBe(true);
  });

  it('detects a "Robot Check" page from visible body text alone, even with a generic <title>', () => {
    expect(isChallengePage(loadFixture('challenge/generic-title-robot-check-body.html'))).toBe(true);
  });

  it('does NOT flag a plain product page with no challenge markers', () => {
    expect(isChallengePage(loadFixture('mediamarkt/available.html'))).toBe(false);
  });

  it('does NOT flag a page merely mentioning "captcha" inside inline script/JSON, only outside it', () => {
    const html = `<!DOCTYPE html><html><head><title>Product</title>
      <script>window.config = {"captchaSiteKey": "abc123", "cloudflare": {"turnstile": "xyz"}};</script>
    </head><body><h1>Real product</h1></body></html>`;
    expect(isChallengePage(html)).toBe(false);
  });
});
