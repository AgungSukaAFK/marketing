"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Kumpulan field form (label + kontrol + pesan error). */
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex w-full flex-col gap-5", className)}
      {...props}
    />
  )
}

const fieldVariants = cva("group/field flex w-full gap-2", {
  variants: {
    orientation: {
      vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
      horizontal: "flex-row items-center [&>[data-slot=field-label]]:flex-auto",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
})

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "inline-flex w-fit items-center gap-1 leading-snug group-data-[invalid=true]/field:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-xs leading-normal text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content =
    children ??
    [...new Set((errors ?? []).map((e) => e?.message).filter(Boolean))].join(
      " · "
    )

  if (!content) return null

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup }
