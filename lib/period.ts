/**
 * Periode filter Dashboard & Analytics. Semua tanggal berupa string
 * "YYYY-MM-DD" menurut WIB, rentang inklusif. Aman dipakai di server & client.
 *
 * Preset bulanan selaras kalender (Forecast & Evaluasi disimpan per bulan):
 * "3 Bulan" = 3 bulan terakhir termasuk bulan berjalan, s/d hari ini.
 * Offset menggeser satu panjang preset ke belakang (◀) / depan (▶).
 */

export type PresetId = "today" | "1w" | "1m" | "3m" | "6m" | "8m" | "1y" | "custom";

export const PRESETS: Record<PresetId, { label: string; short: string }> = {
  today: { label: "Hari ini", short: "Hari ini" },
  "1w": { label: "1 Minggu", short: "1M" },
  "1m": { label: "1 Bulan", short: "1B" },
  "3m": { label: "3 Bulan", short: "3B" },
  "6m": { label: "6 Bulan", short: "6B" },
  "8m": { label: "8 Bulan", short: "8B" },
  "1y": { label: "1 Tahun", short: "1T" },
  custom: { label: "Custom", short: "Custom" },
};

export const DASHBOARD_PRESETS: PresetId[] = ["today", "1w", "1m", "3m", "6m", "1y"];
export const ANALYTICS_PRESETS: PresetId[] = ["1w", "1m", "3m", "6m", "8m", "1y"];

const MONTH_SPAN: Partial<Record<PresetId, number>> = { "1m": 1, "3m": 3, "6m": 6, "8m": 8, "1y": 12 };

/** Batas rentang custom & offset supaya query tidak kebablasan. */
export const MAX_RANGE_DAYS = 3 * 366;
export const MAX_OFFSET = 120;

export type Granularity = "hour" | "day" | "week" | "month";

export type DateRange = { from: string; to: string };

export type Period = {
  preset: PresetId;
  offset: number;
  range: DateRange;
  /** periode pembanding, panjang sama tepat sebelumnya */
  prev: DateRange;
  /** "Agu – Okt 2026" */
  label: string;
  prevLabel: string;
  /** bulan "YYYY-MM" yang beririsan dengan rentang */
  months: string[];
  prevMonths: string[];
  granularity: Granularity;
  days: number;
  /** rentang memuat hari ini */
  current: boolean;
  today: string;
};

// ---------------------------------------------------------------------------
// Tanggal (aritmetika UTC atas string WIB — tidak terpengaruh zona server)
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const parts = (d: string) => d.split("-").map(Number) as [number, number, number];
const fromUtc = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const utcOf = (d: string) => {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
};

export const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && fromUtc(utcOf(v)) === v;

export const addDays = (d: string, n: number) => fromUtc(utcOf(d) + n * 86_400_000);
export const daysBetween = (a: string, b: string) => Math.round((utcOf(b) - utcOf(a)) / 86_400_000);
export const monthOf = (d: string) => d.slice(0, 7);

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function lastDayOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

/** Senin pada minggu tanggal `d`. */
export const weekStart = (d: string) => addDays(d, -((new Date(utcOf(d)).getUTCDay() + 6) % 7));

export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let m = monthOf(from); m <= monthOf(to); m = addMonths(m, 1)) out.push(m);
  return out;
}

const WIB_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const WIB_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" });

/** timestamptz → "YYYY-MM-DD" WIB */
export const wibDate = (ts: string | Date) => WIB_DATE.format(new Date(ts));
/** timestamptz → jam WIB 0–23 */
export const wibHour = (ts: string | Date) => Number(WIB_HOUR.format(new Date(ts)));
export const todayWIB = (now = new Date()) => wibDate(now);

/** Batas rentang sebagai timestamptz (UTC) untuk filter kolom created_at: [gte, lt). */
export const rangeTs = (r: DateRange) => ({
  gte: new Date(`${r.from}T00:00:00+07:00`).toISOString(),
  lt: new Date(`${addDays(r.to, 1)}T00:00:00+07:00`).toISOString(),
});

export const inRange = (d: string | null | undefined, r: DateRange) => !!d && d >= r.from && d <= r.to;

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------
const MONTH_SHORT = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("id-ID", { month: "short" }),
);
const MONTH_LONG = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("id-ID", { month: "long" }),
);
const WEEKDAY = Array.from({ length: 7 }, (_, i) =>
  new Date(2000, 0, 2 + i).toLocaleDateString("id-ID", { weekday: "long" }),
);

