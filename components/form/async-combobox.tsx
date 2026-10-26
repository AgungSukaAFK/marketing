"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, ChevronDownIcon, Loader2, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; description?: string };

/** Batas hasil per pencarian — ringan untuk DB & cepat di layar. */
export const COMBO_LIMIT = 20;
const DEBOUNCE_MS = 250;

/**
 * Combobox dengan pencarian server-side: data tidak dimuat semua di awal, tiap
 * ketikan (debounce) memanggil `load(q)` yang mengembalikan maks. COMBO_LIMIT opsi.
 *
 * - `selected`: opsi terpilih saat ini (labelnya ditampilkan walau tidak ada di hasil).
 * - `creatable`: teks bebas boleh dipakai sebagai nilai ("Gunakan …"), opsi = saran.
 */
export function AsyncCombobox({
  id,
  selected,
  onSelect,
  load,
  placeholder = "-- Pilih --",
  searchPlaceholder = "Cari…",
  emptyText = "Tidak ada data ditemukan.",
  creatable,
  clearable,
  invalid,
  disabled,
  className,
}: {
  id?: string;
  selected: ComboOption | null;
  onSelect: (option: ComboOption | null) => void;
  load: (q: string) => Promise<ComboOption[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  creatable?: boolean;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cache = useRef(new Map<string, ComboOption[]>());
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const hit = cache.current.get(q);
    if (hit) {
      setOptions(hit);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(
      async () => {
        try {
          const res = (await loadRef.current(q)).slice(0, COMBO_LIMIT);
          if (cancelled) return;
          cache.current.set(q, res);
          setOptions(res);
          setError(false);
        } catch {
          if (!cancelled) setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      // buka pertama kali langsung, ketikan berikutnya di-debounce
      q ? DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query]);

  const changeOpen = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    if (next) {
      // data bisa berubah antar pembukaan (mis. part baru tersimpan)
      cache.current.clear();
    } else setQuery("");
  };

  const pick = (o: ComboOption | null) => {
    onSelect(o);
    changeOpen(false);
  };

  const typed = query.trim();
  const showCreate =
    creatable && typed && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={changeOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid}
          disabled={disabled}
          title={selected?.label}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          onKeyDown={(e) => {
            // mengetik di trigger langsung membuka pencarian
            if (open || disabled || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.length === 1 && e.key !== " ") {
              e.preventDefault();
              changeOpen(true);
              setQuery(e.key);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              changeOpen(true);
            }
          }}
        >
          <span className={cn("block min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          {clearable && selected && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Kosongkan"
              className="-mr-1 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(null);
              }}
            >
              <XIcon className="size-3.5" />
            </span>
          ) : (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-auto min-w-[max(var(--radix-popover-trigger-width),16rem)] max-w-[min(28rem,calc(100vw_-_1rem))] p-0"
      >
        <CommandPrimitive
          data-slot="command"
          shouldFilter={false}
          loop
          className="flex w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground"
        >
          <div data-slot="command-input-wrapper" className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
              data-slot="command-input"
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              className="flex h-9 w-full min-w-0 bg-transparent py-2 text-sm outline-hidden placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Memuat" />}
          </div>
          <CommandList
            id={listId}
            className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)_-_4.5rem))] overscroll-contain p-1"
          >
            {showCreate && (
              <CommandItem value={`__create__${typed}`} onSelect={() => pick({ value: typed, label: typed })}>
                <PlusIcon />
                <span className="min-w-0 flex-1 break-words">
                  Gunakan <span className="font-medium">&ldquo;{typed}&rdquo;</span>
                </span>
              </CommandItem>
            )}
            {options.map((o) => {
              const active = selected?.value === o.value;
              return (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => pick(o)}
                  title={o.description ? `${o.label}\n${o.description}` : o.label}
                  className="items-start pr-8"
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block break-words [overflow-wrap:anywhere]", active && "font-medium")}>
                      {o.label}
                    </span>
                    {o.description && (
                      <span className="line-clamp-2 text-xs wrap-break-word text-muted-foreground">{o.description}</span>
                    )}
                  </span>
                  {active && <CheckIcon className="absolute top-2 right-2" />}
                </CommandItem>
              );
            })}
            {!loading && !options.length && !showCreate && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {error ? "Gagal memuat data. Coba lagi." : emptyText}
              </p>
            )}
          </CommandList>
          {options.length >= COMBO_LIMIT && (
            <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
              Menampilkan {COMBO_LIMIT} teratas — ketik untuk mempersempit.
            </p>
          )}
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}
