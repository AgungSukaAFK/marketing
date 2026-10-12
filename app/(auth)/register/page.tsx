"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { AtSign, CircleCheck, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { register as registerAction } from "@/app/actions/auth";
import { registerSchema } from "@/lib/schemas/auth";
import { AuthField } from "@/components/auth/auth-field";
import { AuthHeading } from "@/components/auth/auth-shell";
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
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CircleCheck className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Registrasi berhasil</h1>
          <p className="text-sm text-muted-foreground">
            Akun Anda <span className="font-medium text-foreground">belum aktif</span>. Moderator akan memverifikasi,
            menentukan perusahaan dan role Anda. Setelah diaktifkan, Anda bisa masuk.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Kembali ke halaman masuk</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Daftar Akun" description="Akun aktif setelah disetujui moderator." />
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FieldGroup className="gap-4">
          <AuthField form={form} name="name" label="Nama Lengkap" icon={UserRound} autoComplete="name" />
          <AuthField form={form} name="username" label="Username" icon={AtSign} placeholder="mis. budi.santoso" autoComplete="username" />
          <AuthField form={form} name="email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="nama@perusahaan.com" />
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField form={form} name="password" label="Password" icon={LockKeyhole} type="password" autoComplete="new-password" />
            <AuthField form={form} name="confirm" label="Ulangi Password" icon={LockKeyhole} type="password" autoComplete="new-password" />
          </div>
        </FieldGroup>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Mendaftar…" : "Daftar"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="rounded-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Masuk
          </Link>
        </p>
      </form>
    </>
  );
}
