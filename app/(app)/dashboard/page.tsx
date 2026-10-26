import { requireMenu } from "@/lib/auth";
import { loadDashboard } from "@/lib/insights/dashboard";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { p, o, from, to, sales } = await searchParams;
  // RLS otomatis membatasi Sales ke data miliknya (setara filterOwner prototipe)
  const ctx = await requireMenu("dashboard");
  const data = await loadDashboard(ctx, { p, o, from, to, sales });
  return <DashboardView data={data} />;
}
