"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveEntity } from "@/app/actions/entity";
import { AffixInput } from "@/components/form/affix-input";
import { DatePicker } from "@/components/form/date-picker";
import { FileDropzone } from "@/components/form/file-dropzone";
import { MonthPicker } from "@/components/form/month-picker";
import { MultiSelect } from "@/components/form/multi-select";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import {
  SearchableSelect,
  SearchableSelectContent,
  SearchableSelectItem,
  SearchableSelectTrigger,
  SearchableSelectValue,
} from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/constants";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_MB,
  asAttachments,
  type Attachment,
  type EntityDef,
  type FieldDef,
  type Row,
} from "@/lib/entities";
import type { EntityLookups, Me } from "./types";

type Values = Record<string, string>;

function initialValues(def: EntityDef, row: Row | null, me: Me): Values {
  const v: Values = {};
  for (const f of def.fields) {
    if (f.type === "file" || f.type === "files") continue;
    if (row && Array.isArray(row[f.name])) v[f.name] = row[f.name].join(",");
    else if (row) v[f.name] = row[f.name] == null ? "" : String(row[f.name]);
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
  // field "files": lampiran tersimpan yang dipertahankan + file baru
  const [kept, setKept] = useState<Record<string, Attachment[]>>(() =>
    Object.fromEntries(
      def.fields
        .filter((f) => f.type === "files")
        .map((f) => [f.name, asAttachments(row?.[f.name])]),
    ),
  );
  const [newFiles, setNewFiles] = useState<Record<string, File[]>>({});
  const [progress, setProgress] = useState<string | null>(null);
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
      const upload = async (file: File) => {
        const path = `${me.tenant_id}/${def.table}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error(`Upload ${file.name} gagal: ${error.message}`);
        uploaded.push(path);
        return path;
      };
      try {
        for (const f of def.fields) {
          if (f.type === "files") {
            const list = [...(kept[f.name] ?? [])];
            const pending = newFiles[f.name] ?? [];
            for (const [i, file] of pending.entries()) {
              setProgress(`Mengunggah ${i + 1}/${pending.length}…`);
              list.push({ path: await upload(file), name: file.name, size: file.size });
            }
            raw[f.name] = list;
            continue;
          }
          const file = f.type === "file" ? files[f.name] : null;
          if (!file || !f.pathField) continue;
          raw[f.pathField] = await upload(file);
          if (f.nameField) raw[f.nameField] = file.name;
        }
        setProgress(null);
        const res = await saveEntity(def.key, row?.id ?? null, raw);
        if (!res.ok) throw new Error(res.error);
        toast.success(res.message ?? "Disimpan");
        onOpenChange(false);
        onSaved?.();
      } catch (e) {
        if (uploaded.length)
          await supabase.storage.from(STORAGE_BUCKET).remove(uploaded);
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
      } finally {
        setProgress(null);
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
    const setValue = (v: string) => form.setValue(f.name, v, { shouldValidate: true });
    let control: React.ReactNode;
    switch (f.type) {
      case "customer":
        control = (
          <OptionSelect
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={onCustomerChange}
            invalid={!!err}
            allowEmpty={!f.required}
            placeholder="-- Pilih customer --"
            options={lookups.customers.map((c) => ({
              value: c.id,
              label: `${c.customer_code} - ${c.pt}`,
            }))}
          />
        );
        break;
      case "forecast":
        control = (
          <OptionSelect
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={setValue}
            invalid={!!err}
            placeholder="-- Pilih forecast --"
            options={lookups.forecasts.map((x) => ({
              value: x.id,
              label: `${x.part_no} - ${x.customer?.pt ?? "?"}`,
            }))}
          />
        );
        break;
      case "user":
      case "select":
        control = (
          <OptionSelect
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={setValue}
            invalid={!!err}
            disabled={f.type === "user" && isSales}
            options={
              f.type === "user"
                ? lookups.profiles.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.username})`,
                  }))
                : (f.options ?? []).map((o) => ({ value: o, label: o }))
            }
          />
        );
        break;
      case "users":
        control = (
          <MultiSelect
            id={`f_${f.name}`}
            value={(values[f.name] ?? "").split(",").filter(Boolean)}
            onChange={(ids) => setValue(ids.join(","))}
            invalid={!!err}
            placeholder="-- Pilih user --"
            options={lookups.profiles.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.username})`,
            }))}
          />
        );
        break;
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
      case "date":
        control = (
          <DatePicker
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={setValue}
            invalid={!!err}
          />
        );
        break;
      case "month":
        control = (
          <MonthPicker
            id={`f_${f.name}`}
            value={values[f.name] ?? ""}
            onChange={setValue}
            invalid={!!err}
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
              className="cursor-pointer file:mr-3 file:cursor-pointer"
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
                <span className="font-medium text-foreground">
                  {(f.nameField && row[f.nameField]) || "terlampir"}
                </span>{" "}
                — pilih file baru untuk mengganti.
              </FieldDescription>
            )}
          </>
        );
        break;
      case "files":
        control = (
          <FileDropzone
            id={`f_${f.name}`}
            existing={kept[f.name] ?? []}
            onExistingChange={(a) => setKept((s) => ({ ...s, [f.name]: a }))}
            files={newFiles[f.name] ?? []}
            onFilesChange={(l) => setNewFiles((s) => ({ ...s, [f.name]: l }))}
            maxSizeMB={MAX_ATTACHMENT_MB}
            maxFiles={MAX_ATTACHMENTS}
            accept={f.accept}
            invalid={!!err}
            disabled={pending}
          />
        );
        break;
      case "number":
        control = f.money ? (
          <CurrencyInput
            id={`f_${f.name}`}
            value={Number(values[f.name]) || 0}
            onValueChange={(n) => setValue(n ? String(n) : "")}
            aria-invalid={!!err}
            inputMode="numeric"
          />
        ) : f.suffix ? (
          <AffixInput
            id={`f_${f.name}`}
            type="number"
            step="any"
            inputMode="decimal"
            suffix={f.suffix}
            aria-invalid={!!err}
            {...form.register(f.name)}
          />
        ) : (
          <Input
            id={`f_${f.name}`}
            type="number"
            step="any"
            inputMode="decimal"
            className="text-right tabular-nums"
            aria-invalid={!!err}
            {...form.register(f.name)}
          />
        );
        break;
      default:
        control = (
          <Input
            id={`f_${f.name}`}
            type={f.type}
            aria-invalid={!!err}
            {...form.register(f.name)}
          />
        );
    }
    return (
      <Field
        key={f.name}
        data-invalid={!!err}
        className={f.type === "textarea" || f.type === "files" ? "sm:col-span-2" : undefined}
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
        <DialogDescription>
          Field bertanda <span className="text-destructive">*</span> wajib
          diisi.
        </DialogDescription>
      </DialogHeader>
      <form id="entity-form" onSubmit={submit} noValidate>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {def.fields.map(renderField)}
        </FieldGroup>
        {preview && (
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-3 dark:bg-muted/10">
            {preview.map((p) => (
              <div key={p.label}>
                <div className="text-xs font-medium text-muted-foreground">
                  {p.label} <span className="font-normal">(otomatis)</span>
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {p.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          Batal
        </Button>
        <Button type="submit" form="entity-form" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? (progress ?? "Menyimpan…") : "Simpan"}
        </Button>
      </DialogFooter>
    </>
  );
}

function AutoInfo({ items }: { items: [string, string | null | undefined][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border bg-muted/50 px-2.5 py-2 text-xs dark:bg-muted/10">
      {items.map(([k, v]) => (
        <div key={k} className="truncate" title={v ?? undefined}>
          <span className="text-muted-foreground">{k}: </span>
          <span className="font-medium">{v || "-"}</span>
        </div>
      ))}
    </div>
  );
}

const EMPTY = "__empty__";

/** Select pilihan: > 7 opsi pakai SearchableSelect (styling-guide §8). */
function OptionSelect({
  id,
  value,
  onChange,
  options,
  invalid,
  disabled,
  allowEmpty,
  placeholder = "-- Pilih --",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  invalid?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const handle = (v: string) => onChange(v === EMPTY ? "" : v);
  if (options.length > 7) {
    return (
      <SearchableSelect
        value={value}
        onValueChange={handle}
        disabled={disabled}
      >
        <SearchableSelectTrigger
          id={id}
          className="w-full"
          aria-invalid={invalid}
        >
          <SearchableSelectValue placeholder={placeholder} />
        </SearchableSelectTrigger>
        <SearchableSelectContent>
          {allowEmpty && (
            <SearchableSelectItem value={EMPTY}>
              <span className="text-muted-foreground">(Kosong)</span>
            </SearchableSelectItem>
          )}
          {options.map((o) => (
            <SearchableSelectItem key={o.value} value={o.value}>
              {o.label}
            </SearchableSelectItem>
          ))}
        </SearchableSelectContent>
      </SearchableSelect>
    );
  }
  return (
    <Select
      value={value || undefined}
      onValueChange={handle}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && (
          <SelectItem value={EMPTY}>
            <span className="text-muted-foreground">(Kosong)</span>
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
