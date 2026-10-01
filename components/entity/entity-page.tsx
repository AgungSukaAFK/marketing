"use client";

import { useMemo } from "react";
import type { ColumnDef as TanColumn } from "@tanstack/react-table";
import { Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { formatCell, type ColumnDef, type EntityKey, type Lookup, type Row } from "@/lib/entities";
import { StatusBadge } from "./status-badge";
import { useEntityCrud } from "./use-entity-crud";
import { canModify, type EntityLookups, type Me } from "./types";

export function renderCell(c: ColumnDef, v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">-</span>;
  if (c.kind === "code") return <span className="font-mono text-brand-text">{String(v)}</span>;
  if (c.kind === "mono") return <span className="font-mono text-xs">{String(v)}</span>;
  if (c.kind === "badge") return <StatusBadge value={String(v)} />;
  if (c.kind === "money" || c.kind === "number" || c.kind === "percent")
    return <span className="tabular-nums">{formatCell(c, v)}</span>;
  return <span className="block max-w-[280px] truncate">{String(v)}</span>;
}

export function buildColumns(
  columns: ColumnDef[],
  lk: Lookup,
  actions: (row: Row) => React.ReactNode,
): TanColumn<Row>[] {
  return [
    { id: "no", header: "No", enableSorting: false, cell: ({ row }) => row.index + 1 },
    ...columns.map(
      (c): TanColumn<Row> => ({
        id: c.key,
        header: c.header,
        accessorFn: (r) => c.get(r, lk) ?? "",
        cell: (ctx) => renderCell(c, ctx.getValue()),
      }),
    ),
    { id: "actions", header: "Aksi", enableSorting: false, cell: ({ row }) => actions(row.original) },
  ];
}

/** Halaman CRUD standar (tabel). */
export function EntityPage({
  entity,
  rows,
  lookups,
  me,
  extraActions,
  children,
}: {
  entity: EntityKey;
  rows: Row[];
  lookups: EntityLookups;
  me: Me;
  extraActions?: (row: Row, crud: ReturnType<typeof useEntityCrud>) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const crud = useEntityCrud({ entity, rows, lookups, me });
  const { def, lk, openEdit, askDelete, download } = crud;

  const columns = useMemo(
    () =>
      buildColumns(def.columns, lk, (row) => (
        <div className="flex gap-1">
          {extraActions?.(row, crud)}
          {def.fields
            .filter((f) => f.type === "file" && f.pathField && row[f.pathField])
            .map((f) => (
              <Button
                key={f.name}
                variant="secondary"
                size="icon-sm"
                aria-label={`Download ${f.label}`}
                title={`Download ${f.label}`}
                onClick={() => download(row[f.pathField!], f.nameField ? row[f.nameField] : undefined)}
              >
                <Download />
              </Button>
            ))}
          {canModify(me, row) && (
            <>
              <Button variant="secondary" size="icon-sm" onClick={() => openEdit(row)} aria-label="Edit" title="Edit">
                <Pencil />
              </Button>
              <Button variant="destructive" size="icon-sm" onClick={() => askDelete(row)} aria-label="Hapus" title="Hapus">
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, lk, me, rows],
  );

  return (
    <div className="space-y-6">
      <DataTable columns={columns} data={rows} toolbar={crud.toolbar} />
      {children}
      {crud.dialogs}
    </div>
  );
}
