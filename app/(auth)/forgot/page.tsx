"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { forgotPassword } from "@/app/actions/auth";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

export default function ForgotPage() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);

  return (
    <>
      <AuthHeading title="Lupa Password" description="Kami kirim link reset ke email Anda." />
      {sent ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4 text-sm dark:bg-muted/10">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>{sent}</p>
        </div>
      ) : (
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
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <AuthInput id="email" name="email" type="email" icon={Mail} required autoComplete="email" placeholder="nama@perusahaan.com" />
            <FieldDescription>Lokal: buka Mailpit di http://127.0.0.1:54324 untuk melihat email.</FieldDescription>
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Mengirim…" : "Kirim Link Reset"}
          </Button>
        </form>
      )}
      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" /> Kembali ke halaman masuk
      </Link>
    </>
  );
}
