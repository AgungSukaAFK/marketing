"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, FileSpreadsheet, Loader2, RotateCw, Search, TableProperties } from "lucide-react";
import { loadDrill } from "@/app/actions/insights";
import { CustomPagination } from "@/components/custom-pagination";
import { StatusBadge } from "@/components/entity/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportExcel } from "@/lib/export";
import { fmtDay, fmtNumber, fmtPercent, fmtRupiah } from "@/lib/format";
import { DRILL_MAX_ROWS, DRILL_MODULE, type DrillCell, type DrillColumn, type DrillResult } from "@/lib/insights/drill";
import { rangeLabel } from "@/lib/period";
import { cn } from "@/lib/utils";
import { useInsights, type DrillOpen } from "./provider";

const PAGE_SIZE = 25;
const NUMERIC = new Set<DrillColumn["kind"]>(["money", "number", "percent", "days"]);

const WIB_DATETIME = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function fmtDays(v: number, header: string) {
  if (v === 0) return header === "Sisa" ? "Hari ini" : "0 hari";
  return `${fmtNumber(Math.abs(v))} hari`;
}

function formatCell(col: DrillColumn, v: DrillCell): string {
  if (v == null || v === "") return "-";
  switch (col.kind) {
    case "money":
      return fmtRupiah(v);
    case "number":
      return fmtNumber(v);
    case "percent":
      return fmtPercent(Number(v));
    case "date":
      return fmtDay(String(v));
    case "datetime":
      return WIB_DATETIME.format(new Date(String(v)));
    case "days":
      return fmtDays(Number(v), col.header);
    default:
      return String(v);
  }
}

