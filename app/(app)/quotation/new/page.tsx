import { requireMenu } from "@/lib/auth";
import { ENTITIES } from "@/lib/entities";
import { QuotationForm } from "../quotation-form";

export default async function NewQuotationPage() {
  await requireMenu(ENTITIES.quotation.menuId);
  return <QuotationForm initial={null} />;
}
