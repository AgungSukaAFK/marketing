import { loadEntity } from "@/lib/data";
import { PipelineBoard } from "./pipeline-board";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("pipeline");
  return <PipelineBoard rows={rows} lookups={lookups} me={me} />;
}
