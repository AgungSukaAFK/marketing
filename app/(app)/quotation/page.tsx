import { loadEntity } from "@/lib/data";
import { QuotationView } from "./quotation-view";

export default async function Page() {
  // daftar customer lengkap tidak perlu: form create/edit memakai pencarian (maks. 20)
  const { rows, lookups, me } = await loadEntity("quotation", { customers: false });
  return <QuotationView rows={rows} lookups={lookups} me={me} />;
}
