"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef as TanColumn } from "@tanstack/react-table";
import { AlertTriangle, Package, Pencil, Trash2 } from "lucide-react";
import { Content } from "@/components/content";
import { DataTable, type ColumnMeta, type TableFilter } from "@/components/data-table/data-table";
import { renderCell } from "@/components/entity/entity-page";
import { StatusBadge, StatusCounts } from "@/components/entity/status-badge";
import { canModify, isManager, type EntityLookups, type Me } from "@/components/entity/types";
import { useEntityCrud } from "@/components/entity/use-entity-crud";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OPTIONS } from "@/lib/constants";
import { quotationItems, statusCounts, type ColumnDef, type Row } from "@/lib/entities";
import { fmtNumber, fmtRupiah } from "@/lib/format";

const NUMERIC = new Set(["money", "number", "percent"]);
const OPEN_STATUS = new Set(["Draft", "Negosiasi"]);
const today = () => new Date().toISOString().slice(0, 10);

/** Lewat Tgl Exp dan masih ada barang Draft/Negosiasi. */
const isExpired = (r: Row) =>
  !!r.tgl_exp && r.tgl_exp < today() && quotationItems(r).some((i) => OPEN_STATUS.has(i.status));

function ItemsCell({ row }: { row: Row }) {
  const items = quotationItems(row);
  if (!items.length) return <span className="text-muted-foreground">-</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex max-w-60 items-center gap-1.5 rounded-md px-1.5 py-1 text-left -mx-1.5 transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          title="Lihat semua barang"
        >
          <Package className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{items[0].part}</span>
          {items.length > 1 && (
            <span className="shrink-0 rounded-sm bg-secondary px-1 text-[11px] font-semibold text-secondary-foreground tabular-nums">
              +{items.length - 1}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw_-_1rem)] p-0">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          {items.length} barang · <span className="font-mono">{row.quot_no}</span>
        </div>
        <ol className="max-h-72 divide-y overflow-y-auto">
          {items.map((i, idx) => (
            <li key={i.id ?? idx} className="flex items-start gap-3 px-3 py-2 text-sm">
              <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium">{i.part}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {fmtNumber(i.qty)} × {fmtRupiah(i.harga)} = {fmtRupiah(i.total)}
                </div>
              </div>
              <StatusBadge value={i.status} />
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}

export function QuotationView({ rows, lookups, me }: { rows: Row[]; lookups: EntityLookups; me: Me }) {
  const crud = useEntityCrud({ entity: "quotation", rows, lookups, me, createHref: "/quotation/new" });
  const { def, lk, askDelete } = crud;

  const columns = useMemo((): TanColumn<Row>[] => {
    const custom: Record<string, (r: Row, c: ColumnDef) => React.ReactNode> = {
      items: (r) => <ItemsCell row={r} />,
      status: (r) => <StatusCounts counts={statusCounts(quotationItems(r))} className="min-w-36" />,
      tgl_exp: (r, c) =>
        isExpired(r) ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" title="Lewat masa berlaku, masih ada barang belum closing">
            {renderCell(c, r.tgl_exp)}
            <AlertTriangle className="size-3.5" />
          </span>
        ) : (
          renderCell(c, r.tgl_exp)
        ),
      loss: (r, c) => {
        const v = c.get(r, lk);
        return Number(v) > 0 ? <span className="text-destructive">{renderCell(c, v)}</span> : renderCell(c, v);
      },
    };
    return [
      {
        id: "no",
        header: "No",
        enableSorting: false,
        cell: ({ row, table }) => (
          <span className="text-muted-foreground tabular-nums">{table.getSortedRowModel().flatRows.indexOf(row) + 1}</span>
        ),
      },
      ...def.columns.map(
        (c): TanColumn<Row> => ({
          id: c.key,
          header: c.header,
          accessorFn: (r) => c.get(r, lk) ?? "",
          cell: ({ row, getValue }) => (custom[c.key] ? custom[c.key](row.original, c) : renderCell(c, getValue())),
          meta: (c.kind && NUMERIC.has(c.kind) ? { align: "right" } : {}) satisfies ColumnMeta,
        }),
      ),
      {
        id: "actions",
        header: "Aksi",
        enableSorting: false,
        cell: ({ row: { original: r } }) =>
          canModify(me, r) && (
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon-sm" aria-label="Edit" title="Edit">
                <Link href={`/quotation/${r.id}/edit`}>
                  <Pencil />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => askDelete(r)}
                aria-label="Hapus"
                title="Hapus"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          ),
      },
    ];
  }, [def, lk, me, askDelete]);

  const filters = useMemo((): TableFilter<Row>[] => {
    const list: TableFilter<Row>[] = [
      {
        key: "status",
        label: "Status Barang",
        options: OPTIONS.quotationStatus.map((s) => ({ value: s, label: s })),
        get: () => null,
        match: (r, v) => quotationItems(r).some((i) => i.status === v),
      },
      {
        key: "exp",
        label: "Masa Berlaku",
        options: [
          { value: "active", label: "Masih berlaku" },
          { value: "expired", label: "Kedaluwarsa (belum closing)" },
        ],
        get: () => null,
        match: (r, v) => (v === "expired" ? isExpired(r) : !r.tgl_exp || r.tgl_exp >= today()),
      },
    ];
    if (isManager(me))
      list.push({
        key: "owner",
        label: "Dibuat oleh",
        options: lookups.profiles.map((p) => ({ value: p.id, label: `${p.name} (${p.username})` })),
        get: (r) => r.owner,
      });
    return list;
  }, [me, lookups.profiles]);

  return (
    <>
      <Content title={def.title} description={`${rows.length} quotation tersimpan`} cardAction={crud.toolbar}>
        <DataTable
          columns={columns}
          data={rows}
          filters={filters}
          searchPlaceholder="Cari quot no, kode accurate, customer, atau nama barang…"
          emptyText="Belum ada quotation. Klik Tambah untuk membuat yang pertama."
        />
      </Content>
      {crud.dialogs}
    </>
  );
}
