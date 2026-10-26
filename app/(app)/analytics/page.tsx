import { requireMenu } from "@/lib/auth";
import { loadAnalytics } from "@/lib/insights/analytics";
import { AnalyticsView } from "./analytics-view";

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const { p, o, from, to, sales } = await searchParams;
  const ctx = await requireMenu("analytics");
  const data = await loadAnalytics(ctx, { p, o, from, to, sales });
  return <AnalyticsView data={data} />;
}
