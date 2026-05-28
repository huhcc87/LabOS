/**
 * Simple in-memory rate limiter for Convex actions.
 * Tracks attempts per key (IP/email) with a sliding window.
 * In production, use Convex's built-in rate limiting or a dedicated service.
 */

const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 10; // max per window

export function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new Error(`Too many requests. Try again in ${retryAfter} seconds.`);
  }
}

// Cleanup stale entries periodically (runs on import, every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt < now) attempts.delete(key);
  }
}, 5 * 60 * 1000);
