// shortcut: hitungan di memori per instance serverless (batas efektif bisa lebih longgar di Vercel); pindah ke Upstash/tabel DB kalau ada penyalahgunaan nyata
const hits = new Map<string, { count: number; resetAt: number }>();

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { ok: boolean; retryAfterSec: number } {
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  return {
    ok: entry.count <= limit,
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}
