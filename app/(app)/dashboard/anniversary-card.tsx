import Link from "next/link";
import { Cake } from "lucide-react";
import { Content } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ANNIVERSARY_DAYS_AHEAD, type AnniversaryItem } from "@/lib/anniversary";
import { fmtDay } from "@/lib/format";
import { TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

function countdown(days: number) {
  if (days === 0) return { label: "Hari ini", tone: TONE.emerald };
  if (days === 1) return { label: "Besok", tone: TONE.amber };
  return { label: `H-${days}`, tone: days <= 3 ? TONE.amber : TONE.gray };
}

/** Reminder ulang tahun perusahaan customer, H-10 s/d hari-H. Tampil selama ada yang mendekati. */
export function AnniversaryCard({
  items,
  salesName,
  className,
}: {
  items: AnniversaryItem[];
  salesName: Map<string, string>;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <Content
      className={className}
      title="Ulang Tahun Perusahaan Customer"
      description={`${items.length} customer berulang tahun dalam ${ANNIVERSARY_DAYS_AHEAD} hari ke depan`}
      cardAction={
        <Link href="/customers" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Customer DB
        </Link>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((a) => {
          const c = countdown(a.daysLeft);
          return (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                a.daysLeft === 0 && "border-primary/40 bg-primary/5",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Cake className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={a.pt}>
                  {a.pt}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{a.customer_code}</span> · {fmtDay(a.date)}
                  {a.age ? ` · ke-${a.age}` : ""}
                  {a.sales_id && salesName.get(a.sales_id) ? ` · ${salesName.get(a.sales_id)}` : ""}
                </div>
              </div>
              <Badge variant="outline" className={cn("shrink-0 font-medium whitespace-nowrap", c.tone)}>
                {c.label}
              </Badge>
            </li>
          );
        })}
      </ul>
    </Content>
  );
}
