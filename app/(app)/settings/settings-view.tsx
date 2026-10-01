"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Pencil, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AppSettings } from "@/lib/auth";
import {
  ACCENTS,
  BASE_MENUS,
  DENSITIES,
  FONTS,
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
    <div className="space-y-6">
      <AppIdentity settings={props.settings} />
      <HeaderControls cfg={props.settings.header_cfg} />
      <MenuEditor menus={props.menus} />
      <CustomMenus items={props.customMenus} />
      {isMaster && (
        <AccessControl users={props.users} access={props.access} menus={props.menus} />
      )}
      {isMaster && <BackupRestore tenantCode={props.tenantCode} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OptionSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Identitas Aplikasi</CardTitle>
        <CardDescription>Berlaku untuk semua akun di perusahaan ini. Tema terang/gelap dipilih tiap user di header.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="app_name">Nama Aplikasi</FieldLabel>
            <Input id="app_name" value={v.app_name} onChange={(e) => setV({ ...v, app_name: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>Aksen</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACCENTS).map(([name, [c]]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setV({ ...v, accent: name })}
                  aria-pressed={v.accent === name}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs aria-pressed:border-foreground aria-pressed:font-bold"
                >
                  <span className="size-3 rounded-full" style={{ background: c }} /> {name}
                </button>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel>Font</FieldLabel>
            <OptionSelect value={v.font} onChange={(font) => setV({ ...v, font })} options={Object.keys(FONTS)} />
          </Field>
          <Field>
            <FieldLabel>Densitas</FieldLabel>
            <OptionSelect
              value={v.density}
              onChange={(d) => setV({ ...v, density: d as AppSettings["density"] })}
              options={[...DENSITIES]}
            />
          </Field>
        </div>
        <Button className="font-bold" disabled={pending} onClick={() => run(() => saveAppSettings(v))}>
          Simpan Tampilan
        </Button>
      </CardContent>
    </Card>
  );
}

function HeaderControls({ cfg }: { cfg: HeaderCfg }) {
  const { run } = useAction();
  const [v, setV] = useState(cfg);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontrol Header</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {(Object.keys(HEADER_CFG_LABELS) as (keyof HeaderCfg)[]).map((k) => (
          <Field key={k} orientation="horizontal" className="rounded-xl bg-muted p-3">
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
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Urutan, Visibilitas, Nama &amp; Ikon Menu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((m, i) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-2">
            <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
            <MenuIcon name={m.icon} className="size-4" />
            <span className="w-24 truncate font-mono text-xs text-muted-foreground">{m.id}</span>
            <Input
              value={m.label}
              onChange={(e) => update(m.id, { label: e.target.value })}
              className="h-8 min-w-[140px] flex-1"
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
            <Button size="icon-sm" variant="secondary" onClick={() => move(i, -1)} aria-label="Naik">
              <ArrowUp />
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={() => move(i, 1)} aria-label="Turun">
              <ArrowDown />
            </Button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button className="font-bold" disabled={pending} onClick={save}>
            Simpan Menu
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => run(resetMenuConfig)}>
            <RotateCcw /> Reset Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomMenus({ items }: { items: CustomMenuRow[] }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState({ menu_key: "", label: "", icon: "file-text" as (typeof MENU_ICONS)[number] });
  const [editing, setEditing] = useState<CustomMenuRow | null>(null);
  const [content, setContent] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu Kustom (SOP, Catatan, Info)</CardTitle>
        <CardDescription>Isi berupa HTML — disanitasi otomatis saat ditampilkan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="ID (mis: sop)"
            value={form.menu_key}
            onChange={(e) => setForm({ ...form, menu_key: e.target.value })}
            className="w-40"
          />
          <Input
            placeholder="Label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-56"
          />
          <Select value={form.icon} onValueChange={(icon) => setForm({ ...form, icon: icon as typeof form.icon })}>
            <SelectTrigger className="w-44">
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
            className="font-bold"
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
        <div className="space-y-2">
          {items.length ? (
            items.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl bg-muted p-2 text-sm">
                <MenuIcon name={c.icon} className="size-4" />
                <span className="font-mono text-xs">{c.menu_key}</span> — {c.label}
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-auto"
                  onClick={() => {
                    setEditing(c);
                    setContent(c.content);
                  }}
                >
                  <Pencil /> Edit Isi
                </Button>
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteCustomMenu(c.id))}>
                  <Trash2 /> Hapus
                </Button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada menu kustom</p>
          )}
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Isi — {editing?.label}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="h-80 font-mono text-xs" />
            <div className="h-80 overflow-auto rounded-xl border p-3">
              <SafeHtml html={content} className="prose prose-sm dark:prose-invert max-w-none" />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="font-bold"
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
    </Card>
  );
}

function AccessControl({ users, access, menus }: { users: UserLite[]; access: AccessLite[]; menus: MenuItem[] }) {
  return (
    <Card className="border-rose-500/30">
      <CardHeader>
        <CardTitle className="text-rose-600 dark:text-rose-400">Kontrol Akses Master — Batasi Menu Per Akun</CardTitle>
        <CardDescription>Ubah role akun di menu Akun. Master tidak terkena batasan menu.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <p className="text-sm text-muted-foreground">Belum ada akun lain.</p>
        )}
      </CardContent>
    </Card>
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
    <div className="space-y-2 rounded-xl bg-muted p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold">
          {user.name} ({user.username}) — {user.role ? ROLE_LABEL[user.role] : "-"}
        </span>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={user.role === "master"} />
          Aktifkan Batasan Menu
        </label>
        <Button
          size="sm"
          className="ml-auto font-bold"
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
            className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[11px] has-disabled:opacity-50"
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
    <Card>
      <CardHeader>
        <CardTitle>Backup &amp; Restore</CardTitle>
        <CardDescription>Hanya data perusahaan ini. Restore menimpa baris dengan ID yang sama.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await backupTenant();
              if (res.ok && res.data) downloadJSON(res.data, `titan_backup_${tenantCode}_${new Date().toISOString().slice(0, 10)}.json`);
              return { ...res, message: "Backup diunduh" };
            })
          }
        >
          <Download /> Export JSON
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => fileRef.current?.click()}>
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
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 /> Reset Data Tenant
        </Button>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus semua data operasional?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Customer, aktivitas, pipeline, forecast, quotation, dokumen, dll. akan dihapus permanen. Akun &amp; setting
            tetap. Ketik kode perusahaan <b className="font-mono">{tenantCode}</b> untuk konfirmasi.
          </p>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={tenantCode} />
          <DialogFooter>
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
    </Card>
  );
}
