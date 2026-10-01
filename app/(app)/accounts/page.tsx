import { requireMenu } from "@/lib/auth";
import type { TenantRole } from "@/lib/constants";
import { AccountsView, type AccountRow, type LoginRow } from "./accounts-view";

export default async function AccountsPage() {
  const { supabase, profile } = await requireMenu("akun");
  const [users, history] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, name, email, role, active, last_seen_at, created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at"),
    supabase
      .from("login_history")
      .select("id, user_id, action, created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  return (
    <AccountsView
      users={(users.data ?? []) as AccountRow[]}
      history={(history.data ?? []) as LoginRow[]}
      me={{ id: profile.id, role: profile.role as TenantRole }}
    />
  );
}
