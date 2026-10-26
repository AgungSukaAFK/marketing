"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, History, Pencil, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { createUserByModerator, deleteUser, saveTenant, saveUserAssignment } from "@/app/actions/moderator";
import { Content } from "@/components/content";
import { RoleBadge } from "@/components/role-badge";
import { StatusBadge } from "@/components/entity/status-badge";
import { TextField } from "@/components/form/text-field";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { activateSchema, moderatorCreateSchema, tenantSchema } from "@/lib/schemas/account";
import type { ActivityFilters } from "./activity-cells";
import { ActivityView } from "./activity-view";

export type ModUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role | null;
  active: boolean;
  tenant_id: string | null;
  last_seen_at: string | null;
  created_at: string;
};
export type Tenant = { id: string; name: string; code: string; created_at: string };

type Filter = "pending" | "active" | "all";

export function ModeratorView({ users, tenants, meId }: { users: ModUser[]; tenants: Tenant[]; meId: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");
  const [assigning, setAssigning] = useState<ModUser | null>(null);
  const [deleting, setDeleting] = useState<ModUser | null>(null);
  const [tenantEdit, setTenantEdit] = useState<Tenant | "new" | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("users");
  // Activity History dimuat saat tab pertama kali dibuka; key baru = mulai dengan filter baru
  const [activity, setActivity] = useState<{ key: number; initial?: ActivityFilters } | null>(null);
  const [, start] = useTransition();

  const openTab = (v: string) => {
    setTab(v);
    if (v === "activity" && !activity) setActivity({ key: 0 });
  };
  const openHistory = (u: ModUser) => {
    setActivity((a) => ({ key: (a?.key ?? 0) + 1, initial: { actor: u.id } }));
    setTab("activity");
  };

  const tenantName = useMemo(() => new Map(tenants.map((t) => [t.id, t.name])), [tenants]);
  const pendingCount = users.filter((u) => !u.active).length;
  const shown = users
    .filter((u) => (filter === "pending" ? !u.active : filter === "active" ? u.active : true))
    .filter((u) => {
      const s = q.toLowerCase();
      return !s || [u.name, u.username, u.email, tenantName.get(u.tenant_id ?? "") ?? ""].some((x) => x.toLowerCase().includes(s));
    });

  return (
    <Tabs value={tab} onValueChange={openTab} className="col-span-12 gap-4">
      <TabsList>
        <TabsTrigger value="users">
          <UserCheck /> Akun
          {pendingCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
              {pendingCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="tenants">
          <Building2 /> Company / Tenant
        </TabsTrigger>
        <TabsTrigger value="activity">
          <History /> Activity History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <Content
          title="Akun Pengguna"
          description="Akun hasil registrasi menunggu di sini. Aktifkan dengan menentukan company & role."
          cardAction={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> Akun Baru
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="pending">
                    Menunggu <span className="text-muted-foreground tabular-nums">({pendingCount})</span>
                  </TabsTrigger>
                  <TabsTrigger value="active">Aktif</TabsTrigger>
                  <TabsTrigger value="all">Semua</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative sm:ml-auto sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari nama / email / company…"
                  aria-label="Cari akun"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    {["Nama", "Username", "Email", "Company", "Role", "Status", "Daftar", "Last Login", "Aksi"].map((h) => (
                      <TableHead key={h} className="text-muted-foreground">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="font-mono text-xs">{u.username}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{u.tenant_id ? tenantName.get(u.tenant_id) : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={u.active ? "Aktif" : "Menunggu"} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(u.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(u.last_seen_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant={u.active ? "outline" : "default"} onClick={() => setAssigning(u)}>
                            {u.active ? <Pencil /> : <UserCheck />} {u.active ? "Edit" : "Aktifkan"}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Activity history akun ini"
                            aria-label="Activity history akun ini"
                            onClick={() => openHistory(u)}
                          >
                            <History />
                          </Button>
                          {u.id !== meId && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Hapus"
                              aria-label="Hapus"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleting(u)}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!shown.length && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                        {filter === "pending" ? "Tidak ada akun yang menunggu aktivasi" : "Tidak ada data"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Content>
      </TabsContent>

      <TabsContent value="tenants">
        <Content
          title={`Company / Tenant (${tenants.length})`}
          description="Data tiap company terisolasi satu sama lain (RLS per tenant)."
          cardAction={
            <Button size="sm" onClick={() => setTenantEdit("new")}>
              <Plus /> Company Baru
            </Button>
          }
        >
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Nama</TableHead>
                  <TableHead className="text-muted-foreground">Kode</TableHead>
                  <TableHead className="text-right text-muted-foreground">Anggota Aktif</TableHead>
                  <TableHead className="text-muted-foreground">Dibuat</TableHead>
                  <TableHead className="text-muted-foreground">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {users.filter((u) => u.tenant_id === t.id && u.active).length}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</TableCell>
                    <TableCell>
                      <Button size="icon-sm" variant="ghost" title="Edit" aria-label="Edit" onClick={() => setTenantEdit(t)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!tenants.length && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                      Belum ada company
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Content>
      </TabsContent>

      {/* forceMount: filter & halaman tetap saat pindah tab */}
      <TabsContent value="activity" forceMount className="data-[state=inactive]:hidden">
        {activity && <ActivityView key={activity.key} users={users} tenants={tenants} initial={activity.initial} />}
      </TabsContent>

      <AssignDialog user={assigning} tenants={tenants} isSelf={assigning?.id === meId} onClose={() => setAssigning(null)} onSaved={() => router.refresh()} />
      <CreateUserDialog open={creating} tenants={tenants} onClose={() => setCreating(false)} onSaved={() => router.refresh()} />
      <TenantDialog tenant={tenantEdit} onClose={() => setTenantEdit(null)} onSaved={() => router.refresh()} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>Akun yang sudah memiliki data tidak bisa dihapus — nonaktifkan saja.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                const u = deleting;
                if (!u) return;
                start(async () => {
                  const res = await deleteUser(u.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Akun dihapus");
                  router.refresh();
                });
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}

type AssignValues = z.input<typeof activateSchema>;

function AssignDialog({
  user,
  tenants,
  isSelf,
  onClose,
  onSaved,
}: {
  user: ModUser | null;
  tenants: Tenant[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const form = useForm<AssignValues>({ resolver: zodResolver(activateSchema) });
  useEffect(() => {
    if (user)
      form.reset({
        name: user.name,
        username: user.username,
        role: user.role ?? "sales",
        tenant_id: user.tenant_id ?? "",
        // akun pending (belum punya role) → default diaktifkan saat disimpan
        active: user.role ? user.active : true,
      });
  }, [user, form]);

  const role = form.watch("role");
  const tenantErr = form.formState.errors.tenant_id?.message;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user?.active ? "Edit Akun" : "Aktivasi Akun"}</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <form
          id="assign-form"
          className="space-y-4"
          onSubmit={form.handleSubmit((v) =>
            start(async () => {
              if (!user) return;
              const res = await saveUserAssignment(user.id, v);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              onClose();
              onSaved();
            }),
          )}
        >
          <FieldGroup className="gap-4">
            <TextField form={form} name="name" label="Nama Lengkap" />
            <TextField form={form} name="username" label="Username" />
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select value={role} onValueChange={(v) => form.setValue("role", v as AssignValues["role"])} disabled={isSelf}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["sales", "admin", "master", "moderator"] as const).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                      {r === "moderator" && " (platform, tanpa company)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {role !== "moderator" && (
              <Field data-invalid={!!tenantErr}>
                <FieldLabel>Company / Tenant</FieldLabel>
                <Select
                  value={form.watch("tenant_id") || undefined}
                  onValueChange={(v) => form.setValue("tenant_id", v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!tenantErr}>
                    <SelectValue placeholder="-- Pilih company --" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenantErr && <FieldError>{tenantErr}</FieldError>}
              </Field>
            )}
            <Field orientation="horizontal">
              <Switch
                id="active"
                checked={form.watch("active")}
                onCheckedChange={(c) => form.setValue("active", c)}
                disabled={isSelf}
              />
              <FieldLabel htmlFor="active">Akun aktif (bisa login)</FieldLabel>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="assign-form" disabled={pending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TenantDialog({ tenant, onClose, onSaved }: { tenant: Tenant | "new" | null; onClose: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof tenantSchema>>({ resolver: zodResolver(tenantSchema) });
  useEffect(() => {
    if (tenant) form.reset(tenant === "new" ? { name: "", code: "" } : { name: tenant.name, code: tenant.code });
  }, [tenant, form]);
  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tenant === "new" ? "Company Baru" : "Edit Company"}</DialogTitle>
        </DialogHeader>
        <form
          id="tenant-form"
          onSubmit={form.handleSubmit((v) =>
            start(async () => {
              const res = await saveTenant(tenant === "new" || !tenant ? null : tenant.id, v);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              onClose();
              onSaved();
            }),
          )}
        >
          <FieldGroup className="gap-4">
            <TextField form={form} name="name" label="Nama Company" placeholder="PT Contoh Tambang" />
            <TextField form={form} name="code" label="Kode (unik)" placeholder="CONTOH" />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="tenant-form" disabled={pending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CreateValues = z.input<typeof moderatorCreateSchema>;

function CreateUserDialog({
  open,
  tenants,
  onClose,
  onSaved,
}: {
  open: boolean;
  tenants: Tenant[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const form = useForm<CreateValues>({ resolver: zodResolver(moderatorCreateSchema) });
  useEffect(() => {
    if (open) form.reset({ name: "", username: "", email: "", password: "", role: "sales", tenant_id: "" });
  }, [open, form]);

  const role = form.watch("role");
  const tenantErr = form.formState.errors.tenant_id?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Akun Baru</DialogTitle>
          <DialogDescription>Akun langsung aktif — pengguna tinggal login dengan email &amp; password ini.</DialogDescription>
        </DialogHeader>
        <form
          id="create-user-form"
          className="space-y-4"
          onSubmit={form.handleSubmit((v) =>
            start(async () => {
              const res = await createUserByModerator(v);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              onClose();
              onSaved();
            }),
          )}
        >
          <FieldGroup className="gap-4">
            <TextField form={form} name="name" label="Nama Lengkap" />
            <TextField form={form} name="username" label="Username" />
            <TextField form={form} name="email" label="Email" type="email" autoComplete="off" />
            <TextField form={form} name="password" label="Password Awal" type="password" autoComplete="new-password" />
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select value={role} onValueChange={(v) => form.setValue("role", v as CreateValues["role"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["sales", "admin", "master", "moderator"] as const).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                      {r === "moderator" && " (platform, tanpa company)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {role !== "moderator" && (
              <Field data-invalid={!!tenantErr}>
                <FieldLabel>Company / Tenant</FieldLabel>
                <Select
                  value={form.watch("tenant_id") || undefined}
                  onValueChange={(v) => form.setValue("tenant_id", v, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!tenantErr}>
                    <SelectValue placeholder="-- Pilih company --" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenantErr && <FieldError>{tenantErr}</FieldError>}
              </Field>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form="create-user-form" disabled={pending}>
            Buat Akun
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
