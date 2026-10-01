import { EntityPage } from "@/components/entity/entity-page";
import { loadEntity } from "@/lib/data";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("refreshment");
  return <EntityPage entity="refreshment" rows={rows} lookups={lookups} me={me} />;
}
