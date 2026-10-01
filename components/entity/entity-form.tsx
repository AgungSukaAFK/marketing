"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { saveEntity } from "@/app/actions/entity";
import { Combobox } from "@/components/form/combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";
import type { EntityDef, FieldDef, Row } from "@/lib/entities";
import type { EntityLookups, Me } from "./types";

type Values = Record<string, string>;

function initialValues(def: EntityDef, row: Row | null, me: Me): Values {
  const v: Values = {};
  for (const f of def.fields) {
    if (f.type === "file") continue;
    if (row) v[f.name] = row[f.name] == null ? "" : String(row[f.name]);
    else if (typeof f.initial === "function") v[f.name] = String(f.initial(me));
    else v[f.name] = f.initial == null ? "" : String(f.initial);
  }
  return v;
}

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);

type FormProps = {
  def: EntityDef;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: Row | null;
  lookups: EntityLookups;
  me: Me;
  onSaved?: () => void;
};

export function EntityForm(props: FormProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* di-mount ulang tiap buka → state form selalu segar */}
        {props.open && (
          <EntityFormBody key={props.row?.id ?? "new"} {...props} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntityFormBody({
  def,
  onOpenChange,
  row,
  lookups,
  me,
  onSaved,
}: FormProps) {
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [defaults] = useState(() => initialValues(def, row, me));

  const form = useForm<Values>({
    // validasi client memakai skema Zod yang sama dengan server action
    resolver: zodResolver(def.schema as never),
    defaultValues: defaults,
  });

  const values = useWatch({ control: form.control }) as Values;
  const isSales = me.role === "sales";
  const customer = lookups.customers.find((c) => c.id === values.customer_id);
  const forecast = lookups.forecasts.find((f) => f.id === values.forecast_ref);

  const onCustomerChange = (id: string) => {
    form.setValue("customer_id", id, { shouldValidate: true });
    const c = lookups.customers.find((x) => x.id === id);
    if (!c) return;
    for (const f of def.fields) {
      if (f.fromCustomer && !(isSales && f.type === "user"))
        form.setValue(f.name, String(c[f.fromCustomer] ?? ""));
    }
  };

  const submit = form.handleSubmit(() =>
    startTransition(async () => {
      const raw: Record<string, unknown> = { ...form.getValues() };
      const supabase = createClient();
      const uploaded: string[] = [];
      try {
        for (const f of def.fields) {
          const file = f.type === "file" ? files[f.name] : null;
          if (!file || !f.pathField) continue;
          const path = `${me.tenant_id}/${def.table}/${crypto.randomUUID()}-${safeName(file.name)}`;
          const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, file);
          if (error) throw new Error(`Upload gagal: ${error.message}`);
          uploaded.push(path);
          raw[f.pathField] = path;
          if (f.nameField) raw[f.nameField] = file.name;
        }
        const res = await saveEntity(def.key, row?.id ?? null, raw);
        if (!res.ok) throw new Error(res.error);
        toast.success(res.message ?? "Disimpan");
        onOpenChange(false);
        onSaved?.();
      } catch (e) {
        if (uploaded.length)
          await supabase.storage.from(STORAGE_BUCKET).remove(uploaded);
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
      }
    }),
  );

  const errorOf = (name: string) =>
    form.formState.errors[name]?.message as string | undefined;

  const renderField = (f: FieldDef) => {
    if (f.hidden) return null;
    const err =
      errorOf(f.name) ?? (f.pathField ? errorOf(f.pathField) : undefined);
    const label = (
      <FieldLabel htmlFor={`f_${f.name}`}>
        {f.label}
        {f.required && <span className="text-destructive">*</span>}
      </FieldLabel>
    );
    let control: React.ReactNode;
    switch (f.type) {
      case "customer":
        control = (
          <Combobox
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={onCustomerChange}
            invalid={!!err}
            allowEmpty={!f.required}
            options={lookups.customers.map((c) => ({
              value: c.id,
              label: `${c.customer_code} - ${c.pt}`,
            }))}
          />
        );
        break;
      case "forecast":
        control = (
          <Combobox
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={(v) => form.setValue(f.name, v, { shouldValidate: true })}
            invalid={!!err}
            options={lookups.forecasts.map((x) => ({
              value: x.id,
              label: `${x.part_no} - ${x.customer?.pt ?? "?"}`,
            }))}
          />
        );
        break;
      case "user":
      case "select": {
        const opts =
          f.type === "user"
            ? lookups.profiles.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.username})`,
              }))
            : (f.options ?? []).map((o) => ({ value: o, label: o }));
        control = (
          <Select
            value={values[f.name] || undefined}
            onValueChange={(v) =>
              form.setValue(f.name, v, { shouldValidate: true })
            }
            disabled={f.type === "user" && isSales}
          >
            <SelectTrigger
              id={`f_${f.name}`}
              className="w-full"
              aria-invalid={!!err}
            >
              <SelectValue placeholder="-- Pilih --" />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        break;
      }
      case "textarea":
        control = (
          <Textarea
            id={`f_${f.name}`}
            rows={3}
            aria-invalid={!!err}
            {...form.register(f.name)}
          />
        );
        break;
      case "file":
        control = (
          <>
            <Input
              id={`f_${f.name}`}
              type="file"
              accept={f.accept}
              onChange={(e) =>
                setFiles((s) => ({
                  ...s,
                  [f.name]: e.target.files?.[0] ?? null,
                }))
              }
            />
            {row && f.pathField && row[f.pathField] && (
              <FieldDescription>
                File saat ini:{" "}
                {(f.nameField && row[f.nameField]) || "terlampir"} — pilih file
                baru untuk mengganti.
              </FieldDescription>
            )}
          </>
        );
        break;
      default:
        control = (
          <Input
            id={`f_${f.name}`}
            type={f.type === "number" ? "number" : f.type}
            step={f.type === "number" ? "any" : undefined}
            aria-invalid={!!err}
            {...form.register(f.name)}
          />
        );
    }
    return (
      <Field
        key={f.name}
        data-invalid={!!err}
        className={f.type === "textarea" ? "sm:col-span-2" : undefined}
      >
        {label}
        {control}
        {err && <FieldError>{err}</FieldError>}
        {f.type === "customer" && customer && (
          <AutoInfo
            items={[
              ["PT", customer.pt],
              ["PIC", customer.pic],
              ["WA", customer.wa],
              ["Site", customer.site],
            ]}
          />
        )}
        {f.type === "forecast" && forecast && (
          <AutoInfo
            items={[
              ["PT", forecast.customer?.pt],
              [
                "Sales",
                lookups.profiles.find((p) => p.id === forecast.sales_id)
                  ?.username,
              ],
              ["Part No", forecast.part_no],
            ]}
          />
        )}
      </Field>
    );
  };

  const preview = def.preview?.(values);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {row ? "Edit" : "Tambah"} — {def.title}
        </DialogTitle>
        <DialogDescription>Field bertanda * wajib diisi.</DialogDescription>
      </DialogHeader>
      <form id="entity-form" onSubmit={submit} noValidate>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {def.fields.map(renderField)}
        </FieldGroup>
        {preview && (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
            {preview.map((p) => (
              <div key={p.label}>
                <div className="text-xs text-muted-foreground">
                  {p.label} (otomatis)
                </div>
                <div className="font-bold">{p.value}</div>
              </div>
            ))}
          </div>
        )}
      </form>
      <DialogFooter>
        <Button
          variant="secondary"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          Batal
        </Button>
        <Button
          type="submit"
          form="entity-form"
          disabled={pending}
          className="font-bold"
        >
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </>
  );
}

function AutoInfo({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-muted p-2 text-xs">
      {items.map(([k, v]) => (
        <div key={k} className="truncate">
          <span className="text-muted-foreground">{k} (auto): </span>
          {v || "-"}
        </div>
      ))}
    </div>
  );
}
