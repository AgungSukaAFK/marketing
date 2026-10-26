"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Gauge,
  GripVertical,
  History,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { movePipelineStage } from "@/app/actions/entity";
import { Content } from "@/components/content";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/entity/status-badge";
import { useEntityCrud } from "@/components/entity/use-entity-crud";
import {
  canModify,
  type EntityLookups,
  type Me,
} from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PIPELINE_STAGES,
  PROGRESS_RANGES,
  stageProgress,
} from "@/lib/constants";
import {
  fmtDateTime,
  fmtJuta,
  fmtNumber,
  fmtPercent,
  toNumber,
} from "@/lib/format";
import type { Row } from "@/lib/entities";
import { cn } from "@/lib/utils";

type View = "list" | "board";
type HistoryEntry = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
};

const DAY = 86_400_000;

/** Riwayat terurut lama → baru. */
const historyOf = (r: Row): HistoryEntry[] =>
  [...((r.history as HistoryEntry[] | undefined) ?? [])].sort((a, b) =>
    a.changed_at.localeCompare(b.changed_at),
  );

/** Kapan deal masuk ke stage-nya sekarang. */
function enteredAt(r: Row) {
  const h = historyOf(r).findLast((e) => e.to_stage === r.stage);
  return h?.changed_at ?? r.created_at;
}

function fmtDuration(ms: number) {
  const d = Math.floor(ms / DAY);
  if (d < 1) return "< 1 hari";
  if (d < 30) return `${d} hari`;
  const m = Math.floor(d / 30);
  return `${m} bulan${d % 30 ? ` ${d % 30} hari` : ""}`;
}

