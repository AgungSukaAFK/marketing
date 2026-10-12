import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Kartu KPI untuk grid 12 kolom — lebar sama dengan <Content size="xs">. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("col-span-12 gap-0 py-5 sm:col-span-6 lg:col-span-3", className)}>
      <CardContent className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
