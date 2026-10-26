import "server-only";
import { headers } from "next/headers";

/** Nilai header aman untuk fetch (karakter non-ASCII / kontrol ditolak undici). */
const headerSafe = (v: string | null | undefined, max: number) => (v ?? "").replace(/[^\x20-\x7e]/g, "").slice(0, max);

/** IP klien di balik reverse proxy ("" bila tidak diketahui). */
export function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
}

/**
 * Konteks request untuk Activity History: id request (dibuat proxy.ts, sama
 * untuk semua query dalam satu aksi), IP, dan perangkat pengguna.
 */
export async function requestContext() {
  const h = await headers();
  return {
    requestId: headerSafe(h.get("x-activity-request"), 64) || crypto.randomUUID(),
    ip: headerSafe(clientIp(h), 64),
    userAgent: headerSafe(h.get("user-agent"), 500),
  };
}

/**
 * Header ke Supabase supaya trigger activity_capture tahu konteks request.
 * `actorId` untuk client service role (tidak membawa JWT user); DB hanya
 * memercayainya dari service role.
 */
export async function activityHeaders(actorId?: string): Promise<Record<string, string>> {
  const c = await requestContext();
  return {
    "x-activity-request": c.requestId,
    ...(c.ip && { "x-activity-ip": c.ip }),
    ...(c.userAgent && { "x-activity-ua": c.userAgent }),
    ...(actorId && { "x-activity-actor": actorId }),
  };
}
