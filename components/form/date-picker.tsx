"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "2026-10-09" → Date lokal (tanpa geser zona waktu). */
function parseDate(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "2026-10-09" → "09/10/2026" */
const toText = (v: string) => {
  const d = parseDate(v);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";
};

/** "09/10/2026" → "2026-10-09"; null bila belum lengkap / tidak valid (mis. 31/02). */
function fromText(t: string, minYear: number, maxYear: number) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (y < minYear || y > maxYear) return null;
  return toValue(date);
}

/** Ketikan → "DD/MM/YYYY" (garis miring otomatis). */
function mask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

/**
 * Input tanggal: ketik "DD/MM/YYYY" atau pilih dari kalender.
 * Nilai string "YYYY-MM-DD" ("" = kosong).
 */
export function DatePicker({
  id,
  value,
  onChange,
  invalid,
  minYear = 1900,
  maxYear = new Date().getFullYear() + 10,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  minYear?: number;
  maxYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => toText(value));
  const [synced, setSynced] = useState(value);
  // nilai diubah dari luar (kalender, reset form) → tampilkan ulang
  if (value !== synced) {
    setSynced(value);
    setText(toText(value));
  }
  const date = value ? parseDate(value) : undefined;
  const partial = text !== "" && fromText(text, minYear, maxYear) === null;

  const commit = (v: string) => {
    setSynced(v);
    onChange(v);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={text}
        aria-invalid={invalid || partial}
        className="pr-10 tabular-nums"
        onChange={(e) => {
          const t = mask(e.target.value);
          setText(t);
          if (t === "") commit("");
          else {
            const v = fromText(t, minYear, maxYear);
            if (v) commit(v);
          }
        }}
        // ketikan tidak lengkap → kembali ke nilai terakhir yang valid
        onBlur={() => setText(toText(value))}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Buka kalender"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          >
            <CalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="end">
          <Calendar
            mode="single"
            locale={localeId}
            selected={date}
            defaultMonth={date}
            captionLayout="dropdown"
            startMonth={new Date(minYear, 0, 1)}
            endMonth={new Date(maxYear, 11, 31)}
            onSelect={(d) => {
              const v = d ? toValue(d) : "";
              setText(toText(v));
              commit(v);
              setOpen(false);
            }}
          />
          <div className="flex justify-between border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!value}
              onClick={() => {
                setText("");
                commit("");
                setOpen(false);
              }}
            >
              Kosongkan
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const v = toValue(new Date());
                setText(toText(v));
                commit(v);
                setOpen(false);
              }}
            >
              Hari ini
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
