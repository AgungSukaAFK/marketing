"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ClipboardPaste, FileIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/entities";

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Screenshot dari clipboard biasanya bernama "image.png" — beri nama unik. */
function renamePasted(file: File, i: number) {
  if (file.name && file.name !== "image.png") return file;
  const ts = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const ext = file.type.split("/")[1] || "png";
  return new File([file], `paste-${ts}${i ? `-${i}` : ""}.${ext}`, { type: file.type });
}

/**
 * Lampiran ganda: klik untuk pilih, drag & drop, atau Ctrl+V (paste file /
 * screenshot dari clipboard). `existing` = lampiran tersimpan yang dipertahankan,
 * `files` = file baru yang akan diunggah saat simpan.
 */
export function FileDropzone({
  id,
  existing,
  onExistingChange,
  files,
  onFilesChange,
  maxSizeMB,
  maxFiles,
  accept,
  invalid,
  disabled,
}: {
  id: string;
  existing: Attachment[];
  onExistingChange: (a: Attachment[]) => void;
  files: File[];
  onFilesChange: (f: File[]) => void;
  maxSizeMB: number;
  maxFiles: number;
  accept?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const total = existing.length + files.length;

  const add = (list: File[]) => {
    if (!list.length || disabled) return;
    const max = maxSizeMB * 1024 * 1024;
    const tooBig = list.filter((f) => f.size > max);
    const empty = list.filter((f) => f.size === 0);
    let ok = list.filter((f) => f.size > 0 && f.size <= max);
    if (tooBig.length)
      toast.error(`File melebihi ${maxSizeMB} MB`, { description: tooBig.map((f) => f.name).join(", ") });
    if (empty.length) toast.error("File kosong dilewati", { description: empty.map((f) => f.name).join(", ") });
    const room = maxFiles - total;
    if (ok.length > room) {
      toast.error(`Maksimal ${maxFiles} lampiran`);
      ok = ok.slice(0, Math.max(room, 0));
    }
    if (ok.length) onFilesChange([...files, ...ok]);
  };

  // listener paste global selalu melihat state terbaru
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const list = Array.from(e.clipboardData?.files ?? []);
    if (!list.length) return; // teks biasa → biarkan masuk ke input yang fokus
    e.preventDefault();
    add(list.map(renamePasted));
  });
  useEffect(() => {
    const handler = (e: ClipboardEvent) => onPaste(e);
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none",
          "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          dragging && "border-primary bg-primary/5",
          invalid && "border-destructive",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="size-5 text-muted-foreground" />
        <div className="text-sm font-medium">Klik, seret file ke sini, atau paste (Ctrl+V)</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ClipboardPaste className="size-3" />
          Bisa lebih dari satu file · maks {maxSizeMB} MB per file
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {total > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {existing.map((a) => (
            <FileRow
              key={a.path}
              name={a.name}
              size={a.size}
              onRemove={() => onExistingChange(existing.filter((x) => x.path !== a.path))}
            />
          ))}
          {files.map((f, i) => (
            <FileRow
              key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
              name={f.name}
              size={f.size}
              isNew
              onRemove={() => onFilesChange(files.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ name, size, isNew, onRemove }: { name: string; size: number; isNew?: boolean; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 px-3 py-1.5">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate" title={name}>
        {name}
      </span>
      {isNew && <span className="shrink-0 text-xs font-medium text-primary">baru</span>}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtBytes(size)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Hapus ${name}`}
        title="Hapus"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <X />
      </Button>
    </li>
  );
}
