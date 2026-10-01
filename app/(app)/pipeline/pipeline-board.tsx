"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { movePipelineStage } from "@/app/actions/entity";
import { useEntityCrud } from "@/components/entity/use-entity-crud";
import { canModify, type EntityLookups, type Me } from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PIPELINE_STAGES } from "@/lib/constants";
import { fmtJuta, fmtPercent, toNumber } from "@/lib/format";
import type { Row } from "@/lib/entities";

export function PipelineBoard({ rows, lookups, me }: { rows: Row[]; lookups: EntityLookups; me: Me }) {
  const router = useRouter();
  const crud = useEntityCrud({ entity: "pipeline", rows, lookups, me });
  const [, start] = useTransition();
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
    const id = e.dataTransfer.getData("text/plain");
    const row = items.find((r) => r.id === id);
    if (row && row.stage !== stage && canModify(me, row)) move(id, stage);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Total Value", fmtJuta(total)],
          ["Weighted Value", fmtJuta(weighted)],
          ["Win Rate", fmtPercent(rate)],
          ["Deals", String(items.length)],
        ].map(([k, v]) => (
          <Card key={k} className="py-4">
            <CardContent>
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-lg font-bold tabular-nums">{v}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="col-span-2 justify-center py-4 md:col-span-1">
          <CardContent>
            <Button className="w-full font-bold" onClick={crud.openCreate}>
              <Plus /> Deal
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">Seret kartu ke kolom lain atau ubah stage lewat dropdown.</p>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[1200px] gap-3">
          {PIPELINE_STAGES.map((stage) => {
            const list = items.filter((r) => r.stage === stage);
            const sum = list.reduce((a, r) => a + toNumber(r.value), 0);
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage)}
                className="w-56 shrink-0 space-y-2 rounded-2xl border bg-card p-3"
              >
                <div>
                  <h4 className="text-xs font-bold">
                    {stage} ({list.length})
                  </h4>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{fmtJuta(sum)}</p>
                </div>
                {list.map((r) => {
                  const editable = canModify(me, r);
                  return (
                    <div
                      key={r.id}
                      draggable={editable}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                      className="space-y-1 rounded-xl bg-muted p-2 text-xs"
                    >
                      <div className="font-mono text-brand-text">{r.customer?.customer_code}</div>
                      <div className="font-bold">{r.customer?.pt}</div>
                      <div className="text-muted-foreground">
                        {r.product || "-"} • {fmtJuta(r.value)} • {r.prob}%
                      </div>
                      <div className="text-muted-foreground">
                        {lookups.profiles.find((p) => p.id === r.sales_id)?.username ?? "-"}
                      </div>
                      {editable && (
                        <div className="flex items-center gap-1 pt-1">
                          <Select value={r.stage} onValueChange={(v) => move(r.id, v)}>
                            <SelectTrigger size="sm" className="h-6 flex-1 text-[10px]">
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
                          <Button size="icon-xs" variant="secondary" onClick={() => crud.openEdit(r)} aria-label="Edit">
                            <Pencil />
                          </Button>
                          <Button size="icon-xs" variant="destructive" onClick={() => crud.askDelete(r)} aria-label="Hapus">
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!list.length && <p className="text-xs text-muted-foreground">-</p>}
              </div>
            );
          })}
        </div>
      </div>
      {crud.dialogs}
    </div>
  );
}
