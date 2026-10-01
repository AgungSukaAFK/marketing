import { EntityPage } from "@/components/entity/entity-page";
import { loadEntity } from "@/lib/data";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("customers");
  return <EntityPage entity="customers" rows={rows} lookups={lookups} me={me} />;
}
