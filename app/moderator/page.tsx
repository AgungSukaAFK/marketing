import { requireModerator } from "@/lib/auth";
import { ModeratorView, type ModUser, type Tenant } from "./moderator-view";

export default async function ModeratorPage() {
  const { supabase, user } = await requireModerator();
  // RLS: moderator boleh membaca semua profil & tenant
  const [users, tenants] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, name, email, role, active, tenant_id, last_seen_at, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, name, code, created_at").order("name"),
  ]);
  return <ModeratorView users={(users.data ?? []) as ModUser[]} tenants={(tenants.data ?? []) as Tenant[]} meId={user.id} />;
}
