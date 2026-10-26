/** Reminder ulang tahun perusahaan customer (kolom customers.ultah, tipe date). */

export const ANNIVERSARY_DAYS_AHEAD = 10;

export type AnniversaryItem = {
  id: string;
  customer_code: string;
  pt: string;
  sales_id: string | null;
  /** "YYYY-MM-DD" ulang tahun berikutnya */
  date: string;
  /** 0 = hari ini */
  daysLeft: number;
  /** ulang tahun ke-berapa (null bila tahun berdiri ≥ tahun ini) */
  age: number | null;
};

/** Tanggal hari ini di WIB sebagai "YYYY-MM-DD" (server bisa berjalan di UTC). */
export function todayWIB(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

const pad = (n: number) => String(n).padStart(2, "0");
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/** 29 Feb di tahun non-kabisat dirayakan 28 Feb. */
function occurrence(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { y: year, m: month, d: Math.min(day, last) };
}

export function upcomingAnniversaries(
  customers: { id: string; customer_code: string; pt: string; sales_id: string | null; ultah: string | null }[],
  today = todayWIB(),
  daysAhead = ANNIVERSARY_DAYS_AHEAD,
): AnniversaryItem[] {
  const [ty, tm, td] = today.split("-").map(Number);
  const t0 = utc(ty, tm, td);
  const out: AnniversaryItem[] = [];
  for (const c of customers) {
    const [by, bm, bd] = (c.ultah ?? "").split("-").map(Number);
    if (!by || !bm || !bd) continue;
    let o = occurrence(ty, bm, bd);
    if (utc(o.y, o.m, o.d) < t0) o = occurrence(ty + 1, bm, bd);
    const daysLeft = Math.round((utc(o.y, o.m, o.d) - t0) / 86_400_000);
    if (daysLeft > daysAhead) continue;
    out.push({
      id: c.id,
      customer_code: c.customer_code,
      pt: c.pt,
      sales_id: c.sales_id,
      date: `${o.y}-${pad(o.m)}-${pad(o.d)}`,
      daysLeft,
      age: o.y > by ? o.y - by : null,
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.pt.localeCompare(b.pt));
}
