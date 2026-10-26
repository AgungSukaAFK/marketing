"use client";

import { startTransition, useEffect, useState, useTransition } from "react";
import { Check, Copy, History, UserRound } from "lucide-react";
import { getActivityDetail } from "@/app/actions/activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeDevice, entityLabel, fmtWIB, presentMeta, type ActivityRow } from "@/lib/activity-meta";
import type { ActivityDetail, ItemDiff, PresentedChange } from "@/lib/activity-present";
import { fmtNumber } from "@/lib/format";
import { TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ActionBadge, ActorCell, type ActivityFilters } from "./activity-cells";

const OP_LABEL: Record<PresentedChange["op"], { label: string; tone: string }> = {
  INSERT: { label: "Ditambah", tone: TONE.green },
  UPDATE: { label: "Diubah", tone: TONE.blue },
  DELETE: { label: "Dihapus", tone: TONE.red },
};

const ITEM_STATE: Record<ItemDiff["state"], { label: string; tone: string }> = {
  added: { label: "Baru", tone: TONE.green },
  removed: { label: "Dihapus", tone: TONE.red },
  changed: { label: "Berubah", tone: TONE.blue },
  same: { label: "Tetap", tone: TONE.gray },
};

/** Judul daftar perubahan lain dalam satu aksi. */
const RELATED_TITLE: Record<string, string> = {
  delete: "Data terkait yang ikut terhapus",
  import: "Data yang diimport",
  restore: "Data yang direstore",
  reset_data: "Data yang dihapus",
};

/** Data yang tidak punya riwayat per baris */
const NO_RECORD = new Set(["auth", "tenant_data", "insights", "activity_log"]);

