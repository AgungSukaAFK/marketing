import { EntityPage } from "@/components/entity/entity-page";
import { loadEntity } from "@/lib/data";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("sales_forecast");
  return <EntityPage entity="sales_forecast" rows={rows} lookups={lookups} me={me} />;
}
