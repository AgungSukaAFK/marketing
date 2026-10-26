"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { DELTA_TEXT } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Perubahan vs periode pembanding.
 * - relative: persen perubahan (prev 0 → "Baru")
 * - points: selisih poin persentase (untuk nilai yang sudah berupa %)
 */
export function Delta({
  cur,
  prev,
  mode = "relative",
  className,
}: {
  cur: number | null;
  prev: number | null;
  mode?: "relative" | "points";
  className?: string;
}) {
  if (cur == null || prev == null) return <span className={cn("text-xs text-muted-foreground", className)}>–</span>;
  let change: number;
  let text: string;
  if (mode === "points") {
    change = Math.round((cur - prev) * 10) / 10;
    text = `${change > 0 ? "+" : ""}${change.toFixed(1)} poin`;
  } else if (!prev) {
    if (!cur) return <span className={cn("text-xs text-muted-foreground", className)}>–</span>;
    change = 1;
    text = "Baru";
  } else {
    change = Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
    text = `${change > 0 ? "+" : ""}${change.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  }
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums",
        change > 0 ? DELTA_TEXT.up : change < 0 ? DELTA_TEXT.down : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  );
}

/** Kartu angka utama. Bila `onClick` ada, seluruh kartu jadi tombol untuk melihat datanya. */
export function Tile({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  delta?: React.ReactNode;
  hint?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="hidden size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary min-[420px]:flex">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="-mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {delta}
        {hint && <span className="min-w-0 truncate">{hint}</span>}
        {onClick && (
          <ChevronRight className="ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        )}
      </div>
    </>
  );
  const base = cn(
    "group col-span-6 flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 text-left text-card-foreground shadow-sm sm:px-5 sm:py-4 lg:col-span-3",
    className,
  );
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        "transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      {body}
    </button>
  );
}
