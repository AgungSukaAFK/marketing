import { EntityPage } from "@/components/entity/entity-page";
import { loadEntity } from "@/lib/data";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("admin_daily");
  return <EntityPage entity="admin_daily" rows={rows} lookups={lookups} me={me} />;
}
