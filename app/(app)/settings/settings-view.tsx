"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Download, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { setAccessControl } from "@/app/actions/accounts";
import {
  addCustomMenu,
  backupTenant,
  deleteCustomMenu,
  resetMenuConfig,
  resetTenantData,
  restoreTenant,
  saveAppSettings,
  saveHeaderCfg,
  saveMenuConfig,
  updateCustomMenuContent,
} from "@/app/actions/settings";
import { SafeHtml } from "@/components/safe-html";
import { Content } from "@/components/content";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AppSettings } from "@/lib/auth";
import { accentThemes } from "@/lib/accent-options";
import { fontFamilies } from "@/lib/font-options";
import { cn } from "@/lib/utils";
import {
  BASE_MENUS,
  DENSITIES,
  HEADER_CFG_LABELS,
  MENU_ICONS,
  ROLE_LABEL,
  type HeaderCfg,
  type TenantRole,
} from "@/lib/constants";
import { downloadJSON } from "@/lib/export";
import { MenuIcon } from "@/lib/icons";
import type { CustomMenuRow } from "@/lib/menus";

type MenuItem = { id: string; label: string; defaultLabel: string; icon: string; custom: boolean; visible: boolean };
type UserLite = { id: string; username: string; name: string; role: TenantRole | null; active: boolean };
type AccessLite = { user_id: string; enabled: boolean; allowed_menus: string[] };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Tersimpan");
      router.refresh();
    });
  return { pending, run };
}

export function SettingsView(props: {
  role: TenantRole;
  tenantCode: string;
  settings: AppSettings;
  menus: MenuItem[];
  customMenus: CustomMenuRow[];
  users: UserLite[];
  access: AccessLite[];
}) {
  const isMaster = props.role === "master";
  return (
    <>
      <AppIdentity settings={props.settings} />
      <HeaderControls cfg={props.settings.header_cfg} />
      <MenuEditor menus={props.menus} />
      <CustomMenus items={props.customMenus} />
      {isMaster && <AccessControl users={props.users} access={props.access} menus={props.menus} />}
      {isMaster && <BackupRestore tenantCode={props.tenantCode} />}
    </>
  );
}

// ---------------------------------------------------------------------------

function OptionSelect({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; style?: React.CSSProperties }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} style={o.style}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Swatch({
  name,
  label,
  color,
  selected,
  onSelect,
}: {
  name: string;
  label: string;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={label}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected && "bg-accent",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border",
          selected && "ring-2 ring-offset-2 ring-offset-background",
        )}
        style={{ backgroundColor: color, "--tw-ring-color": color } as React.CSSProperties}
      >
        {selected && <Check className="h-3.5 w-3.5 text-white" />}
      </span>
      <span className="w-full truncate text-center text-[10px] leading-tight">{name === "zinc" ? "Default" : label}</span>
    </button>
  );
}

function AppIdentity({ settings }: { settings: AppSettings }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({
    app_name: settings.app_name,
    accent: settings.accent,
    font: settings.font,
    density: settings.density,
  });
  const dirty =
    v.app_name !== settings.app_name ||
    v.accent !== settings.accent ||
    v.font !== settings.font ||
    v.density !== settings.density;

  return (
    <Content
      title="Identitas Aplikasi"
      description="Berlaku untuk semua akun di perusahaan ini. Tiap user tetap bisa mengganti aksen, font & mode tema miliknya lewat header."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="app_name">Nama Aplikasi</FieldLabel>
            <Input
              id="app_name"
              value={v.app_name}
              maxLength={60}
              onChange={(e) => setV({ ...v, app_name: e.target.value })}
            />
            <FieldDescription>Tampil di sidebar & breadcrumb.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="app_font">Font Default</FieldLabel>
            <OptionSelect
              id="app_font"
              value={v.font}
              onChange={(font) => setV({ ...v, font })}
              options={fontFamilies.map((f) => ({ value: f.name, label: f.label, style: { fontFamily: f.preview } }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="app_density">Densitas</FieldLabel>
            <OptionSelect
              id="app_density"
              value={v.density}
              onChange={(d) => setV({ ...v, density: d as AppSettings["density"] })}
              options={DENSITIES.map((d) => ({ value: d, label: d }))}
            />
            <FieldDescription>Kompak memperkecil jarak card & baris tabel.</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel>Warna Aksen Default</FieldLabel>
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Warna Perusahaan</p>
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {accentThemes
                .filter((t) => t.group === "company")
                .map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setV({ ...v, accent: t.name })}
                    aria-pressed={v.accent === t.name}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      v.accent === t.name && "border-primary",
                    )}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full border" style={{ backgroundColor: t.color }} />
                    <span className="font-semibold">{t.label}</span>
                    {v.accent === t.name && <Check className="ml-auto h-4 w-4" />}
                  </button>
                ))}
            </div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Warna Umum</p>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8">
              {accentThemes
                .filter((t) => t.group === "general")
                .map((t) => (
                  <Swatch
                    key={t.name}
                    name={t.name}
                    label={t.label}
                    color={t.color}
                    selected={v.accent === t.name}
                    onSelect={() => setV({ ...v, accent: t.name })}
                  />
                ))}
            </div>
          </div>
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <Button disabled={pending || !dirty} onClick={() => run(() => saveAppSettings(v))}>
          {pending ? "Menyimpan…" : "Simpan Tampilan"}
        </Button>
      </div>
    </Content>
  );
}

