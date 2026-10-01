import { ROLE_LABEL, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ROLE_TONE: Record<Role, string> = {
  moderator: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  master: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  admin: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  sales: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function RoleBadge({ role }: { role: Role | null }) {
  if (!role) return <span className="text-xs text-muted-foreground">-</span>;
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>;
}
