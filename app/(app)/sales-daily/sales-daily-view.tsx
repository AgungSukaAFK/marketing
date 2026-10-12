"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, KanbanSquare, LayoutGrid, Inbox, Pencil, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPipelineFromActivity } from "@/app/actions/entity";
import { Content } from "@/components/content";
import { EntityPage } from "@/components/entity/entity-page";
import { StatusBadge } from "@/components/entity/status-badge";
import { useEntityCrud } from "@/components/entity/use-entity-crud";
import { canModify, type EntityLookups, type Me } from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Row } from "@/lib/entities";

type Props = { rows: Row[]; lookups: EntityLookups; me: Me; canPipeline: boolean };
type View = "board" | "table";

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

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <Tabs value={view} onValueChange={(v) => onChange(v as View)} className="mb-4">
      <TabsList>
        <TabsTrigger value="board">
          <LayoutGrid /> Board
        </TabsTrigger>
        <TabsTrigger value="table">
          <Table2 /> Tabel
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function SalesDailyView(props: Props) {
  const [view, setView] = useState<View>("board");
  const tabs = <ViewTabs view={view} onChange={setView} />;
  return view === "board" ? <Board {...props} tabs={tabs} /> : <TableView {...props} tabs={tabs} />;
}

function TableView({ rows, lookups, me, canPipeline, tabs }: Props & { tabs: React.ReactNode }) {
  const pipe = usePipelineAction();
  return (
    <EntityPage
      entity="sales_daily"
      rows={rows}
      lookups={lookups}
      me={me}
      viewSwitcher={tabs}
      extraActions={(row) =>
        canPipeline && (
          <Button size="sm" variant="outline" onClick={() => pipe.create(row.id)} disabled={pipe.pending}>
            <KanbanSquare /> Pipeline
          </Button>
        )
      }
    />
  );
}

function Board({ rows, lookups, me, canPipeline, tabs }: Props & { tabs: React.ReactNode }) {
  const crud = useEntityCrud({ entity: "sales_daily", rows, lookups, me });
  const pipe = usePipelineAction();
  const completed = rows.filter((r) => r.status === "Completed");
  const pending = rows.filter((r) => r.status !== "Completed");

  const card = (r: Row) => (
    <div key={r.id} className="space-y-2 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs font-medium text-primary">{r.customer?.customer_code}</div>
          <div className="truncate text-sm font-semibold">{r.customer?.pt}</div>
        </div>
        <StatusBadge value={r.status} />
      </div>
      <div className="text-xs text-muted-foreground">
        {r.type} · {r.customer?.pic ?? "-"} · {lookups.profiles.find((p) => p.id === r.owner)?.username}
      </div>
      {r.note && <p className="line-clamp-3 text-sm">{r.note}</p>}
      <div className="flex flex-wrap items-center gap-1 border-t pt-2">
        {canPipeline && (
          <Button size="sm" variant="outline" onClick={() => pipe.create(r.id)} disabled={pipe.pending}>
            <KanbanSquare /> Buat Pipeline
          </Button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {r.attachment_path && (
            <Button
              size="icon-sm"
              variant="ghost"
              title={`Download ${r.attachment_name ?? "file"}`}
              aria-label="Download file"
              onClick={() => crud.download(r.attachment_path, r.attachment_name)}
            >
              <Download />
            </Button>
          )}
          {canModify(me, r) && (
            <>
              <Button size="icon-sm" variant="ghost" title="Edit" aria-label="Edit" onClick={() => crud.openEdit(r)}>
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Hapus"
                aria-label="Hapus"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => crud.askDelete(r)}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const columns: [string, Row[]][] = [
    ["Completed", completed],
    ["Pending / In Progress", pending],
  ];

  return (
    <>
      <Content title={crud.def.title} description={`${rows.length} data tersimpan`} cardAction={crud.toolbar}>
        {tabs}
        <div className="grid gap-4 md:grid-cols-2">
          {columns.map(([title, list]) => (
            <section key={title} className="space-y-2 rounded-lg border bg-muted/50 p-3 dark:bg-muted/10">
              <h3 className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                {title}
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] font-semibold text-foreground tabular-nums shadow-xs">
                  {list.length}
                </span>
              </h3>
              {list.length ? (
                list.map(card)
              ) : (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Inbox className="size-4" /> Belum ada aktivitas
                </p>
              )}
            </section>
          ))}
        </div>
      </Content>
      {crud.dialogs}
    </>
  );
}
