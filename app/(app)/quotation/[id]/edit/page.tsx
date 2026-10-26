import { notFound, redirect } from "next/navigation";
import { canModify } from "@/components/entity/types";
import { requireMenu } from "@/lib/auth";
import { ENTITIES, quotationItems, type Row } from "@/lib/entities";
import { QuotationForm, type QuotationInitial } from "../../quotation-form";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = ENTITIES.quotation;
  const { supabase, profile } = await requireMenu(def.menuId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // RLS: Sales hanya melihat quotation miliknya
  const { data } = await supabase
    .from(def.table)
    .select("id, owner, customer_id, quot_no, kode_accurate, tgl_quot, tgl_exp, remarks, customer:customers(id, customer_code, pt, pic, wa, site), items:quotation_items(id, position, part, harga, qty, margin_p, total, margin_rp, status)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const row = data as unknown as Row;
  if (!canModify(profile, row)) redirect(def.href);

  const initial: QuotationInitial = {
    id: row.id,
    customer_id: row.customer_id,
    customer: row.customer,
    quot_no: row.quot_no,
    kode_accurate: row.kode_accurate,
    tgl_quot: row.tgl_quot,
    tgl_exp: row.tgl_exp,
    remarks: row.remarks,
    items: quotationItems(row),
  };
  return <QuotationForm key={row.id} initial={initial} />;
}
