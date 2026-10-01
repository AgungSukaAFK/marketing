"use client";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Input teks + label + error untuk react-hook-form. */
export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const error = form.formState.errors[name];
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        {...form.register(name)}
      />
      <FieldError errors={[error as { message?: string } | undefined]} />
    </Field>
  );
}
