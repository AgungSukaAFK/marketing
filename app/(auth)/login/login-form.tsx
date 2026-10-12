"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { login } from "@/app/actions/auth";
import { loginSchema } from "@/lib/schemas/auth";
import { AuthField } from "@/components/auth/auth-field";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await login(values, next);
      if (res && !res.ok) toast.error(res.error);
    }),
  );

  return (
    <>
      <AuthHeading title="Masuk" description="Masuk dengan email & password akun Anda." />
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FieldGroup className="gap-4">
          <AuthField form={form} name="email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="nama@perusahaan.com" />
          <div className="space-y-2">
            <AuthField form={form} name="password" label="Password" icon={LockKeyhole} type="password" autoComplete="current-password" />
            <div className="flex justify-end">
              <Link href="/forgot" className="rounded-sm text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                Lupa password?
              </Link>
            </div>
          </div>
        </FieldGroup>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Memproses…" : "Masuk"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="rounded-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Daftar
          </Link>
        </p>
      </form>
    </>
  );
}
