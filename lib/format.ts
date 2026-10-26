const num = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const fmtNumber = (v: unknown) => num.format(toNumber(v));

/** "Rp 250Jt" seperti KPI prototipe */
export const fmtJuta = (v: unknown, digits = 0) => `Rp ${(toNumber(v) / 1_000_000).toFixed(digits)}Jt`;

export const fmtRupiah = (v: unknown) => `Rp ${num.format(toNumber(v))}`;

export const fmtPercent = (v: number) => `${v.toFixed(1)}%`;

/** Persentase aman: 0 bila pembagi 0 */
export const pct = (a: unknown, b: unknown) => {
  const d = toNumber(b);
  return d ? (toNumber(a) / d) * 100 : 0;
};

export const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("id-ID") : "-");

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/** "2026-10-09" (kolom date) → "09 Okt 2026", tanpa geser zona waktu */
export function fmtDay(v: string | null | undefined) {
  const [y, m, d] = (v ?? "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return v || "-";
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** "2026-08" → "2026-S2" */
export function semesterOf(periode: string | null | undefined) {
  if (!periode) return "?";
  const [y, m] = periode.split("-");
  return `${y}-S${parseInt(m, 10) <= 6 ? 1 : 2}`;
}

const compact = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Rupiah ringkas untuk kartu & sumbu grafik: "Rp 950rb", "Rp 12,5Jt", "Rp 1,2M" (miliar), "Rp 3T". */
export function fmtRpShort(v: unknown) {
  const n = toNumber(v);
  const a = Math.abs(n);
  const [d, unit] = a >= 1e12 ? [1e12, "T"] : a >= 1e9 ? [1e9, "M"] : a >= 1e6 ? [1e6, "Jt"] : a >= 1e3 ? [1e3, "rb"] : [1, ""];
  return `Rp ${compact.format(n / d)}${unit}`;
}

/** Angka ringkas untuk sumbu grafik: 950 · 1,2rb · 3,4Jt */
export function fmtShort(v: unknown) {
  const n = toNumber(v);
  const a = Math.abs(n);
  const [d, unit] = a >= 1e9 ? [1e9, "M"] : a >= 1e6 ? [1e6, "Jt"] : a >= 1e3 ? [1e3, "rb"] : [1, ""];
  return `${compact.format(n / d)}${unit}`;
}
