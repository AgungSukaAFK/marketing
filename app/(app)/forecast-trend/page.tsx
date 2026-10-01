import { EntityPage } from "@/components/entity/entity-page";
import { loadEntity } from "@/lib/data";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("forecast_trend");
  return <EntityPage entity="forecast_trend" rows={rows} lookups={lookups} me={me} />;
}
