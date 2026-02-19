interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, RateLimitEntry>();

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, entry] of attempts) {
    if (entry.firstAttempt < cutoff) attempts.delete(ip);
  }
}, WINDOW_MS);

export function checkRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    return { allowed: true };
  }

  return { allowed: entry.count < MAX_ATTEMPTS };
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}
