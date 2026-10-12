"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, GripVertical, Pencil, Percent, Plus, Trash2, TrendingUp, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { movePipelineStage } from "@/app/actions/entity";
import { Content } from "@/components/content";
import { StatCard } from "@/components/stat-card";
import { useEntityCrud } from "@/components/entity/use-entity-crud";
import { canModify, type EntityLookups, type Me } from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PIPELINE_STAGES } from "@/lib/constants";
import { fmtJuta, fmtNumber, fmtPercent, toNumber } from "@/lib/format";
import type { Row } from "@/lib/entities";
import { cn } from "@/lib/utils";

export function PipelineBoard({ rows, lookups, me }: { rows: Row[]; lookups: EntityLookups; me: Me }) {
  const router = useRouter();
  const crud = useEntityCrud({ entity: "pipeline", rows, lookups, me });
  const [, start] = useTransition();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [items, moveOptimistic] = useOptimistic(rows, (state, { id, stage }: { id: string; stage: string }) =>
    state.map((r) => (r.id === id ? { ...r, stage } : r)),
  );

  const total = items.reduce((a, r) => a + toNumber(r.value), 0);
  const won = items.filter((r) => r.stage === "Handover").length;
  const rate = items.length ? (won / items.length) * 100 : 0;
  const weighted = items.reduce((a, r) => a + (toNumber(r.value) * toNumber(r.prob)) / 100, 0);

  const move = (id: string, stage: string) =>
    start(async () => {
      moveOptimistic({ id, stage });
      const res = await movePipelineStage(id, stage);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  const onDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const row = items.find((r) => r.id === id);
    if (row && row.stage !== stage && canModify(me, row)) move(id, stage);
  };

  return (
    <>
      <StatCard label="Total Value" value={fmtJuta(total)} icon={Wallet} />
      <StatCard label="Weighted Value" value={fmtJuta(weighted)} hint="Value × probabilitas" icon={TrendingUp} />
      <StatCard label="Win Rate" value={fmtPercent(rate)} hint={`${won} deal handover`} icon={Trophy} />
      <StatCard label="Deals" value={fmtNumber(items.length)} icon={Briefcase} />

      <Content
        title={crud.def.title}
        description="Seret kartu ke kolom lain atau ubah stage lewat dropdown."
        cardAction={
          <Button size="sm" onClick={crud.openCreate}>
            <Plus /> Tambah Deal
          </Button>
        }
      >
        <div className="-mx-6 overflow-x-auto px-6 pb-2">
          <div className="flex min-w-max gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const list = items.filter((r) => r.stage === stage);
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
                  <header className="flex items-center justify-between px-1 pt-1">
                    <div>
                      <h3 className="text-sm font-semibold">{stage}</h3>
                      <p className="text-xs text-muted-foreground tabular-nums">{fmtJuta(sum)}</p>
                    </div>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-semibold tabular-nums shadow-xs">
                      {list.length}
                    </span>
                  </header>
                  {list.map((r) => {
                    const editable = canModify(me, r);
                    return (
                      <article
                        key={r.id}
                        draggable={editable}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                        className={cn(
                          "space-y-1.5 rounded-md border bg-card p-2.5 text-sm shadow-xs",
                          editable && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs font-medium text-primary">{r.customer?.customer_code}</div>
                            <div className="truncate font-medium" title={r.customer?.pt}>
                              {r.customer?.pt}
                            </div>
                          </div>
                          {editable && <GripVertical className="size-4 shrink-0 text-muted-foreground" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{r.product || "-"}</div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium tabular-nums">{fmtJuta(r.value)}</span>
                          <span className="inline-flex items-center gap-0.5 text-muted-foreground tabular-nums">
                            <Percent className="size-3" />
                            {r.prob}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lookups.profiles.find((p) => p.id === r.sales_id)?.username ?? "-"}
                        </div>
                        {editable && (
                          <div className="flex items-center gap-1 border-t pt-2">
                            <Select value={r.stage} onValueChange={(v) => move(r.id, v)}>
                              <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs" aria-label="Ubah stage">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PIPELINE_STAGES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="size-7"
                              onClick={() => crud.openEdit(r)}
                              aria-label="Edit"
                              title="Edit"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => crud.askDelete(r)}
                              aria-label="Hapus"
                              title="Hapus"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
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
      </Content>
      {crud.dialogs}
    </>
  );
}