export function PipelineBoard({
  rows,
  lookups,
  me,
}: {
  rows: Row[];
  lookups: EntityLookups;
  me: Me;
}) {
  const router = useRouter();
  const crud = useEntityCrud({ entity: "pipeline", rows, lookups, me });
  const [, start] = useTransition();
  const [view, setView] = useState<View>("list");
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [rangeFilter, setRangeFilter] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  // acuan "sekarang" untuk durasi di stage; cukup diambil sekali per mount
  const [now] = useState(() => Date.now());
  const [items, moveOptimistic] = useOptimistic(
    rows,
    (state, { id, stage }: { id: string; stage: string }) =>
      state.map((r) =>
        r.id === id
          ? {
              ...r,
              stage,
              history: [
                ...((r.history as HistoryEntry[] | undefined) ?? []),
                {
                  id: "pending",
                  from_stage: r.stage,
                  to_stage: stage,
                  changed_by: me.id,
                  changed_at: new Date().toISOString(),
                },
              ],
            }
          : r,
      ),
  );

  const userName = (id: string | null | undefined) =>
    lookups.profiles.find((p) => p.id === id)?.username ?? "-";

  const range = PROGRESS_RANGES.find((x) => x.id === rangeFilter);
  const inRange = (stage: string) =>
    !range ||
    (stageProgress(stage) >= range.min && stageProgress(stage) <= range.max);
  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((r) =>
      [
        r.customer?.customer_code,
        r.customer?.pt,
        r.kategori,
        userName(r.sales_id),
      ].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(s),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q]);
  const filtered = searched.filter(
    (r) => (!stageFilter || r.stage === stageFilter) && inRange(r.stage),
  );
  const visibleStages = PIPELINE_STAGES.filter(
    (s) => (!stageFilter || s === stageFilter) && inRange(s),
  );

  const total = filtered.reduce((a, r) => a + toNumber(r.value), 0);
  const won = filtered.filter((r) => r.stage === "Good Receive").length;
  const rate = filtered.length ? (won / filtered.length) * 100 : 0;
  const weighted = filtered.reduce(
    (a, r) => a + (toNumber(r.value) * stageProgress(r.stage)) / 100,
    0,
  );
  const avgProgress = filtered.length
    ? filtered.reduce((a, r) => a + stageProgress(r.stage), 0) / filtered.length
    : 0;

  const move = (id: string, stage: string) => {
    const row = items.find((r) => r.id === id);
    if (!row || row.stage === stage || !canModify(me, row)) return;
    start(async () => {
      moveOptimistic({ id, stage });
      const res = await movePipelineStage(id, stage);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  };

  const historyRow = items.find((r) => r.id === historyId);
  const shared = { me, now, userName, move, openHistory: setHistoryId, crud };

  return (
    <>
      <StatCard
        label="Total Value"
        value={fmtJuta(total)}
        hint={`${fmtNumber(filtered.length)} deal`}
        icon={Wallet}
      />
      <StatCard
        label="Weighted Value"
        value={fmtJuta(weighted)}
        hint="Value × progress"
        icon={TrendingUp}
      />
      <StatCard
        label="Rata-rata Progress"
        value={fmtPercent(avgProgress)}
        icon={Gauge}
      />
      <StatCard
        label="Win Rate"
        value={fmtPercent(rate)}
        hint={`${won} deal good receive`}
        icon={Trophy}
      />

      <Content
        title={crud.def.title}
        description="Progress tiap deal mengikuti stage-nya. Klik step untuk memindahkan deal."
        cardAction={
          <Button size="sm" onClick={crud.openCreate}>
            <Plus /> Tambah Deal
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                <TabsTrigger value="list">
                  <List /> List
                </TabsTrigger>
                <TabsTrigger value="board">
                  <LayoutGrid /> Board
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative sm:ml-auto sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari customer, produk, sales…"
                aria-label="Cari"
                className="pl-9"
              />
            </div>
          </div>

          <FilterChips
            label="Stage"
            value={stageFilter}
            onChange={setStageFilter}
            options={PIPELINE_STAGES.map((s) => ({
              id: s,
              label: `${s} · ${stageProgress(s)}%`,
              count: searched.filter((r) => r.stage === s && inRange(s)).length,
            }))}
            total={searched.filter((r) => inRange(r.stage)).length}
          />
          <FilterChips
            label="Progress"
            value={rangeFilter}
            onChange={setRangeFilter}
            options={PROGRESS_RANGES.map((x) => ({
              id: x.id,
              label: x.label,
              count: searched.filter(
                (r) =>
                  (!stageFilter || r.stage === stageFilter) &&
                  stageProgress(r.stage) >= x.min &&
                  stageProgress(r.stage) <= x.max,
              ).length,
            }))}
            total={
              searched.filter((r) => !stageFilter || r.stage === stageFilter)
                .length
            }
          />

          {view === "list" ? (
            <ListView rows={filtered} empty={!items.length} {...shared} />
          ) : (
            <BoardView rows={filtered} stages={visibleStages} {...shared} />
          )}
        </div>
      </Content>

      <HistoryDialog
        row={historyRow}
        now={now}
        userName={userName}
        onClose={() => setHistoryId(null)}
      />
      {crud.dialogs}
    </>
  );
}

type Shared = {
  me: Me;
  now: number;
  userName: (id: string | null | undefined) => string;
  move: (id: string, stage: string) => void;
  openHistory: (id: string) => void;
  crud: ReturnType<typeof useEntityCrud>;
};

function FilterChips({
  label,
  value,
  onChange,
  options,
  total,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { id: string; label: string; count: number }[];
  total: number;
}) {
  const chip = (id: string | null, text: string, count: number) => {
    const active = value === id;
    return (
      <button
        key={id ?? "all"}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(id)}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {text}
        <span
          className={cn(
            "tabular-nums",
            active ? "opacity-80" : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {chip(null, "Semua", total)}
        {options.map((o) => chip(o.id, o.label, o.count))}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          value >= 100 ? "bg-emerald-500" : "bg-primary",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/** Stepper 8 stage. Bila editable, tiap step bisa diklik untuk memindahkan deal. */
function Stepper({
  stage,
  editable,
  onMove,
}: {
  stage: string;
  editable: boolean;
  onMove: (s: string) => void;
}) {
  const cur = PIPELINE_STAGES.indexOf(
    stage as (typeof PIPELINE_STAGES)[number],
  );
  return (
    <ol className="grid grid-cols-8" aria-label="Tahapan deal">
      {PIPELINE_STAGES.map((s, i) => {
        const done = i < cur;
        const current = i === cur;
        const title = `${s} · ${stageProgress(s)}%${editable && !current ? " — klik untuk pindah" : ""}`;
        return (
          <li
            key={s}
            className="relative flex flex-col items-center gap-1"
            aria-current={current ? "step" : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3 right-1/2 h-0.5 w-full",
                  i <= cur ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <button
              type="button"
              disabled={!editable || current}
              onClick={() => onMove(s)}
              title={title}
              aria-label={title}
              className={cn(
                "relative z-10 flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                current &&
                  "border-primary bg-background text-primary ring-3 ring-primary/20",
                !done && !current && "bg-background text-muted-foreground",
                editable &&
                  !current &&
                  "cursor-pointer hover:border-primary hover:text-primary",
                done &&
                  editable &&
                  "hover:bg-primary/85 hover:text-primary-foreground",
                "disabled:cursor-default",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </button>
            <span
              className={cn(
                "hidden text-center text-[10px] leading-tight md:block",
                current
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RowActions({
  r,
  me,
  openHistory,
  crud,
}: { r: Row } & Pick<Shared, "me" | "openHistory" | "crud">) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => openHistory(r.id)}
        aria-label="Riwayat"
        title="Riwayat"
      >
        <History />
      </Button>
      {canModify(me, r) && (
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => crud.openEdit(r)}
            aria-label="Edit"
            title="Edit"
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => crud.askDelete(r)}
            aria-label="Hapus"
            title="Hapus"
          >
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );
}

function ListView({
  rows,
  empty,
  me,
  now,
  userName,
  move,
  openHistory,
  crud,
}: Shared & { rows: Row[]; empty: boolean }) {
  if (!rows.length) {
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        {empty
          ? "Belum ada deal"
          : "Tidak ada deal yang cocok dengan pencarian/filter"}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const progress = stageProgress(r.stage);
        const step = PIPELINE_STAGES.indexOf(r.stage) + 1;
        const since = enteredAt(r);
        const last = historyOf(r).at(-1);
        return (
          <article
            key={r.id}
            className="space-y-3 rounded-lg border bg-card p-3 shadow-xs sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-primary">
                    {r.customer?.customer_code}
                  </span>
                  <StatusBadge value={r.stage} />
                </div>
                <div className="truncate font-semibold" title={r.customer?.pt}>
                  {r.customer?.pt}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.kategori || "-"} · {userName(r.sales_id)}
                </div>
              </div>
              <div className="flex items-end justify-between gap-4 sm:w-56 sm:flex-col sm:items-stretch sm:gap-1.5">
                <div className="sm:flex sm:items-baseline sm:justify-between">
                  <div className="text-sm font-semibold tabular-nums">
                    {fmtJuta(r.value)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Step {step}/{PIPELINE_STAGES.length}
                  </div>
                </div>
                <div className="flex w-40 items-center gap-2 sm:w-auto">
                  <ProgressBar value={progress} className="flex-1" />
                  <span className="w-9 text-right text-xs font-semibold tabular-nums">
                    {progress}%
                  </span>
                </div>
              </div>
            </div>

            <Stepper
              stage={r.stage}
              editable={canModify(me, r)}
              onMove={(s) => move(r.id, s)}
            />

            <div className="flex items-center gap-2 border-t pt-2">
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                Di{" "}
                <span className="font-medium text-foreground">{r.stage}</span>{" "}
                selama {fmtDuration(now - new Date(since).getTime())}
                {last && <> · terakhir diubah {userName(last.changed_by)}</>}
              </p>
              <RowActions r={r} me={me} openHistory={openHistory} crud={crud} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BoardView({
  rows,
  stages,
  me,
  now,
  userName,
  move,
  openHistory,
  crud,
}: Shared & { rows: Row[]; stages: readonly string[] }) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const onDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOver(null);
    move(e.dataTransfer.getData("text/plain"), stage);
  };

  if (!stages.length) {
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        Tidak ada stage yang cocok dengan filter
      </p>
    );
  }

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <div className="flex min-w-max gap-3">
        {stages.map((stage) => {
          const list = rows.filter((r) => r.stage === stage);
          const sum = list.reduce((a, r) => a + toNumber(r.value), 0);
          return (
            <section
              key={stage}
              aria-label={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={(e) => onDrop(e, stage)}
              className={cn(
                "flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/50 p-2 transition-colors dark:bg-muted/10",
                dragOver === stage && "border-primary bg-primary/5",
              )}
            >
              <header className="space-y-1.5 px-1 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{stage}</h3>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {fmtJuta(sum)} · {stageProgress(stage)}%
                    </p>
                  </div>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-semibold tabular-nums shadow-xs">
                    {list.length}
                  </span>
                </div>
                <ProgressBar value={stageProgress(stage)} className="h-1" />
              </header>
              {list.map((r) => {
                const editable = canModify(me, r);
                return (
                  <article
                    key={r.id}
                    draggable={editable}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", r.id)
                    }
                    className={cn(
                      "space-y-1.5 rounded-md border bg-card p-2.5 text-sm shadow-xs",
                      editable && "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-medium text-primary">
                          {r.customer?.customer_code}
                        </div>
                        <div
                          className="truncate font-medium"
                          title={r.customer?.pt}
                        >
                          {r.customer?.pt}
                        </div>
                      </div>
                      {editable && (
                        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.kategori || "-"}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium tabular-nums">
                        {fmtJuta(r.value)}
                      </span>
                      <span className="text-muted-foreground">
                        {userName(r.sales_id)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtDuration(now - new Date(enteredAt(r)).getTime())} di
                      stage ini
                    </div>
                    <div className="flex items-center gap-1 border-t pt-2">
                      {editable ? (
                        <Select
                          value={r.stage}
                          onValueChange={(v) => move(r.id, v)}
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-7 min-w-0 flex-1 text-xs"
                            aria-label="Ubah stage"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STAGES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s} · {stageProgress(s)}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="flex-1" />
                      )}
                      <RowActions
                        r={r}
                        me={me}
                        openHistory={openHistory}
                        crud={crud}
                      />
                    </div>
                  </article>
                );
              })}
              {!list.length && (
                <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                  Kosong
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function HistoryDialog({
  row,
  now,
  userName,
  onClose,
}: {
  row: Row | undefined;
  now: number;
  userName: (id: string | null | undefined) => string;
  onClose: () => void;
}) {
  const entries = row ? historyOf(row) : [];
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Riwayat Deal</DialogTitle>
          <DialogDescription>
            {row?.customer?.customer_code} · {row?.customer?.pt}
            {row?.kategori ? ` · ${row.kategori}` : ""}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ProgressBar
                value={stageProgress(row.stage)}
                className="flex-1"
              />
              <span className="text-sm font-semibold tabular-nums">
                {stageProgress(row.stage)}%
              </span>
            </div>
            {entries.length ? (
              <ol className="max-h-[60vh] space-y-4 overflow-y-auto border-l pl-5">
                {[...entries].reverse().map((e, i, arr) => {
                  // durasi di stage ini = sampai entri berikutnya (lebih baru), atau sampai sekarang
                  const until =
                    i === 0
                      ? Math.max(now, new Date(e.changed_at).getTime())
                      : new Date(arr[i - 1].changed_at).getTime();
                  const back =
                    e.from_stage &&
                    stageProgress(e.to_stage) < stageProgress(e.from_stage)
                      ? " (mundur)"
                      : "";
                  return (
                    <li key={e.id} className="relative">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-1 -left-6.25 size-2.5 rounded-full border-2 border-background",
                          i === 0 ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                      />
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        {e.from_stage ? (
                          <>
                            <span className="text-muted-foreground">
                              {e.from_stage}
                            </span>
                            <span className="text-muted-foreground">→</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            Deal dibuat di
                          </span>
                        )}
                        <StatusBadge value={e.to_stage} />
                        <span className="text-xs font-semibold tabular-nums">
                          {stageProgress(e.to_stage)}%{back}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDateTime(e.changed_at)} · {userName(e.changed_by)} ·{" "}
                        {fmtDuration(until - new Date(e.changed_at).getTime())}
                        {i === 0 ? " (berjalan)" : ""}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada riwayat.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
