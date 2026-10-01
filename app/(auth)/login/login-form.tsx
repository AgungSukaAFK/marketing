"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { login } from "@/app/actions/auth";
import { loginSchema } from "@/lib/schemas/auth";
import { TextField } from "@/components/form/text-field";
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
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div>
        <h2 className="text-xl font-bold">Login</h2>
        <p className="text-sm text-muted-foreground">Masuk dengan email &amp; password.</p>
      </div>
      <FieldGroup>
        <TextField form={form} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={form} name="password" label="Password" type="password" autoComplete="current-password" />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full font-bold" disabled={pending}>
        {pending ? "Memproses…" : "Masuk"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/register" className="text-brand-text hover:underline">
          Registrasi
        </Link>
        <Link href="/forgot" className="text-muted-foreground hover:underline">
          Lupa Password?
        </Link>
      </div>
    </form>
  );
}
