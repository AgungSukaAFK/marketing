"use client";

import { useId, useState } from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/** Pilih banyak opsi (mis. peserta): chip terpilih + popup pencarian yang tetap terbuka. */
export function MultiSelect({
  id,
  value,
  onChange,
  options,
  invalid,
  disabled,
  placeholder = "-- Pilih --",
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = new Set(value);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) =>
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid}
          disabled={disabled}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-2 py-1 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {value.length === 0 && (
              <span className="text-muted-foreground px-1">{placeholder}</span>
            )}
            {value.map((v) => (
              <span
                key={v}
                className="bg-secondary text-secondary-foreground inline-flex max-w-full items-center gap-1 rounded-sm py-0.5 pr-1 pl-2 text-xs font-medium"
              >
                <span className="truncate">{labelOf(v)}</span>
                {!disabled && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Hapus ${labelOf(v)}`}
                    className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                    onPointerDown={(e) => {
                      // jangan buka popup saat hapus chip
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }}
                  >
                    <XIcon className="size-3" />
                  </span>
                )}
              </span>
            ))}
          </span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-auto min-w-[max(var(--radix-popover-trigger-width),10rem)] max-w-[min(28rem,calc(100vw_-_1rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Cari..." />
          <CommandList id={listId} className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)_-_2.5rem))]">
            <CommandEmpty>Tidak ada data ditemukan.</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={o.value}
                keywords={[o.label]}
                onSelect={() => toggle(o.value)}
              >
                <CheckIcon
                  className={cn("size-4", !selected.has(o.value) && "opacity-0")}
                />
                <span className="break-words">{o.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
