"use client";

import { useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString("id-ID", { month: "short" }),
);
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-08" → "Agustus 2026" */
export function formatPeriode(v: string) {
  const [y, m] = v.split("-").map(Number);
  if (!y || !m) return v;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/** Pilih periode bulan; nilai string "YYYY-MM". */
export function MonthPicker({
  id,
  value,
  onChange,
  placeholder = "Pilih periode",
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selYear, selMonth] = value ? value.split("-").map(Number) : [];
  const [year, setYear] = useState(selYear || new Date().getFullYear());

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(selYear || new Date().getFullYear());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className={cn(
            "w-full justify-start font-normal aria-invalid:border-destructive",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarRange className="text-muted-foreground" />
          {value ? formatPeriode(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setYear(year - 1)} aria-label="Tahun sebelumnya">
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium tabular-nums">{year}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setYear(year + 1)} aria-label="Tahun berikutnya">
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((label, i) => {
            const selected = selYear === year && selMonth === i + 1;
            return (
              <Button
                key={label}
                type="button"
                variant={selected ? "default" : "ghost"}
                size="sm"
                className="capitalize"
                onClick={() => {
                  onChange(`${year}-${pad(i + 1)}`);
                  setOpen(false);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
              setOpen(false);
            }}
          >
            Bulan ini
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
