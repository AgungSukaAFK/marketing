"use client";

import type { ActivityFilter } from "@/app/actions/activity";
import { RoleBadge } from "@/components/role-badge";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_ACTIONS, isActivityAction, type ActivityRow } from "@/lib/activity-meta";
import { cn } from "@/lib/utils";

export type ActivityFilters = Omit<ActivityFilter, "page" | "record"> & {
  /** riwayat satu data; `label` hanya untuk ditampilkan */
  record?: { entity: string; id: string; label: string | null } | null;
};

export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const meta = isActivityAction(action) ? ACTIVITY_ACTIONS[action] : null;
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", meta?.tone, className)}>
      {meta?.label ?? action}
    </Badge>
  );
}

/** Nama pelaku; tanpa akun = "Sistem" (SQL Editor / proses internal) atau email percobaan login. */
export function ActorCell({ row }: { row: ActivityRow }) {
  if (!row.actor_id) {
    const email = typeof row.meta?.email === "string" ? row.meta.email : null;
    return (
      <div className="min-w-0">
        <p className="font-medium text-muted-foreground italic">{email ? "Tidak dikenal" : "Sistem"}</p>
        <p className="truncate text-xs text-muted-foreground">{email ?? "SQL Editor / proses internal"}</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{row.actor_name ?? "Akun terhapus"}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {row.actor_username && <span className="truncate font-mono">@{row.actor_username}</span>}
        {row.actor_role && <RoleBadge role={row.actor_role} />}
      </div>
    </div>
  );
}
