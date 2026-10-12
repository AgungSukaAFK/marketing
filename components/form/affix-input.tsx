import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Input dengan teks satuan di kanan, mis. "%", "mnt", "pcs". */
export const AffixInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { suffix: string }
>(({ suffix, className, ...props }, ref) => (
  <div className="relative">
    <Input ref={ref} className={cn("pr-12 text-right tabular-nums", className)} {...props} />
    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
      {suffix}
    </span>
  </div>
));
AffixInput.displayName = "AffixInput";
