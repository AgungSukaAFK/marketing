"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { CustomPagination } from "@/components/custom-pagination";
import { FilterPanel, type ActiveFilter } from "@/components/filter-panel";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Filter pilihan (dropdown) di FilterPanel — dicocokkan persis dengan nilai baris. */
export type TableFilter<T> = {
  /** Nama param URL, mis. "status". */
  key: string;
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string | null | undefined;
  /** pencocokan kustom (mis. "salah satu barang berstatus X"); default: get(row) === nilai */
  match?: (row: T, value: string) => boolean;
};

/** meta kolom TanStack: rata kanan untuk angka/uang/persen. */
export type ColumnMeta = { align?: "right" };

const ALL = "__all__";
const RESERVED = new Set(["q", "sort", "page"]);

/**
 * State tabel (cari, filter, sort, halaman) disimpan di URL search params
 * supaya bisa di-refresh & dibagikan. Data sudah ada di klien, jadi URL cukup
 * diganti lewat history.replaceState — tanpa request ulang ke server
 * (Next.js menyinkronkan useSearchParams dengan history native).
 */
function useTableParams() {
  const params = useSearchParams();
  const set = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  return { params, set };
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  // > ~7 opsi pakai SearchableSelect (styling-guide §8)
  if (options.length > 7) {
    return (
      <SearchableSelect value={value || ALL} onValueChange={onChange}>
        <SearchableSelectTrigger className="w-full">
          <SearchableSelectValue />
        </SearchableSelectTrigger>
        <SearchableSelectContent>
          <SearchableSelectItem value={ALL}>Semua</SearchableSelectItem>
          {options.map((o) => (
            <SearchableSelectItem key={o.value} value={o.value}>
              {o.label}
            </SearchableSelectItem>
          ))}
        </SearchableSelectContent>
      </SearchableSelect>
    );
  }
  return (
    <Select value={value || ALL} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Semua</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Tabel list standar: Cari → FilterPanel → Table → Pagination. */
export function DataTable<T>({
  columns,
  data,
  pageSize = 20,
  filters = [],
  searchPlaceholder = "Cari…",
  emptyText = "Belum ada data",
  className,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  pageSize?: number;
  filters?: TableFilter<T>[];
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const { params, set } = useTableParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filterValues = Object.fromEntries(
    filters.filter((f) => !RESERVED.has(f.key)).map((f) => [f.key, params.get(f.key) ?? ""]),
  );
  // nilai input dipegang lokal supaya kursor tidak lompat saat mengetik
  const [search, setSearch] = useState(q);

  const filtered = useMemo(
    () =>
      data.filter((row) =>
        filters.every(
          (f) =>
            !filterValues[f.key] ||
            (f.match ? f.match(row, filterValues[f.key]) : (f.get(row) ?? "") === filterValues[f.key]),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filters, JSON.stringify(filterValues)],
  );

  const [sortKey, sortDir] = sort.split(".");
  const sorting: SortingState =
    sortKey && columns.some((c) => c.id === sortKey && c.enableSorting !== false)
      ? [{ id: sortKey, desc: sortDir === "desc" }]
      : [];

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: q, pagination: { pageIndex: page - 1, pageSize } },
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const total = table.getFilteredRowModel().rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const from = total ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(currentPage * pageSize, total);

  const activeFilters: ActiveFilter[] = filters
    .filter((f) => filterValues[f.key])
    .map((f) => ({
      key: f.key,
      label: f.label,
      value: f.options.find((o) => o.value === filterValues[f.key])?.label ?? filterValues[f.key],
      onRemove: () => set({ [f.key]: undefined }),
    }));

  const resetAll = () => {
    setSearch("");
    set({ q: undefined, ...Object.fromEntries(filters.map((f) => [f.key, undefined])) });
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            set({ q: e.target.value || undefined });
          }}
          placeholder={searchPlaceholder}
          aria-label="Cari"
          className="pr-9 pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              set({ q: undefined });
            }}
            aria-label="Hapus pencarian"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filters.length > 0 && (
        <FilterPanel activeFilters={activeFilters} onReset={resetAll}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filters.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <FilterSelect
                  value={filterValues[f.key]}
                  options={f.options}
                  onChange={(v) => set({ [f.key]: v === ALL ? undefined : v })}
                />
              </div>
            ))}
          </div>
        </FilterPanel>
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const right = (h.column.columnDef.meta as ColumnMeta | undefined)?.align === "right";
                  const label = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext());
                  return h.column.getCanSort() ? (
                    <SortableTableHead
                      key={h.id}
                      sortKey={h.column.id}
                      currentSort={sorting.length ? sort : ""}
                      onSortChange={(v) => set({ sort: v }, false)}
                      className={cn("text-muted-foreground", right && "text-right")}
                    >
                      {label}
                    </SortableTableHead>
                  ) : (
                    <TableHead key={h.id} className={cn("text-muted-foreground", right && "text-right")}>
                      {label}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        (cell.column.columnDef.meta as ColumnMeta | undefined)?.align === "right" && "text-right",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  {data.length ? "Tidak ada data yang cocok dengan pencarian/filter" : emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-xs text-muted-foreground tabular-nums">
          {total ? `Menampilkan ${from}–${to} dari ${total} data` : "0 data"}
        </p>
        <div className="sm:ml-auto">
          <CustomPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => set({ page: p > 1 ? String(p) : undefined }, false)}
          />
        </div>
      </div>
    </div>
  );
}
