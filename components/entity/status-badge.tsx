import { Badge } from "@/components/ui/badge";
import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium whitespace-nowrap", STATUS_COLORS[value] ?? DEFAULT_STATUS_COLOR, className)}
    >
      {value}
    </Badge>
  );
}

/** Jumlah per status, mis. [Win 2] [Negosiasi 1] — dipakai ringkasan barang quotation. */
export function StatusCounts({ counts, className }: { counts: { status: string; count: number }[]; className?: string }) {
  if (!counts.length) return <span className="text-sm text-muted-foreground">-</span>;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {counts.map((c) => (
        <Badge
          key={c.status}
          variant="outline"
          className={cn("gap-1 font-medium whitespace-nowrap", STATUS_COLORS[c.status] ?? DEFAULT_STATUS_COLOR)}
        >
          {c.status}
          <span className="tabular-nums opacity-80">{c.count}</span>
        </Badge>
      ))}
    </div>
  );
}
