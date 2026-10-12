"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** "2026-10-09" → Date lokal (tanpa geser zona waktu). */
function parseDate(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Pilih tanggal; nilai string "YYYY-MM-DD", tampil "09 Okt 2026". */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pilih tanggal",
  invalid,
  clearable = true,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? parseDate(value) : undefined;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid}
            className={cn(
              "w-full justify-start font-normal aria-invalid:border-destructive",
              !date && "text-muted-foreground",
              clearable && date && "pr-9",
            )}
          >
            <CalendarDays className="text-muted-foreground" />
            {date
              ? date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
              : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            locale={localeId}
            selected={date}
            defaultMonth={date}
            captionLayout="dropdown"
            onSelect={(d) => {
              onChange(d ? toValue(d) : "");
              setOpen(false);
            }}
          />
          <div className="flex justify-end border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(toValue(new Date()));
                setOpen(false);
              }}
            >
              Hari ini
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {clearable && date && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Kosongkan tanggal"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