export function DrillDialog({ request, onClose }: { request: DrillOpen | null; onClose: () => void }) {
  const { viewer, filter } = useInsights();
  // hasil per permintaan (cache sesi) → buka ulang modal yang sama instan
  const [results, setResults] = useState<Record<string, DrillResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const q = useDeferredValue(query);

  const range = request?.range ?? filter.period.range;
  const payload = request
    ? {
        kind: request.kind,
        from: range.from,
        to: range.to,
        sales: request.sales === undefined ? filter.sales : request.sales,
        filter: request.filter,
      }
    : null;
  const key = payload ? JSON.stringify(payload) : "";

  // reset tampilan setiap permintaan baru
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setQuery("");
    setSort(null);
    setPage(1);
  }

  const data: DrillResult | undefined = results[key];
  const error = errors[key];
  const loaded = !!data;

  useEffect(() => {
    if (!payload || loaded) return;
    let alive = true;
    loadDrill(payload).then((res) => {
      if (!alive) return;
      if (res.ok && res.data) setResults((r) => ({ ...r, [key]: res.data! }));
      else setErrors((e) => ({ ...e, [key]: res.ok ? "Gagal memuat data" : res.error }));
    });
    return () => {
      alive = false;
    };
    // payload diturunkan dari key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded, reload]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    let list = needle
      ? data.rows.filter((r) =>
          data.columns.some((c) => {
            const hit = (k: string) => String(r.cells[k] ?? "").toLowerCase().includes(needle);
            return hit(c.key) || (c.sub ? hit(c.sub) : false);
          }),
        )
      : data.rows;
    if (sort) {
      const col = data.columns.find((c) => c.key === sort.key);
      const numeric = col && NUMERIC.has(col.kind);
      list = [...list].sort((a, b) => {
        const x = a.cells[sort.key];
        const y = b.cells[sort.key];
        const d = numeric ? Number(x ?? 0) - Number(y ?? 0) : String(x ?? "").localeCompare(String(y ?? ""), "id");
        return sort.desc ? -d : d;
      });
    }
    return list;
  }, [data, q, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const mod = request ? DRILL_MODULE[request.kind] : null;
  const canOpenModule = mod && viewer.menus.includes(mod.menu);
  const salesName = payload?.sales ? filter.people.find((p) => p.id === payload.sales)?.name : null;

  const toggleSort = (col: DrillColumn) => {
    setPage(1);
    setSort((s) => {
      const firstDesc = NUMERIC.has(col.kind) || col.kind === "date" || col.kind === "datetime";
      if (!s || s.key !== col.key) return { key: col.key, desc: firstDesc };
      if (s.desc === firstDesc) return { key: col.key, desc: !firstDesc };
      return null;
    });
  };

  const doExport = async () => {
    if (!data || !request) return;
    setExporting(true);
    try {
      await exportExcel(
        rows.map((r) =>
          Object.fromEntries(
            data.columns.flatMap((c) => {
              const main: [string, unknown] = [c.header, NUMERIC.has(c.kind) ? (r.cells[c.key] ?? null) : formatCell(c, r.cells[c.key])];
              return c.sub ? [main, [`${c.header} (detail)`, r.cells[c.sub] ?? ""]] : [main];
            }),
          ),
        ),
        request.title.replace(/[^\w-]+/g, "_"),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] flex-col gap-4 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="gap-1 border-b px-5 pt-5 pb-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <TableProperties className="size-4 text-muted-foreground" />
            {request?.title}
          </DialogTitle>
          <DialogDescription>
            {[request?.subtitle, rangeLabel(range), salesName ? `Sales ${salesName}` : null].filter(Boolean).join(" · ")}
            {data ? ` · ${fmtNumber(Math.min(data.total, DRILL_MAX_ROWS))}${data.total > DRILL_MAX_ROWS ? "+" : ""} baris` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-5">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari di tabel…"
              className="pl-9"
              aria-label="Cari di tabel"
            />
          </div>
          <Button variant="outline" size="sm" onClick={doExport} disabled={!rows.length || exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Excel
          </Button>
          {canOpenModule && (
            <Link href={mod.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink />
              Buka di modul
            </Link>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5">
          {!data && !error ? (
            <div className="space-y-2 pb-5" aria-busy="true">
              <Skeleton className="h-9 w-full" />
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full opacity-70" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setErrors((e) => {
                    const next = { ...e };
                    delete next[key];
                    return next;
                  });
                  setReload((n) => n + 1);
                }}
              >
                <RotateCw />
                Coba lagi
              </Button>
            </div>
          ) : data && !rows.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {data.rows.length ? "Tidak ada yang cocok dengan pencarian" : "Tidak ada data di periode ini"}
            </p>
          ) : data ? (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  {data.columns.map((c) => {
                    const active = sort?.key === c.key;
                    const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
                    const right = NUMERIC.has(c.kind);
                    return (
                      <TableHead
                        key={c.key}
                        className={cn("text-muted-foreground", right && "text-right")}
                        aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            right && "flex-row-reverse",
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
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    {data.columns.map((c, i) => {
                      const v = r.cells[c.key];
                      const text = formatCell(c, v);
                      const sub = c.sub ? r.cells[c.sub] : null;
                      const body =
                        c.kind === "badge" && v ? (
                          <StatusBadge value={String(v)} />
                        ) : (
                          <span
                            className={cn(
                              "block max-w-72 truncate",
                              c.kind === "mono" && "font-mono text-xs",
                              NUMERIC.has(c.kind) && "tabular-nums",
                            )}
                            title={text}
                          >
                            {text}
                          </span>
                        );
                      return (
                        <TableCell key={c.key} className={cn("align-top", NUMERIC.has(c.kind) && "text-right")}>
                          {i === 0 && r.href ? (
                            <Link href={r.href} className="text-primary underline-offset-4 hover:underline">
                              {body}
                            </Link>
                          ) : (
                            body
                          )}
                          {sub != null && sub !== "" && (
                            <span className="block max-w-72 truncate text-xs text-muted-foreground" title={String(sub)}>
                              {String(sub)}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
              {data.totals.length > 0 && (
                <TableFooter className="sticky bottom-0 bg-muted">
                  <TableRow className="hover:bg-transparent">
                    {data.columns.map((c, i) => (
                      <TableCell key={c.key} className={cn("font-medium", NUMERIC.has(c.kind) && "text-right tabular-nums")}>
                        {data.totals.includes(c.key)
                          ? formatCell(c, rows.reduce((a, r) => a + Number(r.cells[c.key] ?? 0), 0))
                          : i === 0
                            ? `Total (${fmtNumber(rows.length)})`
                            : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2 border-t px-5 py-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {data && data.total > DRILL_MAX_ROWS
              ? `Menampilkan ${fmtNumber(DRILL_MAX_ROWS)} baris pertama — buka modul untuk data lengkap`
              : rows.length
                ? `${fmtNumber((current - 1) * PAGE_SIZE + 1)}–${fmtNumber(Math.min(current * PAGE_SIZE, rows.length))} dari ${fmtNumber(rows.length)}`
                : ""}
          </p>
          <div>
            <CustomPagination currentPage={current} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