export function ActivityDetailDialog({
  row,
  tenantName,
  onClose,
  onShowRecord,
  onShowActor,
}: {
  row: ActivityRow | null;
  tenantName: string | null;
  onClose: () => void;
  onShowRecord: (record: NonNullable<ActivityFilters["record"]>) => void;
  onShowActor: (actorId: string) => void;
}) {
  const [detail, setDetail] = useState<{ id: number; data: ActivityDetail | null; error: string | null } | null>(null);
  const [loading, start] = useTransition();

  // Rincian perubahan dimuat saat dibuka saja (lazy)
  useEffect(() => {
    if (!row) return;
    const id = row.id;
    start(async () => {
      const res = await getActivityDetail(id);
      startTransition(() => setDetail({ id, data: res.ok ? res.data! : null, error: res.ok ? null : res.error }));
    });
  }, [row]);

  const current = row && detail?.id === row.id ? detail : null;
  const meta = presentMeta(row?.meta);
  const device = describeDevice(row?.user_agent);
  const canTrace = !!row?.record_id && !!row.entity && !NO_RECORD.has(row.entity);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="gap-1.5 border-b px-5 pt-5 pb-4 pr-12">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {row && <ActionBadge action={row.action} />}
            <span>{entityLabel(row?.entity)}</span>
            {row?.label && <span className="min-w-0 font-normal text-muted-foreground">· {row.label}</span>}
          </DialogTitle>
          <DialogDescription>{row && fmtWIB(row.created_at)}</DialogDescription>
        </DialogHeader>

        {row && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-5">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Akun">
                  <ActorCell row={row} />
                </Info>
                <Info label="Company">{tenantName ?? (row.tenant_id ? "Company terhapus" : "-")}</Info>
                <Info label="Waktu">{fmtWIB(row.created_at)}</Info>
                <Info label="Alamat IP">
                  <span className="font-mono">{row.ip || "-"}</span>
                </Info>
                <Info label="Perangkat">
                  <p>{device ?? "-"}</p>
                  {row.user_agent && <p className="text-xs break-all text-muted-foreground">{row.user_agent}</p>}
                </Info>
                <Info label="Referensi">
                  {row.record_id ? <CopyText text={row.record_id} /> : "-"}
                  <p className="text-xs text-muted-foreground">Log #{row.id}</p>
                </Info>
              </dl>

              {meta.length > 0 && (
                <Section title="Detail">
                  <dl className="grid gap-x-6 gap-y-2 rounded-md border p-3 text-sm sm:grid-cols-2">
                    {meta.map((m) => (
                      <Info key={m.key} label={m.label}>
                        <span className="break-words">{m.value}</span>
                      </Info>
                    ))}
                  </dl>
                </Section>
              )}

              {loading && !current ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : current?.error ? (
                <p className="text-sm text-destructive">{current.error}</p>
              ) : current?.data ? (
                <Changes row={row} detail={current.data} />
              ) : null}
            </div>
          </div>
        )}

        {row && (canTrace || row.actor_id) && (
          <DialogFooter className="border-t px-5 py-3">
            {row.actor_id && (
              <Button variant="outline" size="sm" onClick={() => onShowActor(row.actor_id!)}>
                <UserRound /> Semua aksi akun ini
              </Button>
            )}
            {canTrace && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShowRecord({ entity: row.entity!, id: row.record_id!, label: row.label })}
              >
                <History /> Riwayat data ini
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Changes({ row, detail }: { row: ActivityRow; detail: ActivityDetail }) {
  const { main, items, related, shown, total } = detail;
  if (!main.length && !items && !related.length) {
    if (["create", "update", "delete"].includes(row.action))
      return <p className="text-sm text-muted-foreground">Rincian perubahan tidak tersedia.</p>;
    return null;
  }
  return (
    <div className="flex flex-col gap-5">
      {main.map((c) => (
        <Section key={c.id} title={main.length > 1 ? `${c.entityLabel} · ${c.label ?? ""}` : "Perubahan data"}>
          <ChangeTable change={c} />
        </Section>
      ))}
      {items && (
        <Section title="Barang quotation">
          <ItemsTable items={items} />
        </Section>
      )}
      {related.length > 0 && (
        <Section title={`${RELATED_TITLE[row.action] ?? "Perubahan lain dalam aksi ini"} (${fmtNumber(related.length)})`}>
          <div className="divide-y rounded-md border">
            {related.map((c) => (
              <details key={c.id} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
                  <Badge variant="outline" className={cn("font-medium", OP_LABEL[c.op].tone)}>
                    {OP_LABEL[c.op].label}
                  </Badge>
                  <span className="shrink-0 text-muted-foreground">{c.entityLabel}</span>
                  <span className="min-w-0 truncate font-medium">{c.label ?? c.recordId ?? "-"}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground group-open:hidden">Lihat</span>
                </summary>
                <div className="px-3 pb-3">
                  <ChangeTable change={c} />
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}
      {shown < total && (
        <p className="text-xs text-muted-foreground">
          Menampilkan {fmtNumber(shown)} dari {fmtNumber(total)} perubahan dalam aksi ini.
        </p>
      )}
    </div>
  );
}

function ChangeTable({ change }: { change: PresentedChange }) {
  const isUpdate = change.op === "UPDATE";
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-48 text-muted-foreground">Field</TableHead>
              {isUpdate ? (
                <>
                  <TableHead className="text-muted-foreground">Sebelum</TableHead>
                  <TableHead className="text-muted-foreground">Sesudah</TableHead>
                </>
              ) : (
                <TableHead className="text-muted-foreground">{change.op === "DELETE" ? "Nilai (dihapus)" : "Nilai"}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {change.fields.map((f) => (
              <TableRow key={f.key} className="hover:bg-transparent">
                <TableCell className="align-top font-medium">{f.label}</TableCell>
                {isUpdate ? (
                  <>
                    <TableCell className="align-top text-muted-foreground">
                      <Value v={f.before} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Value v={f.after} />
                    </TableCell>
                  </>
                ) : (
                  <TableCell className="align-top">
                    <Value v={change.op === "DELETE" ? f.before : f.after} />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!change.fields.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="text-sm text-muted-foreground">
                  Tidak ada kolom yang terisi
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <details className="text-xs">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">Data lengkap (JSON)</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(change.op === "DELETE" ? change.raw.before : change.raw.after, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ItemsTable({ items }: { items: ItemDiff[] }) {
  const heads = items[0]?.cells.map((c) => c.label) ?? [];
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 text-muted-foreground">#</TableHead>
            {heads.map((h) => (
              <TableHead key={h} className="text-muted-foreground">
                {h}
              </TableHead>
            ))}
            <TableHead className="text-muted-foreground">Keterangan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow key={it.position} className={cn("hover:bg-transparent", it.state === "same" && "text-muted-foreground")}>
              <TableCell className="tabular-nums">{it.position}</TableCell>
              {it.cells.map((c) => (
                <TableCell key={c.key} className="align-top">
                  {it.state === "changed" && c.before !== c.after ? (
                    <span className="flex flex-col">
                      <span className="text-xs text-muted-foreground line-through">{c.before ?? "-"}</span>
                      <span className="font-medium">{c.after ?? "-"}</span>
                    </span>
                  ) : it.state === "removed" ? (
                    <span className="line-through">{c.before ?? "-"}</span>
                  ) : (
                    (c.after ?? "-")
                  )}
                </TableCell>
              ))}
              <TableCell>
                <Badge variant="outline" className={cn("font-medium", ITEM_STATE[it.state].tone)}>
                  {ITEM_STATE[it.state].label}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Value({ v }: { v: string | null }) {
  if (v === null) return <span className="text-muted-foreground">-</span>;
  return <span className="block max-h-40 overflow-y-auto break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{v}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0">{children}</dd>
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Salin"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded font-mono text-xs break-all hover:text-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="min-w-0 text-left">{text}</span>
      {copied ? <Check className="size-3.5 shrink-0" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}
