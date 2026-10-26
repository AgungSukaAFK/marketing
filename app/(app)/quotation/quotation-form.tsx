"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, ChevronDown, Copy, ListChecks, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveQuotation } from "@/app/actions/quotation";
import { StatusCounts } from "@/components/entity/status-badge";
import { AffixInput } from "@/components/form/affix-input";
import { AsyncCombobox, COMBO_LIMIT, type ComboOption } from "@/components/form/async-combobox";
import { DatePicker } from "@/components/form/date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OPTIONS } from "@/lib/constants";
import {
  ENTITIES,
  MAX_QUOTATION_ITEMS,
  quotationFormSchema,
  quotationTotals,
  statusCounts,
  type CustomerLite,
  type QuotationItem,
} from "@/lib/entities";
import { fmtPercent, fmtRupiah, pct, toNumber } from "@/lib/format";
import { STATUS_DOT } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ItemValues = { part: string; qty: string; harga: string; margin_p: string; status: string };
type Values = {
  customer_id: string;
  quot_no: string;
  kode_accurate: string;
  tgl_quot: string;
  tgl_exp: string;
  remarks: string;
  items: ItemValues[];
};

type CustomerInfo = Pick<CustomerLite, "id" | "customer_code" | "pt" | "pic" | "wa" | "site">;

export type QuotationInitial = {
  id: string;
  customer_id: string;
  customer: CustomerInfo | null;
  quot_no: string;
  kode_accurate: string | null;
  tgl_quot: string | null;
  tgl_exp: string | null;
  remarks: string | null;
  items: QuotationItem[];
};

const def = ENTITIES.quotation;
const today = () => new Date().toISOString().slice(0, 10);
const newQuotNo = () => {
  const f = def.fields.find((x) => x.name === "quot_no");
  return typeof f?.initial === "function" ? String(f.initial({ id: "", username: "", name: "", role: null })) : "";
};
const newItem = (): ItemValues => ({ part: "", qty: "1", harga: "", margin_p: "15", status: "Draft" });

function initialValues(q: QuotationInitial | null): Values {
  if (!q)
    return {
      customer_id: "",
      quot_no: newQuotNo(),
      kode_accurate: "",
      tgl_quot: today(),
      tgl_exp: "",
      remarks: "",
      items: [newItem()],
    };
  return {
    customer_id: q.customer_id,
    quot_no: q.quot_no,
    kode_accurate: q.kode_accurate ?? "",
    tgl_quot: q.tgl_quot ?? "",
    tgl_exp: q.tgl_exp ?? "",
    remarks: q.remarks ?? "",
    items: q.items.length
      ? q.items.map((i) => ({
          part: i.part,
          qty: String(toNumber(i.qty)),
          harga: String(toNumber(i.harga)),
          margin_p: String(toNumber(i.margin_p)),
          status: i.status,
        }))
      : [newItem()],
  };
}

/** Escape wildcard LIKE + buang karakter yang bermakna di filter PostgREST. */
const likeTerm = (q: string) => q.replace(/[^\p{L}\p{N}\s.\-/&]/gu, " ").replace(/\s+/g, " ").trim();
const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

const customerOption = (c: CustomerInfo): ComboOption & { customer: CustomerInfo } => ({
  value: c.id,
  label: `${c.customer_code} - ${c.pt}`,
  description: [c.pic, c.site].filter(Boolean).join(" · ") || undefined,
  customer: c,
});

// Kolom tabel barang di layar lebar (container ≥ 56rem); di bawah itu tiap barang jadi kartu.
const ITEM_GRID =
  "@4xl:grid-cols-[1.5rem_minmax(10rem,1fr)_5rem_9rem_5.5rem_8.5rem_8.5rem_4.5rem] @4xl:items-start @4xl:gap-2";

