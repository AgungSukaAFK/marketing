import "server-only";
import { headers } from "next/headers";

/**
 * Rate limit sederhana in-memory (per instance) untuk aksi auth.
 * Untuk deploy multi-instance (Vercel), ganti dengan store bersama (mis. Upstash Redis).
 */
const buckets = new Map<string, { count: number; reset: number }>();

async function keyFor(scope: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}

function current(key: string) {
  const b = buckets.get(key);
  return b && b.reset > Date.now() ? b : null;
}

/** Sudah melewati batas? (tidak menambah hitungan) */
export async function isLimited(scope: string, limit: number) {
  return (current(await keyFor(scope))?.count ?? 0) >= limit;
}

/** Catat satu percobaan. */
export async function hit(scope: string, windowMs = 5 * 60_000) {
  const key = await keyFor(scope);
  const b = current(key);
  if (b) b.count++;
  else buckets.set(key, { count: 1, reset: Date.now() + windowMs });
}

/** Cek + catat sekaligus (untuk aksi yang selalu dihitung, mis. register). */
export async function rateLimit(scope: string, limit = 10, windowMs = 5 * 60_000): Promise<boolean> {
  if (await isLimited(scope, limit)) return false;
  await hit(scope, windowMs);
  return true;
}
