"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { savePreferences } from "@/app/actions/insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PRESETS, type PresetId } from "@/lib/period";
import type { LayoutItem, PrefKey, WidgetDef } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/**
 * State preferensi + draft saat panel "Atur Tampilan" terbuka. Halaman merender
 * `value` (draft bila sedang diedit) sehingga perubahan langsung terlihat;
 * Simpan → DB, Batal → kembali ke yang tersimpan.
 */
export function usePrefsEditor<T>(key: PrefKey, initial: T, defaults: T) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<T | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () => {
    if (!draft) return;
    const next = draft;
    startSaving(async () => {
      const res = await savePreferences(key, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(next);
      setDraft(null);
      toast.success(res.message ?? "Tampilan disimpan");
    });
  };

  return {
    value: draft ?? saved,
    editing: draft !== null,
    draft,
    open: () => setDraft(saved),
    change: (patch: Partial<T>) => setDraft((d) => ({ ...(d ?? saved), ...patch })),
    reset: () => setDraft(defaults),
    cancel: () => setDraft(null),
    save,
    saving,
    dirty: draft !== null && JSON.stringify(draft) !== JSON.stringify(saved),
  };
}

export function CustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Settings2 />
      Atur Tampilan
    </Button>
  );
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export function CustomizeSheet({
  open,
  title,
  description,
  defs,
  layout,
  onLayout,
  isManager,
  tiles,
  period,
  presets,
  onPeriod,
  extra,
  dirty,
  saving,
  onSave,
  onReset,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  defs: readonly WidgetDef[];
  layout: LayoutItem[];
  onLayout: (layout: LayoutItem[]) => void;
  isManager: boolean;
  tiles?: { defs: readonly { id: string; label: string }[]; value: { id: string; visible: boolean }[]; onChange: (v: { id: string; visible: boolean }[]) => void };
  period: PresetId;
  presets: PresetId[];
  onPeriod: (p: PresetId) => void;
  extra?: React.ReactNode;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const items = layout.filter((l) => {
    const def = defs.find((d) => d.id === l.id);
    return def && (!def.manager || isManager);
  });
  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    // urutan item yang disembunyikan untuk role ini dipertahankan di akhir
    const hidden = layout.filter((l) => !items.includes(l));
    onLayout([...move(items, from, to), ...hidden]);
  };
  const patch = (id: string, p: Partial<LayoutItem>) => onLayout(layout.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const shownCount = items.filter((i) => i.visible).length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onCancel()}>
      <SheetContent className="w-full gap-0 sm:max-w-md" overlayClassName="bg-black/10">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="pref-period">Periode default</Label>
            <Select value={period} onValueChange={(v) => onPeriod(v as PresetId)}>
              <SelectTrigger id="pref-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRESETS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Dipakai saat halaman dibuka tanpa filter periode.</p>
          </div>

          {extra}

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between">
              <Label>Widget</Label>
              <span className="text-xs text-muted-foreground">
                {shownCount} dari {items.length} tampil · seret untuk mengurutkan
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-1.5">
              {items.map((item, i) => {
                const def = defs.find((d) => d.id === item.id)!;
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      setDragFrom(i);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(i);
                    }}
                    onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom != null) reorder(dragFrom, i);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border bg-card p-2 transition-colors",
                      !item.visible && "bg-muted/40",
                      dragFrom === i && "opacity-50",
                      dragOver === i && dragFrom !== i && "border-primary",
                    )}
                  >
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
                    <Switch
                      checked={item.visible}
                      onCheckedChange={(v) => patch(item.id, { visible: v })}
                      aria-label={`Tampilkan ${def.label}`}
                    />
                    <div className={cn("min-w-0 flex-1", !item.visible && "opacity-60")}>
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {def.label}
                        {def.manager && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                            Manager
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={def.description}>
                        {def.description}
                      </p>
                    </div>
                    {def.resizable !== false && (
                      <div className="hidden shrink-0 rounded-md border p-0.5 lg:flex" role="radiogroup" aria-label="Lebar">
                        {(["half", "full"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={item.size === s}
                            onClick={() => patch(item.id, { size: s })}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[11px] text-muted-foreground",
                              item.size === s && "bg-accent font-medium text-foreground",
                            )}
                          >
                            {s === "half" ? "½" : "Penuh"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => reorder(i, i - 1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        aria-label={`Naikkan ${def.label}`}
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(i, i + 1)}
                        disabled={i === items.length - 1}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        aria-label={`Turunkan ${def.label}`}
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {tiles && (
            <div className="grid grid-cols-1 gap-2">
              <Label>Kartu statistik</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {tiles.value.map((t) => {
                  const def = tiles.defs.find((d) => d.id === t.id);
                  if (!def) return null;
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm has-[[data-state=unchecked]]:text-muted-foreground"
                    >
                      <Switch
                        checked={t.visible}
                        onCheckedChange={(v) => tiles.onChange(tiles.value.map((x) => (x.id === t.id ? { ...x, visible: v } : x)))}
                      />
                      <span className="truncate">{def.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
            <RotateCcw />
            Default
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
              Batal
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
              {saving && <Loader2 className="animate-spin" />}
              Simpan
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
