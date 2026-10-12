"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Batas aman angka bulat di input (± 9,9 triliun)
const MAX = 9_999_999_999_999;

/** 1500000 → "Rp 1.500.000"; 0/kosong → "" (placeholder "Rp 0" yang tampil). */
const formatRupiah = (value: number): string =>
  value ? `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}` : "";

/** "Rp 1.500.000" → 1500000 */
const parseRupiah = (formatted: string): number => Number(formatted.replace(/[^0-9]/g, ""));

export interface CurrencyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
}

/** Input Rupiah: diketik angka, tampil terformat "Rp 1.500.000", nilai ke form berupa number. */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => (
    <Input
      type="text"
      inputMode="numeric"
      className={cn("text-right tabular-nums", className)}
      ref={ref}
      value={formatRupiah(value || 0)}
      onChange={(e) => {
        const n = parseRupiah(e.target.value);
        if (n <= MAX) onValueChange(n);
      }}
      placeholder="Rp 0"
      {...props}
    />
  ),
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
