const CHALLENGE_MARKERS = [
  'captcha',
  'cloudflare',
  'cf-challenge',
  'cf-browser-verification',
  'robot check',
  'are you a robot',
  'automated access',
  'access denied',
  'verify you are human',
  'unusual traffic',
];

export function isChallengePage(html: string): boolean {
  const normalized = html.toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => normalized.includes(marker));
}
