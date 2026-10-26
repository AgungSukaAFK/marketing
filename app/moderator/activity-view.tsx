"use client";

import { startTransition, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronRight, History, RefreshCw, Search, Trash2, X } from "lucide-react";
import { listActivity } from "@/app/actions/activity";
import { Content } from "@/components/content";
import { CustomPagination } from "@/components/custom-pagination";
import { FilterPanel, type ActiveFilter } from "@/components/filter-panel";
import { DatePicker } from "@/components/form/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectGroup,
  SearchableSelectItem,
  SearchableSelectLabel,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_GROUPS,
  ENTITY_OPTIONS,
  describeDevice,
  entityLabel,
  fmtWIBParts,
  summarize,
  type ActivityAction,
  type ActivityRow,
} from "@/lib/activity-meta";
import { fmtDay, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActionBadge, ActorCell, type ActivityFilters } from "./activity-cells";
import { ActivityDetailDialog } from "./activity-detail";
import { PurgeDialog } from "./activity-purge";
import type { ModUser, Tenant } from "./moderator-view";

const ALL = "__all__";

export function ActivityView({
  users,
  tenants,
  initial,
}: {
  users: ModUser[];
  tenants: Tenant[];
  initial?: ActivityFilters;
}) {
  const [filters, setFilters] = useState<ActivityFilters>(initial ?? {});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initial?.q ?? "");
  const [data, setData] = useState<{ rows: ActivityRow[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  const tenantName = useMemo(() => new Map(tenants.map((t) => [t.id, t.name])), [tenants]);
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  // Muat ulang saat filter / halaman berubah; konten lama tetap tampil (redup) selama memuat
  useEffect(() => {
    const n = ++seq.current;
    const { record, ...rest } = filters;
    start(async () => {
      const res = await listActivity({ ...rest, record: record ? { entity: record.entity, id: record.id } : null, page });
      if (n !== seq.current) return;
      startTransition(() => {
        if (res.ok) {
          setData(res.data!);
          setError(null);
        } else setError(res.error);
      });
    });
  }, [filters, page, reload]);

  // Ketikan pencarian diterapkan setelah berhenti mengetik
  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim() || undefined;
      if (q === (filters.q ?? undefined)) return;
      setFilters((f) => ({ ...f, q }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search, filters.q]);

  const patch = (p: Partial<ActivityFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  };

  const actionLabel = (v: string) =>
    v.startsWith("g:")
      ? (ACTIVITY_GROUPS.find((g) => `g:${g.id}` === v)?.label ?? v)
      : (ACTIVITY_ACTIONS[v as ActivityAction]?.label ?? v);

  const active: ActiveFilter[] = [
    filters.actor && { key: "actor", label: "Akun", value: userName.get(filters.actor) ?? "Akun", onRemove: () => patch({ actor: null }) },
    filters.tenant && {
      key: "tenant",
      label: "Company",
      value: filters.tenant === "none" ? "Tanpa company" : (tenantName.get(filters.tenant) ?? "-"),
      onRemove: () => patch({ tenant: null }),
    },
    filters.action && { key: "action", label: "Aksi", value: actionLabel(filters.action), onRemove: () => patch({ action: null }) },
    filters.entity && { key: "entity", label: "Modul", value: entityLabel(filters.entity), onRemove: () => patch({ entity: null }) },
    filters.from && { key: "from", label: "Dari", value: fmtDay(filters.from), onRemove: () => patch({ from: null }) },
    filters.to && { key: "to", label: "Sampai", value: fmtDay(filters.to), onRemove: () => patch({ to: null }) },
  ].filter(Boolean) as ActiveFilter[];

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  const showRecord = (record: NonNullable<ActivityFilters["record"]>) => {
    setSelected(null);
    setSearch("");
    setFilters({ record });
    setPage(1);
  };

  return (
    <>
      <Content
        title="Activity History"
        description="Semua aksi tiap akun: perubahan data (sebelum → sesudah), login & keamanan, import, export, dan download. Waktu dalam WIB."
        cardAction={
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              title="Muat ulang"
              aria-label="Muat ulang"
              onClick={() => setReload((r) => r + 1)}
              disabled={pending}
            >
              <RefreshCw className={cn(pending && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setPurgeOpen(true)}
            >
              <Trash2 /> Hapus Log
            </Button>
          </div>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          {filters.record && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <History className="size-4 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate">
                Riwayat data <span className="font-medium">{filters.record.label ?? filters.record.id}</span>
                <span className="text-muted-foreground"> · {entityLabel(filters.record.entity)}</span>
              </p>
              <Button size="sm" variant="ghost" onClick={() => patch({ record: null })}>
                <X /> Tutup
              </Button>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama data, akun, username, IP, atau ID data…"
              aria-label="Cari activity"
              className="pr-9 pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Hapus pencarian"
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <FilterPanel
            activeFilters={active}
            onReset={() => {
              setSearch("");
              setFilters({});
              setPage(1);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FilterField label="Akun">
                <SearchableSelect value={filters.actor ?? ALL} onValueChange={(v) => patch({ actor: v === ALL ? null : v })}>
                  <SearchableSelectTrigger className="w-full">
                    <SearchableSelectValue />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value={ALL}>Semua akun</SearchableSelectItem>
                    {users.map((u) => (
                      <SearchableSelectItem key={u.id} value={u.id}>
                        {u.name} (@{u.username})
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Company">
                <SearchableSelect value={filters.tenant ?? ALL} onValueChange={(v) => patch({ tenant: v === ALL ? null : v })}>
                  <SearchableSelectTrigger className="w-full">
                    <SearchableSelectValue />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value={ALL}>Semua company</SearchableSelectItem>
                    <SearchableSelectItem value="none">Tanpa company (moderator / belum aktif)</SearchableSelectItem>
                    {tenants.map((t) => (
                      <SearchableSelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Aksi">
                <SearchableSelect value={filters.action ?? ALL} onValueChange={(v) => patch({ action: v === ALL ? null : v })}>
                  <SearchableSelectTrigger className="w-full">
                    <SearchableSelectValue />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value={ALL}>Semua aksi</SearchableSelectItem>
                    {ACTIVITY_GROUPS.map((g) => (
                      <SearchableSelectGroup key={g.id}>
                        <SearchableSelectLabel>{g.label}</SearchableSelectLabel>
                        <SearchableSelectItem value={`g:${g.id}`}>Semua {g.label.toLowerCase()}</SearchableSelectItem>
                        {(Object.keys(ACTIVITY_ACTIONS) as ActivityAction[])
                          .filter((a) => ACTIVITY_ACTIONS[a].group === g.id)
                          .map((a) => (
                            <SearchableSelectItem key={a} value={a}>
                              {ACTIVITY_ACTIONS[a].label}
                            </SearchableSelectItem>
                          ))}
                      </SearchableSelectGroup>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Modul">
                <SearchableSelect value={filters.entity ?? ALL} onValueChange={(v) => patch({ entity: v === ALL ? null : v })}>
                  <SearchableSelectTrigger className="w-full">
                    <SearchableSelectValue />
                  </SearchableSelectTrigger>
                  <SearchableSelectContent>
                    <SearchableSelectItem value={ALL}>Semua modul</SearchableSelectItem>
                    {ENTITY_OPTIONS.map((o) => (
                      <SearchableSelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SearchableSelectItem>
                    ))}
                  </SearchableSelectContent>
                </SearchableSelect>
              </FilterField>
              <FilterField label="Dari tanggal">
                <DatePicker value={filters.from ?? ""} onChange={(v) => patch({ from: v || null })} minYear={2020} />
              </FilterField>
              <FilterField label="Sampai tanggal">
                <DatePicker value={filters.to ?? ""} onChange={(v) => patch({ to: v || null })} minYear={2020} />
              </FilterField>
            </div>
          </FilterPanel>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div
            aria-busy={pending}
            className={cn("overflow-hidden rounded-md border transition-opacity duration-200", pending && "pointer-events-none opacity-60")}
          >
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {["Waktu (WIB)", "Akun", "Company", "Aksi", "Modul", "Data / Keterangan", "IP & Perangkat", ""].map((h, i) => (
                    <TableHead key={i} className="text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((r) => {
                  const when = fmtWIBParts(r.created_at);
                  const note = summarize(r);
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="text-xs whitespace-nowrap tabular-nums">
                        <p>{when.date}</p>
                        <p className="text-muted-foreground">{when.time}</p>
                      </TableCell>
                      <TableCell className="max-w-48">
                        <ActorCell row={r} />
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm">
                        {r.tenant_id ? (tenantName.get(r.tenant_id) ?? "Company terhapus") : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={r.action} />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{entityLabel(r.entity)}</TableCell>
                      <TableCell className="max-w-72 min-w-48">
                        <p className="truncate font-medium">{r.label ?? <span className="text-muted-foreground">-</span>}</p>
                        {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
                      </TableCell>
                      <TableCell className="max-w-48 text-xs">
                        <p className="truncate font-mono">{r.ip || "-"}</p>
                        <p className="truncate text-muted-foreground">{describeDevice(r.user_agent) ?? "-"}</p>
                      </TableCell>
                      <TableCell className="w-10">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Detail"
                          aria-label="Detail"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r);
                          }}
                        >
                          <ChevronRight />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data && !data.rows.length && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                      {active.length || filters.q || filters.record ? "Tidak ada aktivitas yang cocok dengan filter" : "Belum ada aktivitas tercatat"}
                    </TableCell>
                  </TableRow>
                )}
                {!data && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                      {error ? "-" : "Memuat activity history…"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-xs text-muted-foreground tabular-nums">
              {total ? `Menampilkan ${fmtNumber(from)}–${fmtNumber(to)} dari ${fmtNumber(total)} aktivitas` : "0 aktivitas"}
            </p>
            <div className="sm:ml-auto">
              <CustomPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </Content>

      <ActivityDetailDialog
        row={selected}
        tenantName={selected?.tenant_id ? (tenantName.get(selected.tenant_id) ?? null) : null}
        onClose={() => setSelected(null)}
        onShowRecord={showRecord}
        onShowActor={(actor) => {
          setSelected(null);
          setSearch("");
          setFilters({ actor });
          setPage(1);
        }}
      />
      <PurgeDialog open={purgeOpen} onOpenChange={setPurgeOpen} onPurged={() => setReload((r) => r + 1)} />
    </>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
