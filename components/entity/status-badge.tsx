import { cn } from "@/lib/utils";

const GOOD = ["Completed", "Achieved", "Win", "Selesai", "Closed", "Tercapai", "Handover", "Aktif", "LOGIN", "Online"];
const BAD = ["Loss", "Ditolak", "Cancel", "Shortage", "At Risk", "Delayed", "Dibatalkan", "Nonaktif", "Offline"];
const WARN = ["Pending", "Proses", "In Progress", "Postponed", "Negotiation", "PO", "LOGOUT", "Open", "Menunggu"];

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const tone = GOOD.includes(value)
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : BAD.includes(value)
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      : WARN.includes(value)
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", tone, className)}>
      {value}
    </span>
  );
}
