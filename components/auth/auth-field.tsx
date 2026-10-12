"use client";

import type { LucideIcon } from "lucide-react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { AuthInput } from "@/components/auth/auth-input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

/** Field form auth (react-hook-form): label + AuthInput berikon + error. */
export function AuthField<T extends FieldValues>({
  form,
  name,
  label,
  icon,
  type = "text",
  autoComplete,
  placeholder,
  disabled,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const error = form.formState.errors[name];
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <AuthInput
        id={name}
        icon={icon}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        {...form.register(name)}
      />
      <FieldError errors={[error as { message?: string } | undefined]} />
    </Field>
  );
}
