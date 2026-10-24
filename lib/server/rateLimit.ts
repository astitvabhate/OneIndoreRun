import { hitRateLimit } from './db';

/** The visitor's IP address as reported by the host (Vercel sets x-forwarded-for). */
export const clientIp = (headers: Headers) =>
  headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';

/**
 * True if this request is within every limit. Limits are shared by all server instances (they
 * live in the database). If the check itself fails, the request is let through: a hiccup in
 * the limiter should never block real runners.
 *
 * Keep IP limits generous: mobile networks in India put many people behind one IP address.
 */
export async function withinLimits(limits: { key: string; max: number; windowSeconds: number }[]) {
  try {
    const results = await Promise.all(limits.map(({ key, max, windowSeconds }) => hitRateLimit(key, max, windowSeconds)));
    return results.every(Boolean);
  } catch (error) {
    console.error('Rate limit check failed; allowing the request', error);
    return true;
  }
}
