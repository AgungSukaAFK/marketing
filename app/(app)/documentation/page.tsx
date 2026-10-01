import { EntityPage } from "@/components/entity/entity-page";
import { loadEntity } from "@/lib/data";

/** Upload/download via Supabase Storage (signed URL) — tombol download otomatis di kolom Aksi. */
export default async function Page() {
  const { rows, lookups, me } = await loadEntity("documentation");
  return <EntityPage entity="documentation" rows={rows} lookups={lookups} me={me} />;
}
