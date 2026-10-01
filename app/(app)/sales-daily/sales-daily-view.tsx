"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, KanbanSquare, LayoutGrid, Pencil, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPipelineFromActivity } from "@/app/actions/entity";
import { EntityPage } from "@/components/entity/entity-page";
import { StatusBadge } from "@/components/entity/status-badge";
import { useEntityCrud } from "@/components/entity/use-entity-crud";
import { canModify, type EntityLookups, type Me } from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Row } from "@/lib/entities";

type Props = { rows: Row[]; lookups: EntityLookups; me: Me; canPipeline: boolean };

function usePipelineAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const create = (id: string) =>
    start(async () => {
      const res = await createPipelineFromActivity(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Pipeline dibuat");
      router.push("/pipeline");
    });
  return { create, pending };
}

export function SalesDailyView(props: Props) {
  const [view, setView] = useState<"board" | "table">("board");
  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
        <TabsList>
          <TabsTrigger value="board">
            <LayoutGrid /> Board
          </TabsTrigger>
          <TabsTrigger value="table">
            <Table2 /> Table
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "board" ? <Board {...props} /> : <TableView {...props} />}
    </div>
  );
}

function TableView({ rows, lookups, me, canPipeline }: Props) {
  const pipe = usePipelineAction();
  return (
    <EntityPage
      entity="sales_daily"
      rows={rows}
      lookups={lookups}
      me={me}
      extraActions={(row) =>
        canPipeline && (
          <Button size="sm" className="font-bold" onClick={() => pipe.create(row.id)} disabled={pipe.pending}>
            <KanbanSquare /> Pipeline
          </Button>
        )
      }
    />
  );
}

function Board({ rows, lookups, me, canPipeline }: Props) {
  const crud = useEntityCrud({ entity: "sales_daily", rows, lookups, me });
  const pipe = usePipelineAction();
  const completed = rows.filter((r) => r.status === "Completed");
  const pending = rows.filter((r) => r.status !== "Completed");

  const card = (r: Row) => (
    <Card key={r.id} className="gap-1 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-brand-text">{r.customer?.customer_code}</span>
        <StatusBadge value={r.status} />
      </div>
      <div className="text-sm font-bold">{r.customer?.pt}</div>
      <div className="text-xs text-muted-foreground">
        {r.type} • {r.customer?.pic ?? "-"} • {lookups.profiles.find((p) => p.id === r.owner)?.username}
      </div>
      {r.note && <div className="mt-1 text-xs">{r.note}</div>}
      <div className="mt-2 flex flex-wrap gap-1">
        {canPipeline && (
          <Button size="xs" className="font-bold" onClick={() => pipe.create(r.id)} disabled={pipe.pending}>
            Buat Pipeline
          </Button>
        )}
        {r.attachment_path && (
          <Button size="xs" variant="secondary" onClick={() => crud.download(r.attachment_path, r.attachment_name)}>
            <Download /> File
          </Button>
        )}
        {canModify(me, r) && (
          <>
            <Button size="xs" variant="secondary" onClick={() => crud.openEdit(r)}>
              <Pencil /> Edit
            </Button>
            <Button size="xs" variant="destructive" onClick={() => crud.askDelete(r)}>
              <Trash2 /> Del
            </Button>
          </>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{crud.toolbar}</div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Completed", completed],
          ["Pending / In Progress", pending],
        ].map(([title, list]) => (
          <div key={title as string} className="space-y-2">
            <h4 className="text-xs font-bold">
              {title as string} ({(list as Row[]).length})
            </h4>
            {(list as Row[]).length ? (
              (list as Row[]).map(card)
            ) : (
              <p className="text-sm text-muted-foreground">-</p>
            )}
          </div>
        ))}
      </div>
      {crud.dialogs}
    </div>
  );
}
