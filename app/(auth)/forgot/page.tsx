"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { forgotPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ForgotPage() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        startTransition(async () => {
          const res = await forgotPassword(email);
          if (!res.ok) return void toast.error(res.error);
          setSent(res.message ?? "Terkirim");
        });
      }}
    >
      <div>
        <h2 className="text-xl font-bold">Lupa Password</h2>
        <p className="text-sm text-muted-foreground">Kami kirim link reset ke email Anda.</p>
      </div>
      {sent ? (
        <p className="rounded-lg border border-brand/30 bg-brand/10 p-3 text-sm">{sent}</p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" required autoComplete="email" />
            <FieldDescription>Lokal: buka Mailpit di http://127.0.0.1:54324 untuk melihat email.</FieldDescription>
          </Field>
          <Button type="submit" size="lg" className="w-full font-bold" disabled={pending}>
            {pending ? "Mengirim…" : "Kirim Link Reset"}
          </Button>
        </>
      )}
      <Link href="/login" className="block text-sm text-brand-text hover:underline">
        Kembali ke Login
      </Link>
    </form>
  );
}
