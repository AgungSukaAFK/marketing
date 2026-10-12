import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { ROLE_COLORS } from "@/lib/status";
import { cn } from "@/lib/utils";

export function RoleBadge({ role }: { role: Role | null }) {
  if (!role) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Badge variant="outline" className={cn("font-medium", ROLE_COLORS[role])}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}