function HeaderControls({ cfg }: { cfg: HeaderCfg }) {
  const { run } = useAction();
  const [v, setV] = useState(cfg);
  return (
    <Content title="Kontrol Header" description="Elemen yang tampil di header untuk semua akun. Tersimpan otomatis.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(HEADER_CFG_LABELS) as (keyof HeaderCfg)[]).map((k) => (
          <Field key={k} orientation="horizontal" className="rounded-lg border p-3">
            <Switch
              id={`h_${k}`}
              checked={v[k] !== false}
              onCheckedChange={(c) => {
                const next = { ...v, [k]: c };
                setV(next);
                run(() => saveHeaderCfg(next));
              }}
            />
            <FieldLabel htmlFor={`h_${k}`}>{HEADER_CFG_LABELS[k]}</FieldLabel>
          </Field>
        ))}
      </div>
    </Content>
  );
}

function MenuEditor({ menus }: { menus: MenuItem[] }) {
  const { pending, run } = useAction();
  const [items, setItems] = useState(menus);
  const update = (id: string, patch: Partial<MenuItem>) => setItems((s) => s.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const move = (i: number, d: number) =>
    setItems((s) => {
      const n = i + d;
      if (n < 0 || n >= s.length) return s;
      const c = [...s];
      [c[i], c[n]] = [c[n], c[i]];
      return c;
    });

  const save = () =>
    run(() =>
      saveMenuConfig({
        menu_order: items.map((m) => m.id),
        labels: Object.fromEntries(items.filter((m) => m.label && m.label !== m.defaultLabel).map((m) => [m.id, m.label])),
        icons: Object.fromEntries(items.map((m) => [m.id, m.icon])) as Record<string, (typeof MENU_ICONS)[number]>,
        visibility: Object.fromEntries(items.map((m) => [m.id, m.visible])),
      }),
    );

  return (
    <Content
      title="Menu"
      description="Urutan, visibilitas, nama & ikon menu di sidebar."
      cardAction={
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(resetMenuConfig)}>
          <RotateCcw /> Reset Default
        </Button>
      }
    >
      <div className="divide-y rounded-md border">
        {items.map((m, i) => (
          <div key={m.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !m.visible && "bg-muted/50")}>
            <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <MenuIcon name={m.icon} className="size-4 text-muted-foreground" />
            <span className="w-24 truncate font-mono text-xs text-muted-foreground" title={m.id}>
              {m.id}
            </span>
            <Input
              value={m.label}
              onChange={(e) => update(m.id, { label: e.target.value })}
              className="h-8 min-w-36 flex-1"
              aria-label={`Label ${m.id}`}
            />
            <Select value={m.icon} onValueChange={(icon) => update(m.id, { icon })}>
              <SelectTrigger size="sm" className="w-40" aria-label={`Ikon ${m.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MENU_ICONS.map((ic) => (
                  <SelectItem key={ic} value={ic}>
                    <MenuIcon name={ic} className="size-4" /> {ic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={m.visible}
                disabled={m.id === "settings"}
                onCheckedChange={(c) => update(m.id, { visible: c === true })}
              />
              Tampil
            </label>
            <div className="flex">
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Naik"
                title="Naik"
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Turun"
                title="Turun"
              >
                <ArrowDown />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={pending} onClick={save}>
          {pending ? "Menyimpan…" : "Simpan Menu"}
        </Button>
      </div>
    </Content>
  );
}

function CustomMenus({ items }: { items: CustomMenuRow[] }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState({ menu_key: "", label: "", icon: "file-text" as (typeof MENU_ICONS)[number] });
  const [editing, setEditing] = useState<CustomMenuRow | null>(null);
  const [deleting, setDeleting] = useState<CustomMenuRow | null>(null);
  const [content, setContent] = useState("");

  return (
    <Content title="Menu Kustom" description="Halaman SOP, catatan, atau info. Isi berupa HTML — disanitasi otomatis saat ditampilkan.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/50 p-3 dark:bg-muted/10">
          <Input
            placeholder="ID (mis: sop)"
            value={form.menu_key}
            onChange={(e) => setForm({ ...form, menu_key: e.target.value })}
            className="w-40 bg-background"
            aria-label="ID menu"
          />
          <Input
            placeholder="Label"
            aria-label="Label menu"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-56 bg-background"
          />
          <Select value={form.icon} onValueChange={(icon) => setForm({ ...form, icon: icon as typeof form.icon })}>
            <SelectTrigger className="w-44 bg-background" aria-label="Ikon menu">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MENU_ICONS.map((ic) => (
                <SelectItem key={ic} value={ic}>
                  <MenuIcon name={ic} className="size-4" /> {ic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await addCustomMenu(form);
                if (res.ok) setForm({ menu_key: "", label: "", icon: "file-text" });
                return res;
              })
            }
          >
            <Plus /> Tambah
          </Button>
        </div>
        <div className="divide-y rounded-md border">
          {items.length ? (
            items.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <MenuIcon name={c.icon} className="size-4 text-muted-foreground" />
                <span className="font-medium">{c.label}</span>
                <span className="font-mono text-xs text-muted-foreground">/{c.menu_key}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    setEditing(c);
                    setContent(c.content);
                  }}
                >
                  <Pencil /> Edit Isi
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Hapus"
                  aria-label={`Hapus menu ${c.label}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending}
                  onClick={() => setDeleting(c)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada menu kustom</p>
          )}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Isi — {editing?.label}</DialogTitle>
            <DialogDescription>Kiri: HTML. Kanan: pratinjau hasil.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-80 font-mono text-xs [field-sizing:fixed]"
              aria-label="Isi HTML"
            />
            <div className="h-80 overflow-auto rounded-md border bg-muted/30 p-3">
              <SafeHtml html={content} className="prose prose-sm max-w-none dark:prose-invert" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                editing &&
                run(async () => {
                  const res = await updateCustomMenuContent(editing.id, content);
                  if (res.ok) setEditing(null);
                  return res;
                })
              }
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus menu {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>Menu & isinya akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                const c = deleting;
                if (c) run(() => deleteCustomMenu(c.id));
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Content>
  );
}

function AccessControl({ users, access, menus }: { users: UserLite[]; access: AccessLite[]; menus: MenuItem[] }) {
  return (
    <Content
      title="Kontrol Akses Menu per Akun"
      description="Khusus Master. Batasi menu yang bisa dibuka tiap akun. Ubah role di menu Akun; Master tidak terkena batasan."
    >
      <div className="space-y-3">
        {users.length ? (
          users.map((u) => (
            <AccessRow
              key={u.id}
              user={u}
              initial={access.find((a) => a.user_id === u.id)}
              menus={menus.filter((m) => !BASE_MENUS.find((b) => b.id === m.id)?.roles || u.role !== "sales")}
            />
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada akun lain.</p>
        )}
      </div>
    </Content>
  );
}

function AccessRow({ user, initial, menus }: { user: UserLite; initial?: AccessLite; menus: MenuItem[] }) {
  const { pending, run } = useAction();
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [allowed, setAllowed] = useState<string[]>(initial?.allowed_menus ?? menus.map((m) => m.id));
  const dirty =
    enabled !== (initial?.enabled ?? false) ||
    JSON.stringify([...allowed].sort()) !== JSON.stringify([...(initial?.allowed_menus ?? menus.map((m) => m.id))].sort());

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {user.name} <span className="font-mono text-xs font-normal text-muted-foreground">{user.username}</span>
          </p>
          <p className="text-xs text-muted-foreground">{user.role ? ROLE_LABEL[user.role] : "-"}</p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={user.role === "master"} />
          Batasi menu
        </label>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!dirty || pending}
          onClick={() => run(() => setAccessControl(user.id, { enabled, allowed_menus: allowed }))}
        >
          Simpan
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {menus.map((m) => (
          <label
            key={m.id}
            className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs shadow-xs has-disabled:opacity-50"
          >
            <Checkbox
              checked={allowed.includes(m.id)}
              disabled={!enabled}
              onCheckedChange={(c) => setAllowed((s) => (c ? [...new Set([...s, m.id])] : s.filter((x) => x !== m.id)))}
            />
            {m.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function BackupRestore({ tenantCode }: { tenantCode: string }) {
  const { pending, run } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [code, setCode] = useState("");

  return (
    <Content title="Backup &amp; Restore" description="Khusus Master. Hanya data perusahaan ini. Restore menimpa baris dengan ID yang sama.">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await backupTenant();
              if (res.ok && res.data) downloadJSON(res.data, `lourdes-marketing_backup_${tenantCode}_${new Date().toISOString().slice(0, 10)}.json`);
              return { ...res, message: "Backup diunduh" };
            })
          }
        >
          <Download /> Export JSON
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
          <Upload /> Restore JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const json = JSON.parse(await f.text());
              run(() => restoreTenant(json));
            } catch {
              toast.error("File invalid");
            }
          }}
        />
        <Button variant="destructive" className="sm:ml-auto" onClick={() => setConfirmOpen(true)}>
          <Trash2 /> Reset Data Tenant
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus semua data operasional?</DialogTitle>
            <DialogDescription>
              Customer, aktivitas, pipeline, forecast, quotation, dokumen, dll. akan dihapus permanen. Akun &amp; setting
              tetap.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reset_code">
              Ketik kode perusahaan <span className="font-mono">{tenantCode}</span> untuk konfirmasi
            </FieldLabel>
            <Input id="reset_code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={tenantCode} autoComplete="off" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={code !== tenantCode || pending}
              onClick={() =>
                run(async () => {
                  const res = await resetTenantData(code);
                  if (res.ok) {
                    setConfirmOpen(false);
                    setCode("");
                  }
                  return res;
                })
              }
            >
              Hapus Semua Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Content>
  );
}
