/** "Perlu Tindak Lanjut" di Dashboard — selalu relatif ke hari ini, tidak ikut filter periode. */
import type { AgendaId } from "./types";

/** Quotation yang expired dalam N hari ke depan. */
export const QUOT_EXPIRING_DAYS = 14;
/** Quotation yang sudah lewat Tgl Exp ≤ N hari lalu tapi masih ada barang Draft/Negosiasi. */
export const QUOT_EXPIRED_LOOKBACK = 60;
/** Deal belum selesai yang tidak diperbarui lebih dari N hari. */
export const DEAL_STALE_DAYS = 30;
/** Refreshment terjadwal dalam N hari ke depan. */
export const REFRESHMENT_DAYS = 14;

export const ACT_PENDING_STATUS = ["Pending", "In Progress"];
export const ADMIN_PENDING_STATUS = ["Draft", "Pending", "Proses", "Revisi"];
export const FORECAST_RISK_STATUS = ["At Risk", "Delayed"];

export const AGENDA_META: Record<AgendaId, { label: string; hint: string; menu: string; tone: "red" | "amber" | "blue" | "gray" }> = {
  quot_expired: {
    label: "Quotation lewat Tgl Exp",
    hint: `Masih ada barang Draft/Negosiasi, expired ≤ ${QUOT_EXPIRED_LOOKBACK} hari lalu`,
    menu: "quotation",
    tone: "red",
  },
  quot_expiring: {
    label: "Quotation segera expired",
    hint: `Tgl Exp dalam ${QUOT_EXPIRING_DAYS} hari ke depan`,
    menu: "quotation",
    tone: "amber",
  },
  forecast_risk: {
    label: "Forecast At Risk / Delayed",
    hint: "Forecast bulan ini yang butuh perhatian",
    menu: "forecast",
    tone: "red",
  },
  deal_stale: {
    label: "Deal mandek",
    hint: `Belum Good Receive & tidak diperbarui > ${DEAL_STALE_DAYS} hari`,
    menu: "pipeline",
    tone: "amber",
  },
  act_pending: {
    label: "Aktivitas sales belum selesai",
    hint: "Status Pending / In Progress",
    menu: "sales_daily",
    tone: "blue",
  },
  admin_pending: {
    label: "Pekerjaan admin terbuka",
    hint: "Status Draft / Pending / Proses / Revisi",
    menu: "admin_daily",
    tone: "blue",
  },
  refreshment_upcoming: {
    label: "Refreshment terjadwal",
    hint: `Sesi dalam ${REFRESHMENT_DAYS} hari ke depan`,
    menu: "refreshment",
    tone: "gray",
  },
};

export const AGENDA_ORDER: AgendaId[] = [
  "quot_expired",
  "quot_expiring",
  "forecast_risk",
  "deal_stale",
  "act_pending",
  "admin_pending",
  "refreshment_upcoming",
];
