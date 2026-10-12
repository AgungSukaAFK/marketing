"use client";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { PasswordInput } from "@/components/form/password-input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Input teks + label + error untuk react-hook-form. type="password" dapat tombol lihat. */
export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  description,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  description?: string;
}) {
  const error = form.formState.errors[name];
  const common = {
    id: name,
    autoComplete,
    placeholder,
    "aria-invalid": !!error,
    ...form.register(name),
  };
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {type === "password" ? <PasswordInput {...common} /> : <Input type={type} {...common} />}
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={[error as { message?: string } | undefined]} />
    </Field>
  );
}
