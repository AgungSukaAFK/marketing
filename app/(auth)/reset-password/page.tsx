"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { updatePassword } from "@/app/actions/auth";
import { passwordSchema } from "@/lib/schemas/auth";
import { AuthField } from "@/components/auth/auth-field";
import { AuthHeading } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updatePassword(values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.push("/dashboard");
    }),
  );

  return (
    <>
      <AuthHeading title="Password Baru" description="Masukkan password baru untuk akun Anda." />
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FieldGroup className="gap-4">
          <AuthField form={form} name="password" label="Password Baru" icon={LockKeyhole} type="password" autoComplete="new-password" />
          <AuthField form={form} name="confirm" label="Ulangi Password" icon={LockKeyhole} type="password" autoComplete="new-password" />
        </FieldGroup>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Menyimpan…" : "Simpan Password"}
        </Button>
      </form>
    </>
  );
}
