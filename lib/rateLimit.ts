/**
 * In-memory sliding-window rate limiter.
 *
 * Each instance tracks request counts per key (typically an IP address).
 * Expired entries are pruned automatically on every check.
 *
 * ⚠️  This is per-process. If you scale to multiple instances behind a
 *     load balancer, replace this with a Redis-backed implementation.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number; // Unix ms when the window resets
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  // Prune expired entries every 60 seconds to prevent memory leaks
  const CLEANUP_INTERVAL_MS = 60_000;
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    const entry = store.get(key);

    // First request or window has expired — start a new window
    if (!entry || now >= entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetInSeconds: Math.ceil(windowMs / 1000),
      };
    }

    // Within the current window
    entry.count += 1;

    if (entry.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.ceil((entry.resetTime - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetInSeconds: Math.ceil((entry.resetTime - now) / 1000),
    };
  };
}

/**
 * Extract client IP from a request.
 * Checks common proxy headers, falls back to 'unknown'.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first is the client
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Build a standard 429 JSON response with Retry-After header.
 */
export function rateLimitResponse(resetInSeconds: number) {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(resetInSeconds),
      },
    }
  );
}
