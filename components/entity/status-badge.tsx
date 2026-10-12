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
