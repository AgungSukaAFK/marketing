"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, FileSpreadsheet, FileText, FileType, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { logExport } from "@/app/actions/activity";
import { deleteEntity, getDownloadUrl } from "@/app/actions/entity";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ENTITIES, toDisplayRow, toExportRow, type EntityKey, type Lookup, type Row } from "@/lib/entities";
import { exportExcel, exportPDF, exportWord } from "@/lib/export";
import { EntityForm } from "./entity-form";
import { ImportDialog } from "./import-dialog";
import type { EntityLookups, Me } from "./types";

/** State & aksi CRUD bersama untuk tabel, board, dan kanban. */
export function useEntityCrud({
  entity,
  rows,
  lookups,
  me,
  createHref,
}: {
  entity: EntityKey;
  rows: Row[];
  lookups: EntityLookups;
  me: Me;
  /** "Tambah" membuka halaman ini, bukan dialog form */
  createHref?: string;
}) {
  const def = ENTITIES[entity];
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  const lk: Lookup = useMemo(() => ({ profiles: new Map(lookups.profiles.map((p) => [p.id, p])) }), [lookups.profiles]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditing(row);
    setFormOpen(true);
  };

  const doExport = async (type: "excel" | "pdf" | "word") => {
    if (!rows.length) return toast.error("Tidak ada data");
    try {
      if (type === "excel")
        await exportExcel(
          def.exportRows ? rows.flatMap((r) => def.exportRows!(r, lk)) : rows.map((r) => toExportRow(def, r, lk)),
          def.key,
        );
      else {
        const headers = def.columns.map((c) => c.header);
        const body = rows.map((r) => toDisplayRow(def, r, lk));
        await (type === "pdf" ? exportPDF : exportWord)(def.title, headers, body, def.key);
      }
      // Activity History; tidak ditunggu
      void logExport({ entity: def.key, format: type, count: rows.length });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export gagal");
    }
  };

  const download = async (path: string, name?: string) => {
    // link dibuat server supaya download tercatat di Activity History
    const res = await getDownloadUrl(def.key, path, name);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Gagal membuat link download" : res.error);
    window.open(res.data, "_blank", "noopener");
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
        <Upload /> Import
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download /> Export <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => doExport("excel")}>
            <FileSpreadsheet /> Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => doExport("pdf")}>
            <FileText /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => doExport("word")}>
            <FileType /> Word (.docx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {createHref ? (
        <Button asChild size="sm">
          <Link href={createHref}>
            <Plus /> Tambah
          </Link>
        </Button>
      ) : (
        <Button size="sm" onClick={openCreate}>
          <Plus /> Tambah
        </Button>
      )}
    </div>
  );

  const dialogs = (
    <>
      <EntityForm
        def={def}
        open={formOpen}
        onOpenChange={setFormOpen}
        row={editing}
        lookups={lookups}
        me={me}
        onSaved={() => router.refresh()}
      />
      <ImportDialog def={def} lookups={lookups} open={importOpen} onOpenChange={setImportOpen} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data?</AlertDialogTitle>
            <AlertDialogDescription>Data (dan file terlampir) akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                const r = deleting;
                if (!r) return;
                startTransition(async () => {
                  const res = await deleteEntity(def.key, r.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Dihapus");
                  router.refresh();
                });
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return { def, lk, toolbar, dialogs, openCreate, openEdit, askDelete: setDeleting, download, busy };
}

