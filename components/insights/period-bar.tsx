"use client";

import { useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, UserRound } from "lucide-react";
import { id as localeId } from "date-fns/locale";
import type { DateRange as DayRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { PRESETS, daysBetween, MAX_RANGE_DAYS, rangeLabel, type PresetId } from "@/lib/period";
import { cn } from "@/lib/utils";
import { useInsights } from "./provider";

const ALL = "__all__";
const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Satu baris filter di atas semua konten: preset periode → geser ◀ ▶ →
 * rentang custom → Sales (Master/Admin). Pilihan langsung tampil aktif
 * (optimistic) sementara data dimuat ulang.
 */
export function PeriodBar({ presets, actions }: { presets: PresetId[]; actions?: React.ReactNode }) {
  const { filter, pending, navigate } = useInsights();
  const { period } = filter;
  const serverKey = `${period.preset}|${period.offset}|${period.range.from}|${period.range.to}|${filter.sales ?? ""}`;
  const [shown, setShown] = useState({ key: serverKey, preset: period.preset, sales: filter.sales });
  if (shown.key !== serverKey) setShown({ key: serverKey, preset: period.preset, sales: filter.sales });

  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>();

  const pick = (preset: PresetId) => {
    if (preset === shown.preset && period.offset === 0) return;
    setShown((s) => ({ ...s, preset }));
    navigate({ p: preset, o: null, from: null, to: null });
  };
  const shift = (delta: number) => {
    const o = period.offset + delta;
    navigate({ o: o ? String(o) : null });
  };
  const canForward = period.preset === "custom" || period.offset < 0;

  const draftDays = draft?.from && draft.to ? daysBetween(toValue(draft.from), toValue(draft.to)) : 0;
  const applyCustom = () => {
    if (!draft?.from) return;
    const from = toValue(draft.from);
    const to = toValue(draft.to ?? draft.from);
    setCustomOpen(false);
    setShown((s) => ({ ...s, preset: "custom" }));
    navigate({ p: "custom", o: null, from, to });
  };

  return (
    <div className="col-span-12 flex min-w-0 flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Periode"
        className="flex max-w-full overflow-x-auto rounded-lg border bg-muted/40 p-0.5 [scrollbar-width:none]"
      >
        {presets.map((p) => {
          const active = shown.preset === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(p)}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active && "bg-background text-foreground shadow-sm",
              )}
            >
              {PRESETS[p].label}
            </button>
          );
        })}
        <Popover
          open={customOpen}
          onOpenChange={(o) => {
            setCustomOpen(o);
            if (o) setDraft({ from: toDate(period.range.from), to: toDate(period.range.to) });
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={shown.preset === "custom"}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                shown.preset === "custom" && "bg-background text-foreground shadow-sm",
              )}
            >
              <CalendarRange className="size-3.5" />
              Custom
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              locale={localeId}
              numberOfMonths={2}
              defaultMonth={draft?.from}
              selected={draft}
              onSelect={setDraft}
              className="[&_.rdp-months]:flex-col sm:[&_.rdp-months]:flex-row"
            />
            <div className="flex items-center justify-between gap-3 border-t p-3">
              <p className="text-xs text-muted-foreground">
                {draft?.from
                  ? rangeLabel({ from: toValue(draft.from), to: toValue(draft.to ?? draft.from) })
                  : "Pilih tanggal awal & akhir"}
              </p>
              <Button size="sm" onClick={applyCustom} disabled={!draft?.from || draftDays >= MAX_RANGE_DAYS}>
                Terapkan
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Periode sebelumnya" title="Periode sebelumnya">
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => shift(1)}
          disabled={!canForward}
          aria-label="Periode berikutnya"
          title="Periode berikutnya"
        >
          <ChevronRight />
        </Button>
        <div className="min-w-0 px-1 leading-tight">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {period.label}
            {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Memuat" />}
          </p>
          <p className="text-xs text-muted-foreground">vs {period.prevLabel}</p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {filter.people.length > 0 && (
          <div className="w-52 max-w-full">
            <SearchableSelect
              value={shown.sales ?? ALL}
              onValueChange={(v) => {
                const sales = v === ALL ? null : v;
                setShown((s) => ({ ...s, sales }));
                navigate({ sales });
              }}
            >
              <SearchableSelectTrigger className="h-8 w-full text-xs" aria-label="Filter sales">
                <UserRound className="size-3.5 text-muted-foreground" />
                <SearchableSelectValue />
              </SearchableSelectTrigger>
              <SearchableSelectContent>
                <SearchableSelectItem value={ALL}>Semua Sales</SearchableSelectItem>
                {filter.people.map((p) => (
                  <SearchableSelectItem key={p.id} value={p.id}>
                    {p.name || p.username}
                  </SearchableSelectItem>
                ))}
              </SearchableSelectContent>
            </SearchableSelect>
          </div>
        )}
        {actions}
      </div>
    </div>
  );
}
