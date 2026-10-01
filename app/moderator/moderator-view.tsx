"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { deleteUser, saveTenant, saveUserAssignment } from "@/app/actions/moderator";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { activateSchema, tenantSchema } from "@/lib/schemas/account";

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
  const [, start] = useTransition();

  const tenantName = useMemo(() => new Map(tenants.map((t) => [t.id, t.name])), [tenants]);
  const pendingCount = users.filter((u) => !u.active).length;
  const shown = users
    .filter((u) => (filter === "pending" ? !u.active : filter === "active" ? u.active : true))
    .filter((u) => {
      const s = q.toLowerCase();
      return !s || [u.name, u.username, u.email, tenantName.get(u.tenant_id ?? "") ?? ""].some((x) => x.toLowerCase().includes(s));
    });

  return (
    <Tabs defaultValue="users" className="space-y-4">
      <TabsList>
        <TabsTrigger value="users">
          <UserCheck /> Akun {pendingCount > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-black">{pendingCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="tenants">
          <Building2 /> Company / Tenant
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <Card>
          <CardHeader>
            <CardTitle>Akun Pengguna</CardTitle>
            <CardDescription>
              Akun hasil registrasi menunggu di sini. Aktifkan dengan menentukan company &amp; role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="pending">Menunggu ({pendingCount})</TabsTrigger>
                  <TabsTrigger value="active">Aktif</TabsTrigger>
                  <TabsTrigger value="all">Semua</TabsTrigger>
                </TabsList>
              </Tabs>
              <Input placeholder="Cari nama / email / company…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto w-64" />
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Nama", "Username", "Email", "Company", "Role", "Status", "Daftar", "Last Login", "Aksi"].map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-nowrap">{u.name}</TableCell>
                      <TableCell className="font-mono text-xs">{u.username}</TableCell>
                      <TableCell className="text-xs">{u.email}</TableCell>
                      <TableCell className="whitespace-nowrap">{u.tenant_id ? tenantName.get(u.tenant_id) : "-"}</TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={u.active ? "Aktif" : "Menunggu"} />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(u.created_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(u.last_seen_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant={u.active ? "secondary" : "default"} className="font-bold" onClick={() => setAssigning(u)}>
                            {u.active ? <Pencil /> : <UserCheck />} {u.active ? "Edit" : "Aktifkan"}
                          </Button>
                          {u.id !== meId && (
                            <Button size="icon-sm" variant="destructive" aria-label="Hapus" onClick={() => setDeleting(u)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!shown.length && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                        {filter === "pending" ? "Tidak ada akun yang menunggu aktivasi" : "Tidak ada data"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tenants">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Company / Tenant ({tenants.length})</CardTitle>
              <CardDescription>Data tiap company terisolasi satu sama lain (RLS per tenant).</CardDescription>
            </div>
            <Button className="font-bold" onClick={() => setTenantEdit("new")}>
              <Plus /> Company Baru
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Anggota Aktif</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="tabular-nums">{users.filter((u) => u.tenant_id === t.id && u.active).length}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(t.created_at)}</TableCell>
                    <TableCell>
                      <Button size="icon-sm" variant="secondary" aria-label="Edit" onClick={() => setTenantEdit(t)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <AssignDialog user={assigning} tenants={tenants} isSelf={assigning?.id === meId} onClose={() => setAssigning(null)} onSaved={() => router.refresh()} />
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
              className="bg-destructive text-white hover:bg-destructive/90"
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
          <Button type="submit" form="assign-form" disabled={pending} className="font-bold">
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
          <Button type="submit" form="tenant-form" disabled={pending} className="font-bold">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
