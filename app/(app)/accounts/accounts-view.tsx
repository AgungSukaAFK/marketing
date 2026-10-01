"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { createAccount, deleteAccount, resetAccountPassword, updateAccount } from "@/app/actions/accounts";
import { StatusBadge } from "@/components/entity/status-badge";
import { RoleBadge } from "@/components/role-badge";
import { TextField } from "@/components/form/text-field";
import { useOnlineUsers } from "@/components/layout/presence-provider";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABEL, type TenantRole } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { createAccountSchema, updateAccountSchema } from "@/lib/schemas/account";
import { cn } from "@/lib/utils";

export type AccountRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: TenantRole;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
};
export type LoginRow = { id: number; user_id: string; action: "LOGIN" | "LOGOUT"; created_at: string };

/** Hierarki prototipe: Master kelola semua, Admin hanya Sales. */
const canManage = (actor: TenantRole, target: TenantRole) => actor === "master" || (actor === "admin" && target === "sales");

export function AccountsView({ users, history, me }: { users: AccountRow[]; history: LoginRow[]; me: { id: string; role: TenantRole } }) {
  const router = useRouter();
  const online = new Set(useOnlineUsers().map((o) => o.user_id));
  const [editing, setEditing] = useState<AccountRow | "new" | null>(null);
  const [resetting, setResetting] = useState<AccountRow | null>(null);
  const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const [, start] = useTransition();
  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Akun Terdaftar ({users.length})</CardTitle>
            <CardDescription>
              {me.role === "master" ? "Master bisa kelola semua role." : "Admin hanya bisa kelola akun Sales."}
            </CardDescription>
          </div>
          <Button className="font-bold" onClick={() => setEditing("new")}>
            <Plus /> Tambah Akun
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {["Nama", "Username", "Email", "Role", "Status", "Online", "Last Login", "Dibuat", "Aksi"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const manageable = canManage(me.role, u.role);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-nowrap">{u.name}</TableCell>
                    <TableCell className="font-mono text-xs">{u.username}</TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={u.active ? "Aktif" : "Nonaktif"} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={cn("size-2 rounded-full", online.has(u.id) ? "bg-brand" : "bg-muted-foreground/40")} />
                        {online.has(u.id) ? "Online" : "Offline"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(u.last_seen_at)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(u.created_at)}</TableCell>
                    <TableCell>
                      {manageable && (
                        <div className="flex gap-1">
                          <Button size="icon-sm" variant="secondary" title="Edit" aria-label="Edit" onClick={() => setEditing(u)}>
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="secondary"
                            title="Reset password"
                            aria-label="Reset password"
                            onClick={() => setResetting(u)}
                          >
                            <KeyRound />
                          </Button>
                          {u.id !== me.id && (
                            <Button size="icon-sm" variant="destructive" title="Hapus" aria-label="Hapus" onClick={() => setDeleting(u)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Login (300 terbaru)</CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(h.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{byId.get(h.user_id)?.username ?? "-"}</TableCell>
                  <TableCell>{byId.get(h.user_id)?.name ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge value={h.action} />
                  </TableCell>
                </TableRow>
              ))}
              {!history.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Belum ada riwayat
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AccountDialog
        target={editing}
        actorRole={me.role}
        isSelf={editing !== "new" && editing?.id === me.id}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />

      <ResetPasswordDialog target={resetting} onClose={() => setResetting(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun {deleting?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun yang sudah memiliki data tidak bisa dihapus — nonaktifkan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const u = deleting;
                if (!u) return;
                start(async () => {
                  const res = await deleteAccount(u.id);
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
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  actorRole,
  disabled,
}: {
  value: TenantRole;
  onChange: (v: TenantRole) => void;
  actorRole: TenantRole;
  disabled?: boolean;
}) {
  const roles: TenantRole[] = actorRole === "master" ? ["sales", "admin", "master"] : ["sales"];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TenantRole)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AccountDialog({
  target,
  actorRole,
  isSelf,
  onClose,
  onSaved,
}: {
  target: AccountRow | "new" | null;
  actorRole: TenantRole;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = target === "new";
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Tambah Akun" : "Edit Akun"}</DialogTitle>
        </DialogHeader>
        {isNew ? (
          <CreateForm actorRole={actorRole} onDone={() => (onClose(), onSaved())} />
        ) : (
          target && <EditForm user={target} actorRole={actorRole} isSelf={isSelf} onDone={() => (onClose(), onSaved())} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({ actorRole, onDone }: { actorRole: TenantRole; onDone: () => void }) {
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof createAccountSchema>>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { name: "", username: "", email: "", password: "", role: "sales" },
  });
  return (
    <form
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await createAccount(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Akun ditambah (langsung aktif)");
          onDone();
        }),
      )}
      className="space-y-4"
    >
      <FieldGroup className="gap-4">
        <TextField form={form} name="name" label="Nama Lengkap" />
        <TextField form={form} name="username" label="Username" />
        <TextField form={form} name="email" label="Email" type="email" />
        <TextField form={form} name="password" label="Password Awal" type="password" autoComplete="new-password" />
        <Field>
          <FieldLabel>Role</FieldLabel>
          <RoleSelect value={form.watch("role")} onChange={(v) => form.setValue("role", v)} actorRole={actorRole} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending} className="font-bold">
          Simpan
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditForm({
  user,
  actorRole,
  isSelf,
  onDone,
}: {
  user: AccountRow;
  actorRole: TenantRole;
  isSelf: boolean;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const form = useForm<z.input<typeof updateAccountSchema>>({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: { name: user.name, username: user.username, role: user.role, active: user.active },
  });
  useEffect(() => form.reset({ name: user.name, username: user.username, role: user.role, active: user.active }), [user, form]);
  return (
    <form
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await updateAccount(user.id, v);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Akun diupdate");
          onDone();
        }),
      )}
      className="space-y-4"
    >
      <FieldGroup className="gap-4">
        <TextField form={form} name="name" label="Nama Lengkap" />
        <TextField form={form} name="username" label="Username" />
        <Field>
          <FieldLabel>Role</FieldLabel>
          <RoleSelect
            value={form.watch("role")}
            onChange={(v) => form.setValue("role", v)}
            actorRole={actorRole}
            disabled={isSelf}
          />
        </Field>
        <Field orientation="horizontal">
          <Switch
            id="active"
            checked={form.watch("active")}
            onCheckedChange={(c) => form.setValue("active", c)}
            disabled={isSelf}
          />
          <FieldLabel htmlFor="active">Akun aktif</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="submit" disabled={pending} className="font-bold">
          Simpan
        </Button>
      </DialogFooter>
    </form>
  );
}

function ResetPasswordDialog({ target, onClose }: { target: AccountRow | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setPw("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password — {target?.username}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="newpw">Password baru (min. 8 karakter)</FieldLabel>
          <Input id="newpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <DialogFooter>
          <Button
            disabled={pending || pw.length < 8}
            className="font-bold"
            onClick={() =>
              start(async () => {
                if (!target) return;
                const res = await resetAccountPassword(target.id, pw);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Password direset");
                setPw("");
                onClose();
              })
            }
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
