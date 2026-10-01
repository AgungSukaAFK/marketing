"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, FileType, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { deleteEntity, importEntity } from "@/app/actions/entity";
import { Button } from "@/components/ui/button";
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
import { exportExcel, exportPDF, exportWord, readExcel } from "@/lib/export";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";
import { EntityForm } from "./entity-form";
import type { EntityLookups, Me } from "./types";

/** State & aksi CRUD bersama untuk tabel, board, dan kanban. */
export function useEntityCrud({
  entity,
  rows,
  lookups,
  me,
}: {
  entity: EntityKey;
  rows: Row[];
  lookups: EntityLookups;
  me: Me;
}) {
  const def = ENTITIES[entity];
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

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
      if (type === "excel") await exportExcel(rows.map((r) => toExportRow(def, r, lk)), def.key);
      else {
        const headers = def.columns.map((c) => c.header);
        const body = rows.map((r) => toDisplayRow(def, r, lk));
        await (type === "pdf" ? exportPDF : exportWord)(def.title, headers, body, def.key);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export gagal");
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    startTransition(async () => {
      try {
        const data = await readExcel(file);
        const res = await importEntity(def.key, data);
        if (!res.ok) return void toast.error(res.error);
        const { inserted, errors } = res.data!;
        toast.success(`Import: ${inserted} baris masuk`, {
          description: errors.length ? `${errors.length} baris dilewati — ${errors.slice(0, 3).join("; ")}` : undefined,
        });
        router.refresh();
      } catch {
        toast.error("File tidak bisa dibaca");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  };

  const download = async (path: string, name?: string) => {
    const { data, error } = await createClient()
      .storage.from(STORAGE_BUCKET)
      .createSignedUrl(path, 60, { download: name || true });
    if (error || !data) return toast.error("Gagal membuat link download");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const toolbar = (
    <>
      <Button onClick={openCreate} className="font-bold">
        <Plus /> Input/Tambah
      </Button>
      <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload /> Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => onImport(e.target.files?.[0])}
      />
      <Button variant="secondary" onClick={() => doExport("excel")}>
        <FileSpreadsheet /> Excel
      </Button>
      <Button variant="secondary" onClick={() => doExport("pdf")}>
        <FileText /> PDF
      </Button>
      <Button variant="secondary" onClick={() => doExport("word")}>
        <FileType /> Word
      </Button>
    </>
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
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data?</AlertDialogTitle>
            <AlertDialogDescription>Data (dan file terlampir) akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
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

