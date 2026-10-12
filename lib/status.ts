import type { Role } from "@/lib/constants";

// Warna badge status (styling-guide §6): outline lembut, pola light
// -50/-700/-200 dan dark -900/40 / -300 / -800. Tulis string lengkap supaya
// terbaca Tailwind — jangan dirakit dinamis.
const TONE = {
  gray: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
} as const;

export const DEFAULT_STATUS_COLOR = TONE.gray;

/**
 * gray = draft/pending · blue = diproses · sky/indigo = tahap lanjutan ·
 * amber = menunggu/perhatian · orange = butuh tindak lanjut · green = disetujui ·
 * emerald = selesai · red = ditolak/masalah
 */
export const STATUS_COLORS: Record<string, string> = {
  // umum
  Draft: TONE.gray,
  Pending: TONE.gray,
  Terjadwal: TONE.gray,
  Proses: TONE.blue,
  "In Progress": TONE.blue,
  Open: TONE.blue,
  Menunggu: TONE.amber,
  Postponed: TONE.amber,
  Selesai: TONE.emerald,
  Completed: TONE.emerald,
  Closed: TONE.emerald,
  Ditolak: TONE.red,
  Dibatalkan: TONE.red,
  Cancel: TONE.red,
  // forecast & actual
  "On Track": TONE.sky,
  Achieved: TONE.green,
  Tercapai: TONE.green,
  Delayed: TONE.orange,
  "At Risk": TONE.red,
  Shortage: TONE.red,
  // quotation (PO status)
  Win: TONE.green,
  Loss: TONE.red,
  // pipeline stage
  "Market Map": TONE.gray,
  Lead: TONE.gray,
  Qualified: TONE.blue,
  Proposal: TONE.sky,
  Negotiation: TONE.amber,
  PO: TONE.indigo,
  Delivery: TONE.indigo,
  Handover: TONE.emerald,
  // akun & login
  Aktif: TONE.green,
  Nonaktif: TONE.gray,
  Online: TONE.green,
  Offline: TONE.gray,
  LOGIN: TONE.green,
  LOGOUT: TONE.gray,
};

export const ROLE_COLORS: Record<Role, string> = {
  moderator: TONE.amber,
  master: TONE.indigo,
  admin: TONE.sky,
  sales: TONE.gray,
};