export function QuotationForm({ initial }: { initial: QuotationInitial | null }) {
  const router = useRouter();
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerInfo | null>(initial?.customer ?? null);
  const [dupQuotNo, setDupQuotNo] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const form = useForm<Values>({
    // validasi client memakai skema Zod yang sama dengan server action
    resolver: zodResolver(quotationFormSchema as never),
    defaultValues: initialValues(initial),
  });
  const { fields, append, remove, insert } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const tglQuot = useWatch({ control: form.control, name: "tgl_quot" });
  const tglExp = useWatch({ control: form.control, name: "tgl_exp" });
  const errors = form.formState.errors;
  const isDirty = form.formState.isDirty;

  const totals = quotationTotals(items);
  const counts = statusCounts(items);
  const expired = !!tglExp && tglExp < today() && items.some((i) => i.status === "Draft" || i.status === "Negosiasi");

  // Peringatan saat menutup/refresh tab dengan perubahan belum tersimpan
  useEffect(() => {
    if (!isDirty || pending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, pending]);

  const searchCustomers = async (q: string) => {
    let query = supabase
      .from("customers")
      .select("id, customer_code, pt, pic, wa, site")
      .order("customer_code")
      .limit(COMBO_LIMIT);
    const term = likeTerm(q);
    if (term) query = query.or(["customer_code", "pt", "pic"].map((c) => `${c}.ilike."*${term}*"`).join(","));
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((c) => customerOption(c as CustomerInfo));
  };

  const searchParts = async (q: string) => {
    const { data, error } = await supabase.rpc("search_quotation_parts", {
      p_q: escapeLike(q.trim()),
      p_limit: COMBO_LIMIT,
    });
    if (error) throw error;
    return ((data ?? []) as { part: string; source: string; deskripsi: string | null }[]).map((p) => {
      const source = p.source === "Forecast" ? "Part No di Sales Forecast" : "Pernah dipakai di quotation";
      return { value: p.part, label: p.part, description: p.deskripsi ? `${p.deskripsi} · ${source}` : source };
    });
  };

  /** Quot No sama tidak diblokir (bisa revisi), hanya diingatkan. */
  const checkQuotNo = async (v: string) => {
    const no = v.trim();
    if (!no) return setDupQuotNo(false);
    let query = supabase.from("quotation").select("id", { count: "exact", head: true }).eq("quot_no", no);
    if (initial) query = query.neq("id", initial.id);
    const { count } = await query;
    setDupQuotNo(!!count);
  };

  const addItem = (at?: number) => {
    if (fields.length >= MAX_QUOTATION_ITEMS) return toast.error(`Maksimal ${MAX_QUOTATION_ITEMS} barang`);
    const index = at ?? fields.length;
    if (at === undefined) append(newItem(), { shouldFocus: false });
    else insert(at, { ...form.getValues(`items.${at - 1}`) }, { shouldFocus: false });
    // fokus ke Part barang baru; mengetik langsung membuka pencarian
    requestAnimationFrame(() => document.getElementById(`item-${index}-part`)?.focus());
  };

  const setAllStatus = (status: string) => {
    fields.forEach((_, i) => form.setValue(`items.${i}.status`, status, { shouldDirty: true }));
    toast.success(`Status semua barang: ${status}`);
  };

  /** "back" → kembali ke daftar; "again" → form kosong untuk quotation berikutnya */
  const save = (mode: "back" | "again") =>
    void form.handleSubmit(
      () =>
        startTransition(async () => {
          const res = await saveQuotation(initial?.id ?? null, form.getValues());
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? "Disimpan");
          if (mode === "again") {
            form.reset(initialValues(null));
            setCustomer(null);
            setDupQuotNo(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          form.reset(form.getValues()); // bersihkan status "dirty" sebelum pindah halaman
          router.push(def.href);
        }),
      (errs) => {
        const n = Object.keys(errs).length + (Array.isArray(errs.items) ? errs.items.filter(Boolean).length - 1 : 0);
        toast.error(`Periksa kembali isian (${Math.max(n, 1)} field belum valid)`);
      },
    )();

  // Ctrl/Cmd + S untuk simpan
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current("back");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const leave = () => (isDirty ? setConfirmLeave(true) : router.push(def.href));

  const itemsError =
    (errors.items as { message?: string; root?: { message?: string } } | undefined)?.root?.message ??
    (errors.items as { message?: string } | undefined)?.message;

  return (
    <>
      <div className="col-span-12 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={leave} aria-label="Kembali" title="Kembali ke daftar">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight font-semibold">{isEdit ? "Edit Quotation" : "Tambah Quotation"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? (
              <>
                <span className="font-mono">{initial.quot_no}</span> — perubahan barang & status disimpan sekaligus.
              </>
            ) : (
              "Isi informasi quotation lalu tambahkan barang yang ditawarkan."
            )}
          </p>
        </div>
      </div>

      <form
        id="quotation-form"
        onSubmit={(e) => {
          e.preventDefault();
          save("back");
        }}
        noValidate
        className="col-span-12 grid grid-cols-12 items-start gap-4 md:gap-6"
      >
        {/* ------------------------------------------------------------- Header */}
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader>
            <CardTitle>Informasi Quotation</CardTitle>
            <CardDescription>
              Field bertanda <span className="text-destructive">*</span> wajib diisi.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.customer_id} className="sm:col-span-2">
              <FieldLabel htmlFor="q_customer">
                Customer<span className="text-destructive">*</span>
              </FieldLabel>
              <AsyncCombobox
                id="q_customer"
                selected={customer ? customerOption(customer) : null}
                onSelect={(o) => {
                  const c = (o as ReturnType<typeof customerOption> | null)?.customer ?? null;
                  setCustomer(c);
                  form.setValue("customer_id", c?.id ?? "", { shouldValidate: true, shouldDirty: true });
                }}
                load={searchCustomers}
                placeholder="Cari kode customer, nama PT, atau PIC…"
                searchPlaceholder="Ketik kode / PT / PIC…"
                emptyText="Customer tidak ditemukan."
                invalid={!!errors.customer_id}
              />
              {errors.customer_id && <FieldError>{errors.customer_id.message}</FieldError>}
              {customer && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border bg-muted/50 px-2.5 py-2 text-xs sm:grid-cols-4 dark:bg-muted/10">
                  {(
                    [
                      ["PT", customer.pt],
                      ["PIC", customer.pic],
                      ["WA", customer.wa],
                      ["Site", customer.site],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="truncate" title={v ?? undefined}>
                      <span className="text-muted-foreground">{k}: </span>
                      <span className="font-medium">{v || "-"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Field>

            <Field data-invalid={!!errors.quot_no}>
              <FieldLabel htmlFor="q_quot_no">
                Quot No<span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="q_quot_no"
                className="font-mono"
                aria-invalid={!!errors.quot_no}
                {...form.register("quot_no", { onBlur: (e) => void checkQuotNo(e.target.value) })}
              />
              {errors.quot_no ? (
                <FieldError>{errors.quot_no.message}</FieldError>
              ) : (
                dupQuotNo && (
                  <FieldDescription className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" /> Quot No ini sudah dipakai quotation lain.
                  </FieldDescription>
                )
              )}
            </Field>

            <Field data-invalid={!!errors.kode_accurate}>
              <FieldLabel htmlFor="q_kode_accurate">Kode Accurate</FieldLabel>
              <Input
                id="q_kode_accurate"
                className="font-mono"
                placeholder="mis. SQ.2026.10.00012"
                aria-invalid={!!errors.kode_accurate}
                {...form.register("kode_accurate")}
              />
              {errors.kode_accurate && <FieldError>{errors.kode_accurate.message}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.tgl_quot}>
              <FieldLabel htmlFor="q_tgl_quot">Tgl Quot</FieldLabel>
              <DatePicker
                id="q_tgl_quot"
                value={tglQuot ?? ""}
                onChange={(v) => form.setValue("tgl_quot", v, { shouldValidate: true, shouldDirty: true })}
                invalid={!!errors.tgl_quot}
              />
              {errors.tgl_quot && <FieldError>{errors.tgl_quot.message}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.tgl_exp}>
              <FieldLabel htmlFor="q_tgl_exp">Tgl Exp</FieldLabel>
              <DatePicker
                id="q_tgl_exp"
                value={tglExp ?? ""}
                onChange={(v) => form.setValue("tgl_exp", v, { shouldValidate: true, shouldDirty: true })}
                invalid={!!errors.tgl_exp}
              />
              {errors.tgl_exp ? (
                <FieldError>{errors.tgl_exp.message}</FieldError>
              ) : (
                expired && (
                  <FieldDescription className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" /> Sudah lewat masa berlaku, masih ada barang belum closing.
                  </FieldDescription>
                )
              )}
            </Field>

            <Field data-invalid={!!errors.remarks} className="sm:col-span-2">
              <FieldLabel htmlFor="q_remarks">Remarks</FieldLabel>
              <Textarea
                id="q_remarks"
                rows={2}
                placeholder="Catatan negosiasi, syarat pembayaran, dll."
                aria-invalid={!!errors.remarks}
                {...form.register("remarks")}
              />
              {errors.remarks && <FieldError>{errors.remarks.message}</FieldError>}
            </Field>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------ Ringkasan */}
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>Ringkasan</CardTitle>
            <CardDescription>Dihitung otomatis dari daftar barang.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Total Nilai</div>
              <div className="text-2xl font-semibold tabular-nums">{fmtRupiah(totals.total)}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {items.length} barang · Margin {fmtRupiah(totals.margin)} ({fmtPercent(pct(totals.margin, totals.total))})
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-3 text-sm dark:bg-muted/10">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Nilai Win</dt>
                <dd className="font-semibold tabular-nums">{fmtRupiah(totals.win)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Loss (otomatis)</dt>
                <dd className={cn("font-semibold tabular-nums", totals.loss > 0 && "text-destructive")}>
                  {fmtRupiah(totals.loss)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">Status barang</div>
              <StatusCounts counts={counts} />
            </div>
          </CardContent>
        </Card>

        {/* --------------------------------------------------------------- Barang */}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Daftar Barang
              <Badge variant="secondary" className="tabular-nums">
                {fields.length}
              </Badge>
            </CardTitle>
            <CardDescription>Status negosiasi diisi per barang. Loss dihitung dari barang berstatus Loss.</CardDescription>
            <CardAction className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <ListChecks /> <span className="hidden sm:inline">Ubah semua status</span>
                    <ChevronDown className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Set status semua barang</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {OPTIONS.quotationStatus.map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => setAllStatus(s)}>
                      <StatusDot status={s} /> {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          </CardHeader>
          <CardContent className="@container">
            <div
              className={cn(
                "hidden border-b pb-2 text-xs font-medium text-muted-foreground @4xl:grid",
                ITEM_GRID,
              )}
              aria-hidden
            >
              <span className="text-center">#</span>
              <span>Part / Barang<span className="text-destructive">*</span></span>
              <span className="text-right">Qty</span>
              <span className="text-right">Harga Satuan</span>
              <span className="text-right">Margin</span>
              <span>Status</span>
              <span className="text-right">Total</span>
              <span className="sr-only">Aksi</span>
            </div>

            <ol className="flex flex-col gap-3 @4xl:gap-0">
              {fields.map((field, i) => {
                const it = items[i] ?? field;
                const e = errors.items?.[i];
                const lineTotal = toNumber(it.harga) * toNumber(it.qty);
                const lineMargin = Math.round((lineTotal * toNumber(it.margin_p)) / 100);
                return (
                  <li
                    key={field.id}
                    className={cn(
                      "grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4",
                      "@4xl:rounded-none @4xl:border-0 @4xl:border-b @4xl:px-0 @4xl:py-2.5",
                      ITEM_GRID,
                    )}
                  >
                    <span className="flex h-9 items-center text-sm font-medium text-muted-foreground @4xl:justify-center @4xl:tabular-nums">
                      <span className="@4xl:hidden">Barang #</span>
                      {i + 1}
                    </span>

                    <div className="col-span-full flex flex-col gap-1.5 @4xl:col-span-1">
                      <label htmlFor={`item-${i}-part`} className="text-xs font-medium text-muted-foreground @4xl:sr-only">
                        Part / Barang<span className="text-destructive">*</span>
                      </label>
                      <AsyncCombobox
                        id={`item-${i}-part`}
                        selected={it.part ? { value: it.part, label: it.part } : null}
                        onSelect={(o) =>
                          form.setValue(`items.${i}.part`, o?.value ?? "", { shouldValidate: true, shouldDirty: true })
                        }
                        load={searchParts}
                        creatable
                        placeholder="Cari / ketik nama part…"
                        searchPlaceholder="Ketik nama part…"
                        emptyText="Ketik untuk menambah part baru."
                        invalid={!!e?.part}
                      />
                      {e?.part && <FieldError>{e.part.message}</FieldError>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`item-${i}-qty`} className="text-xs font-medium text-muted-foreground @4xl:sr-only">
                        Qty
                      </label>
                      <Input
                        id={`item-${i}-qty`}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        aria-invalid={!!e?.qty}
                        {...form.register(`items.${i}.qty`)}
                      />
                      {e?.qty && <FieldError>{e.qty.message}</FieldError>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`item-${i}-harga`} className="text-xs font-medium text-muted-foreground @4xl:sr-only">
                        Harga Satuan
                      </label>
                      <CurrencyInput
                        id={`item-${i}-harga`}
                        value={toNumber(it.harga)}
                        onValueChange={(n) =>
                          form.setValue(`items.${i}.harga`, n ? String(n) : "", { shouldValidate: true, shouldDirty: true })
                        }
                        aria-invalid={!!e?.harga}
                      />
                      {e?.harga && <FieldError>{e.harga.message}</FieldError>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`item-${i}-margin`} className="text-xs font-medium text-muted-foreground @4xl:sr-only">
                        Margin
                      </label>
                      <AffixInput
                        id={`item-${i}-margin`}
                        type="number"
                        step="any"
                        inputMode="decimal"
                        suffix="%"
                        className="pr-8"
                        aria-invalid={!!e?.margin_p}
                        {...form.register(`items.${i}.margin_p`)}
                      />
                      {e?.margin_p && <FieldError>{e.margin_p.message}</FieldError>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`item-${i}-status`} className="text-xs font-medium text-muted-foreground @4xl:sr-only">
                        Status
                      </label>
                      <Select
                        value={it.status}
                        onValueChange={(v) =>
                          form.setValue(`items.${i}.status`, v, { shouldValidate: true, shouldDirty: true })
                        }
                      >
                        <SelectTrigger id={`item-${i}-status`} className="w-full" aria-invalid={!!e?.status}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPTIONS.quotationStatus.map((s) => (
                            <SelectItem key={s} value={s}>
                              <StatusDot status={s} /> {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {e?.status && <FieldError>{e.status.message}</FieldError>}
                    </div>

                    <div className="col-span-full flex items-baseline justify-between gap-2 border-t pt-2 sm:col-span-3 sm:border-0 sm:pt-0 @4xl:col-span-1 @4xl:flex-col @4xl:items-end @4xl:justify-center @4xl:gap-0 @4xl:pt-1">
                      <span className="text-xs text-muted-foreground @4xl:hidden">Total</span>
                      <span className="text-sm font-semibold tabular-nums">{fmtRupiah(lineTotal)}</span>
                      <span className="hidden text-[11px] text-muted-foreground tabular-nums @4xl:block">
                        Margin {fmtRupiah(lineMargin)}
                      </span>
                    </div>

                    <div className="col-start-2 row-start-1 flex items-start justify-end gap-1 sm:col-start-4 @4xl:col-auto @4xl:row-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => addItem(i + 1)}
                        aria-label={`Duplikat barang ${i + 1}`}
                        title="Duplikat"
                      >
                        <Copy />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(i)}
                        disabled={fields.length === 1}
                        aria-label={`Hapus barang ${i + 1}`}
                        title={fields.length === 1 ? "Minimal 1 barang" : "Hapus"}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>

            {itemsError && <FieldError className="mt-3">{itemsError}</FieldError>}

            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full border-dashed"
              onClick={() => addItem()}
              disabled={fields.length >= MAX_QUOTATION_ITEMS}
            >
              <Plus /> Tambah Barang
            </Button>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------- Bar aksi */}
        <div className="sticky bottom-0 z-10 col-span-12 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:mx-0 md:rounded-xl md:border md:shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <div className="text-xs text-muted-foreground">
                {items.length} barang{isDirty && <span className="ml-1.5 text-amber-700 dark:text-amber-300">· belum disimpan</span>}
              </div>
              <div className="font-semibold tabular-nums">{fmtRupiah(totals.total)}</div>
            </div>
            <Button type="button" variant="outline" onClick={leave} disabled={pending}>
              Batal
            </Button>
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => save("again")}
                disabled={pending}
                className="hidden sm:inline-flex"
              >
                Simpan & Tambah Lagi
              </Button>
            )}
            <Button type="submit" disabled={pending} title="Simpan (Ctrl+S)">
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buang perubahan?</AlertDialogTitle>
            <AlertDialogDescription>Isian yang belum disimpan akan hilang.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Lanjut mengisi</AlertDialogCancel>
            <AlertDialogAction asChild className={buttonVariants({ variant: "destructive" })}>
              <Link href={def.href}>Buang & keluar</Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />;
}
