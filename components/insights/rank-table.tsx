"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type RankColumn<T> = {
  key: string;
  header: string;
  /** nilai untuk sort */
  value: (row: T) => number | string | null;
  render?: (row: T) => React.ReactNode;
  numeric?: boolean;
  className?: string;
};

/** Tabel peringkat kecil: klik header untuk sort, klik baris untuk drill-down. */
export function RankTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  onRow,
  highlight,
  limit,
  empty = "Belum ada data di periode ini",
}: {
  rows: T[];
  columns: RankColumn<T>[];
  rowKey: (row: T) => string;
  defaultSort: string;
  onRow?: (row: T) => void;
  highlight?: (row: T) => boolean;
  limit?: number;
  empty?: string;
}) {
  const [sort, setSort] = useState({ key: defaultSort, desc: true });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "id");
      return sort.desc ? -d : d;
    });
  }, [rows, columns, sort]);
  const shown = limit ? sorted.slice(0, limit) : sorted;

  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;

  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 text-muted-foreground">#</TableHead>
          {columns.map((c) => {
            const active = sort.key === c.key;
            const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
            return (
              <TableHead key={c.key} className={cn("text-muted-foreground", c.numeric && "text-right", c.className)} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
                <button
                  type="button"
                  onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: !!c.numeric }))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    c.numeric && "flex-row-reverse",
                    active && "text-foreground",
                  )}
                >
                  {c.header}
                  <Icon className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((r, i) => (
          <TableRow
            key={rowKey(r)}
            onClick={onRow ? () => onRow(r) : undefined}
            onKeyDown={onRow ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRow(r)) : undefined}
            tabIndex={onRow ? 0 : undefined}
            className={cn(onRow && "cursor-pointer focus-visible:bg-accent focus-visible:outline-none", highlight?.(r) && "bg-accent/60")}
          >
            <TableCell>
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
            </TableCell>
            {columns.map((c) => (
              <TableCell key={c.key} className={cn(c.numeric && "text-right tabular-nums", c.className)}>
                {c.render ? c.render(r) : String(c.value(r) ?? "-")}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
