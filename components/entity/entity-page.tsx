"use client";

import { useMemo } from "react";
import type { ColumnDef as TanColumn } from "@tanstack/react-table";
import { Download, Paperclip, Pencil, Trash2 } from "lucide-react";
import { Content } from "@/components/content";
import { DataTable, type ColumnMeta, type TableFilter } from "@/components/data-table/data-table";
import { fmtBytes } from "@/components/form/file-dropzone";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  asAttachments,
  formatCell,
  type ColumnDef,
  type EntityDef,
  type EntityKey,
  type Lookup,
  type Row,
} from "@/lib/entities";
import { StatusBadge } from "./status-badge";
import { useEntityCrud } from "./use-entity-crud";
import { canModify, type EntityLookups, type Me } from "./types";

const NUMERIC = new Set(["money", "number", "percent"]);

export function renderCell(c: ColumnDef, v: unknown, sub?: unknown): React.ReactNode {
  // baris kedua (mis. nama part): lebar dibatasi, maks. 2 baris lalu "…", teks lengkap di tooltip
  if (sub !== null && sub !== undefined && sub !== "")
    return (
      <div className="flex max-w-70 min-w-40 flex-col gap-0.5">
        <span className="truncate" title={String(v ?? "")}>
          {renderCell(c, v)}
        </span>
        <span className="line-clamp-2 text-xs wrap-break-word whitespace-normal text-muted-foreground" title={String(sub)}>
          {String(sub)}
        </span>
      </div>
    );
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">-</span>;
  if (c.kind === "code") return <span className="font-mono text-xs font-medium text-primary">{String(v)}</span>;
  if (c.kind === "mono") return <span className="font-mono text-xs">{String(v)}</span>;
  if (c.kind === "badge") return <StatusBadge value={String(v)} />;
  if (c.kind === "date") return <span className="whitespace-nowrap tabular-nums">{formatCell(c, v)}</span>;
  if (c.kind && NUMERIC.has(c.kind)) return <span className="tabular-nums">{formatCell(c, v)}</span>;
  return (
    <span className="block max-w-70 truncate" title={String(v)}>
      {String(v)}
    </span>
  );
}

export function buildColumns(
  columns: ColumnDef[],
  lk: Lookup,
  actions: (row: Row) => React.ReactNode,
): TanColumn<Row>[] {
  return [
    {
      id: "no",
      header: "No",
      enableSorting: false,
      // nomor urut sesuai posisi setelah cari/filter/sort
      cell: ({ row, table }) => (
        <span className="text-muted-foreground tabular-nums">
          {table.getSortedRowModel().flatRows.indexOf(row) + 1}
        </span>
      ),
    },
    ...columns.map(
      (c): TanColumn<Row> => ({
        id: c.key,
        header: c.header,
        // nilai + baris kedua digabung supaya pencarian juga menemukan nama part
        accessorFn: (r) => (c.sub ? `${c.get(r, lk) ?? ""} ${c.sub(r, lk) ?? ""}`.trim() : c.get(r, lk) ?? ""),
        cell: ({ row }) => renderCell(c, c.get(row.original, lk), c.sub?.(row.original, lk)),
        meta: (c.kind && NUMERIC.has(c.kind) ? { align: "right" } : {}) satisfies ColumnMeta,
      }),
    ),
    { id: "actions", header: "Aksi", enableSorting: false, cell: ({ row }) => actions(row.original) },
  ];
}

/** Filter otomatis dari field pilihan (status, type, stage, …) dan Sales. */
export function entityFilters(def: EntityDef, lookups: EntityLookups): TableFilter<Row>[] {
  const filters: TableFilter<Row>[] = [];
  for (const f of def.fields) {
    if (f.type === "select" && f.options) {
      filters.push({
        key: f.name,
        label: f.label,
        options: f.options.map((o) => ({ value: o, label: o })),
        get: (r) => r[f.name],
      });
    } else if (f.type === "user") {
      filters.push({
        key: f.name,
        label: f.label,
        options: lookups.profiles.map((p) => ({ value: p.id, label: `${p.name} (${p.username})` })),
        get: (r) => r[f.name],
      });
    }
  }
  return filters;
}

/** Halaman CRUD standar: Content (judul + aksi) → Cari → Filter → Tabel → Paginasi. */
export function EntityPage({
  entity,
  rows,
  lookups,
  me,
  extraActions,
  viewSwitcher,
  children,
}: {
  entity: EntityKey;
  rows: Row[];
  lookups: EntityLookups;
  me: Me;
  extraActions?: (row: Row, crud: ReturnType<typeof useEntityCrud>) => React.ReactNode;
  /** mis. tab Board/Table di Sales Daily */
  viewSwitcher?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const crud = useEntityCrud({ entity, rows, lookups, me });
  const { def, lk, openEdit, askDelete, download } = crud;

  const columns = useMemo(
    () =>
      buildColumns(def.columns, lk, (row) => (
        <div className="flex items-center gap-1">
          {extraActions?.(row, crud)}
          {def.fields
            .filter((f) => f.type === "file" && f.pathField && row[f.pathField])
            .map((f) => (
              <Button
                key={f.name}
                variant="ghost"
                size="icon-sm"
                aria-label={`Download ${f.label}`}
                title={`Download ${f.label}`}
                onClick={() => download(row[f.pathField!], f.nameField ? row[f.nameField] : undefined)}
              >
                <Download />
              </Button>
            ))}
          {def.fields
            .filter((f) => f.type === "files" && asAttachments(row[f.name]).length)
            .map((f) => {
              const list = asAttachments(row[f.name]);
              return (
                <DropdownMenu key={f.name}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={f.label} title={`${f.label} (${list.length})`}>
                      <Paperclip />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-80">
                    <DropdownMenuLabel>
                      {f.label} ({list.length})
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {list.map((a) => (
                      <DropdownMenuItem key={a.path} onSelect={() => download(a.path, a.name)}>
                        <Download />
                        <span className="min-w-0 flex-1 truncate" title={a.name}>
                          {a.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">{fmtBytes(a.size)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          {canModify(me, row) && (
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)} aria-label="Edit" title="Edit">
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => askDelete(row)}
                aria-label="Hapus"
                title="Hapus"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def, lk, me, rows],
  );
  const filters = useMemo(() => entityFilters(def, lookups), [def, lookups]);

  return (
    <>
      <Content title={def.title} description={`${rows.length} data tersimpan`} cardAction={crud.toolbar}>
        {viewSwitcher}
        <DataTable columns={columns} data={rows} filters={filters} searchPlaceholder={`Cari di ${def.title}…`} />
      </Content>
      {children}
      {crud.dialogs}
    </>
  );
}