/** "26 Okt 2026" */
export function fmtShortDate(d: string, withYear = true) {
  const [y, m, day] = parts(d);
  return `${day} ${MONTH_SHORT[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** "Senin, 26 Oktober 2026" */
export function fmtLongDate(d: string) {
  const [y, m, day] = parts(d);
  return `${WEEKDAY[new Date(utcOf(d)).getUTCDay()]}, ${day} ${MONTH_LONG[m - 1]} ${y}`;
}

/** "Okt 26" */
export function fmtMonthShort(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
}

export function rangeLabel(r: DateRange) {
  const [fy, fm, fd] = parts(r.from);
  const [ty, tm, td] = parts(r.to);
  if (r.from === r.to) return fmtShortDate(r.from);
  const wholeMonths = fd === 1 && r.to === lastDayOf(monthOf(r.to));
  if (wholeMonths) {
    if (monthOf(r.from) === monthOf(r.to)) return `${MONTH_LONG[fm - 1]} ${fy}`;
    return fy === ty ? `${MONTH_SHORT[fm - 1]} – ${MONTH_SHORT[tm - 1]} ${ty}` : `${MONTH_SHORT[fm - 1]} ${fy} – ${MONTH_SHORT[tm - 1]} ${ty}`;
  }
  if (fy === ty && fm === tm) return `${fd} – ${td} ${MONTH_SHORT[tm - 1]} ${ty}`;
  return fy === ty ? `${fd} ${MONTH_SHORT[fm - 1]} – ${td} ${MONTH_SHORT[tm - 1]} ${ty}` : `${fmtShortDate(r.from)} – ${fmtShortDate(r.to)}`;
}

// ---------------------------------------------------------------------------
// Resolusi periode dari URL
// ---------------------------------------------------------------------------
export type PeriodInput = { p?: unknown; o?: unknown; from?: unknown; to?: unknown };

export const isPreset = (v: unknown): v is PresetId => typeof v === "string" && v in PRESETS;

function granularityOf(days: number): Granularity {
  if (days <= 1) return "hour";
  if (days <= 35) return "day";
  if (days <= 124) return "week";
  return "month";
}

function shiftRange(r: DateRange, preset: PresetId, offset: number, today: string): DateRange {
  const span = MONTH_SPAN[preset];
  if (span) {
    const endMonth = addMonths(monthOf(today), offset * span);
    const startMonth = addMonths(endMonth, -(span - 1));
    return { from: `${startMonth}-01`, to: offset === 0 ? today : lastDayOf(endMonth) };
  }
  if (preset === "today") return { from: addDays(today, offset), to: addDays(today, offset) };
  if (preset === "1w") {
    const to = addDays(today, offset * 7);
    return { from: addDays(to, -6), to };
  }
  const len = daysBetween(r.from, r.to) + 1;
  return { from: addDays(r.from, offset * len), to: addDays(r.to, offset * len) };
}

/** Pembanding: preset bulanan → mundur N bulan (bulan berjalan dibandingkan s/d tanggal yang sama). */
function previousRange(r: DateRange, preset: PresetId): DateRange {
  const span = MONTH_SPAN[preset];
  if (span) {
    const from = `${addMonths(monthOf(r.from), -span)}-01`;
    const endMonth = addMonths(monthOf(r.to), -span);
    const sameDay = `${endMonth}-${r.to.slice(8)}`;
    const last = lastDayOf(endMonth);
    const partial = r.to !== lastDayOf(monthOf(r.to));
    return { from, to: partial && sameDay < last ? sameDay : last };
  }
  const len = daysBetween(r.from, r.to) + 1;
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}

export function resolvePeriod(input: PeriodInput, fallback: PresetId, allowed: PresetId[], today = todayWIB()): Period {
  let preset: PresetId = isPreset(input.p) && (input.p === "custom" || allowed.includes(input.p)) ? input.p : fallback;
  let base: DateRange = { from: today, to: today };
  if (preset === "custom") {
    const from = isDate(input.from) ? input.from : null;
    const to = isDate(input.to) ? input.to : null;
    if (from && to && from <= to && daysBetween(from, to) < MAX_RANGE_DAYS) base = { from, to };
    else preset = fallback;
  }
  const rawOffset = Math.trunc(Number(input.o) || 0);
  const offset = Math.max(-MAX_OFFSET, Math.min(preset === "custom" ? MAX_OFFSET : 0, rawOffset));
  const range = shiftRange(base, preset, offset, today);
  const prev = previousRange(range, preset);
  const days = daysBetween(range.from, range.to) + 1;
  return {
    preset,
    offset,
    range,
    prev,
    label: preset === "today" && offset === 0 ? `Hari ini · ${fmtShortDate(today)}` : rangeLabel(range),
    prevLabel: rangeLabel(prev),
    months: monthsBetween(range.from, range.to),
    prevMonths: monthsBetween(prev.from, prev.to),
    granularity: granularityOf(days),
    days,
    current: inRange(today, range),
    today,
  };
}

/** Query string untuk periode (tanpa param lain). */
export function periodQuery(preset: PresetId, offset = 0, custom?: DateRange) {
  const q = new URLSearchParams({ p: preset });
  if (offset) q.set("o", String(offset));
  if (preset === "custom" && custom) {
    q.set("from", custom.from);
    q.set("to", custom.to);
  }
  return q;
}

// ---------------------------------------------------------------------------
// Bucket waktu untuk grafik tren
// ---------------------------------------------------------------------------
export type Bucket = { key: string; label: string; range: DateRange };

export function buckets(range: DateRange, g: Granularity): Bucket[] {
  const out: Bucket[] = [];
  if (g === "hour") {
    for (let h = 0; h < 24; h++) out.push({ key: pad(h), label: `${pad(h)}:00`, range });
    return out;
  }
  if (g === "day") {
    for (let d = range.from; d <= range.to; d = addDays(d, 1))
      out.push({ key: d, label: fmtShortDate(d, false), range: { from: d, to: d } });
    return out;
  }
  if (g === "week") {
    for (let w = weekStart(range.from); w <= range.to; w = addDays(w, 7)) {
      const from = w < range.from ? range.from : w;
      const end = addDays(w, 6);
      out.push({ key: w, label: fmtShortDate(from, false), range: { from, to: end > range.to ? range.to : end } });
    }
    return out;
  }
  for (const m of monthsBetween(range.from, range.to)) {
    const from = `${m}-01` < range.from ? range.from : `${m}-01`;
    const end = lastDayOf(m);
    out.push({ key: m, label: fmtMonthShort(m), range: { from, to: end > range.to ? range.to : end } });
  }
  return out;
}

/** Kunci bucket untuk tanggal "YYYY-MM-DD" (+ jam untuk granularity hour). */
export function bucketKey(date: string, g: Granularity, hour = 0) {
  if (g === "hour") return pad(hour);
  if (g === "day") return date;
  if (g === "week") return weekStart(date);
  return monthOf(date);
}
