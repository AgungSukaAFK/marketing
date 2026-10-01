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

/** "2026-08" → "2026-S2" */
export function semesterOf(periode: string | null | undefined) {
  if (!periode) return "?";
  const [y, m] = periode.split("-");
  return `${y}-S${parseInt(m, 10) <= 6 ? 1 : 2}`;
}
