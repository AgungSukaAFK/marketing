"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { importEntity } from "@/app/actions/entity";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_IMPORT_ROWS, importColumns, type EntityDef, type ImportResult } from "@/lib/entities";
import { exportWorkbook, readExcel } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { EntityLookups } from "./types";

/** Template kosong: sheet "Data" (judul kolom saja) + petunjuk + daftar customer & user yang valid. */
async function downloadTemplate(def: EntityDef, lookups: EntityLookups) {
  const cols = importColumns(def);
  const keys = new Set(cols.map((c) => c.key));
  const needsUsers = keys.has("sales") || keys.has("owner") || def.fields.some((f) => f.type === "users");
  const notes = [
    'Isi data mulai baris 2 di sheet "Data". Jangan ubah atau hapus baris judul kolom.',
    `Maksimal ${MAX_IMPORT_ROWS} baris per file. Baris yang tidak valid dilewati, sisanya tetap masuk.`,
    "Format sama dengan hasil Export Excel, jadi file export juga bisa di-import.",
    ...(def.fields.some((f) => f.type === "file" || f.type === "files")
      ? ["Lampiran file tidak ikut di-import. Tambahkan lewat tombol Edit setelah data masuk."]
      : []),
  ];
  await exportWorkbook(
    [
      { name: "Data", rows: [cols.map((c) => c.key)] },
      {
        name: "Petunjuk",
        rows: [
          ["Kolom", "Nama di Form", "Wajib", "Keterangan"],
          ...cols.map((c) => [c.key, c.label, c.required ? "Ya" : "-", c.hint]),
          [],
          ...notes.map((n) => [n]),
        ],
      },
      ...(keys.has("customer_code")
        ? [{ name: "Customer", rows: [["customer_code", "PT", "Site"], ...lookups.customers.map((c) => [c.customer_code, c.pt, c.site ?? ""])] }]
        : []),
      ...(needsUsers
        ? [{ name: "User", rows: [["username", "Nama", "Role"], ...lookups.profiles.map((p) => [p.username, p.name, p.role ?? ""])] }]
        : []),
    ],
    `template_${def.key}.xlsx`,
  );
}

/** Import massal: download template → upload → preview validasi → konfirmasi. */
export function ImportDialog({
  def,
  lookups,
  open,
  onOpenChange,
}: {
  def: EntityDef;
  lookups: EntityLookups;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<{ name: string; rows: Record<string, unknown>[] } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, startTransition] = useTransition();
  // quotation punya format sendiri (satu baris per barang) — pakai hasil Export Excel
  const hasTemplate = !def.exportRows;

  const reset = () => {
    setFile(null);
    setPreview(null);
  };
  const close = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const check = (f: File | undefined) => {
    if (!f || busy) return;
    startTransition(async () => {
      let rows: Record<string, unknown>[];
      try {
        rows = await readExcel(f);
      } catch {
        return void toast.error("File tidak bisa dibaca");
      }
      const res = await importEntity(def.key, rows, { dryRun: true });
      if (!res.ok) {
        reset();
        return void toast.error(res.error);
      }
      setFile({ name: f.name, rows });
      setPreview(res.data!);
    });
  };

  const confirm = () => {
    if (!file) return;
    startTransition(async () => {
      const res = await importEntity(def.key, file.rows);
      // apa pun hasilnya, preview lama tidak dipakai lagi (cegah import dobel)
      reset();
      router.refresh();
      if (!res.ok) return void toast.error(res.error);
      const { inserted, skipped } = res.data!;
      toast.success(`Import: ${inserted} data masuk`, {
        description: skipped ? `${skipped} baris dilewati karena tidak valid` : undefined,
      });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import {def.title}</DialogTitle>
          <DialogDescription>
            Tambah data lama secara massal dari file Excel. Data dicek dulu sebelum disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {hasTemplate ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">1. Download template kosong</div>
                <div className="text-xs text-muted-foreground">
                  Berisi kolom yang dibutuhkan, petunjuk pengisian, dan daftar customer & user yang terdaftar.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(def, lookups).catch(() => toast.error("Gagal membuat template"))}
              >
                <FileSpreadsheet /> Template
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Gunakan format kolom yang sama dengan hasil Export Excel.</p>
          )}

          <div className="flex flex-col gap-2">
            {hasTemplate && <div className="text-sm font-medium">2. Upload file yang sudah diisi</div>}
            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                check(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none",
                "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                dragging && "border-primary bg-primary/5",
                busy && "pointer-events-none opacity-50",
              )}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
              <div className="max-w-full truncate text-sm font-medium">
                {file ? file.name : "Klik atau seret file ke sini"}
              </div>
              <div className="text-xs text-muted-foreground">
                {file ? "Klik untuk ganti file" : `.xlsx, .xls, .csv · maks ${MAX_IMPORT_ROWS} baris`}
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                check(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {preview && (
            <div className="flex flex-col gap-2">
              <Alert>
                <CircleCheck />
                <AlertTitle>{preview.inserted} data siap di-import</AlertTitle>
                <AlertDescription>
                  {preview.skipped
                    ? `${preview.skipped} baris tidak valid dan akan dilewati. Perbaiki di file lalu upload ulang, atau lanjutkan tanpa baris tersebut.`
                    : "Semua baris valid."}
                </AlertDescription>
              </Alert>
              {preview.skipped > 0 && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Baris bermasalah</AlertTitle>
                  <AlertDescription>
                    <ul className="max-h-48 w-full overflow-y-auto text-xs">
                      {preview.errors.map((e, i) => (
                        <li key={i} className="py-0.5">
                          {e}
                        </li>
                      ))}
                      {preview.skipped > preview.errors.length && (
                        <li className="py-0.5">…dan {preview.skipped - preview.errors.length} baris lainnya</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Batal
          </Button>
          <Button onClick={confirm} disabled={busy || !preview?.inserted}>
            {busy && <Loader2 className="animate-spin" />}
            Import {preview?.inserted ? `${preview.inserted} data` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
