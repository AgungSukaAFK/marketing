"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { updatePassword } from "@/app/actions/auth";
import { passwordSchema } from "@/lib/schemas/auth";
import { TextField } from "@/components/form/text-field";
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
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Password Baru</h2>
        <p className="text-sm text-muted-foreground">Masukkan password baru untuk akun Anda.</p>
      </div>
      <FieldGroup>
        <TextField form={form} name="password" label="Password Baru" type="password" autoComplete="new-password" />
        <TextField form={form} name="confirm" label="Ulangi Password" type="password" autoComplete="new-password" />
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full font-bold" disabled={pending}>
        Simpan Password
      </Button>
    </form>
  );
}
