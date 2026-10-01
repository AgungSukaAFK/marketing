"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { CircleCheck } from "lucide-react";
import { register as registerAction } from "@/app/actions/auth";
import { registerSchema } from "@/lib/schemas/auth";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";

export default function RegisterPage() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", username: "", email: "", password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await registerAction(values);
      if (!res.ok) return void toast.error(res.error);
      setDone(true);
    }),
  );

  if (done) {
    return (
      <div className="space-y-4">
        <CircleCheck className="size-10 text-brand-text" />
        <h2 className="text-xl font-bold">Registrasi berhasil</h2>
        <p className="text-sm text-muted-foreground">
          Akun Anda <b>belum aktif</b>. Moderator akan memverifikasi, menentukan perusahaan (tenant) dan role Anda.
          Setelah diaktifkan, Anda bisa login.
        </p>
        <Button asChild variant="secondary">
          <Link href="/login">Kembali ke Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div>
        <h2 className="text-xl font-bold">Registrasi</h2>
        <p className="text-sm text-muted-foreground">Akun akan aktif setelah disetujui moderator.</p>
      </div>
      <FieldGroup className="gap-4">
        <TextField form={form} name="name" label="Nama Lengkap" autoComplete="name" />
        <TextField form={form} name="username" label="Username" placeholder="mis. budi.santoso" autoComplete="username" />
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={form} name="password" label="Password" type="password" autoComplete="new-password" />
        <TextField form={form} name="confirm" label="Ulangi Password" type="password" autoComplete="new-password" />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full font-bold" disabled={pending}>
        {pending ? "Mendaftar…" : "Daftar"}
      </Button>
      <Link href="/login" className="block text-sm text-brand-text hover:underline">
        Sudah punya akun? Login
      </Link>
    </form>
  );
}
