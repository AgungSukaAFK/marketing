import "server-only";
import { requireMenu } from "@/lib/auth";
import { ENTITIES, type CustomerLite, type EntityKey, type ForecastLite, type ProfileLite, type Row } from "@/lib/entities";
import type { EntityLookups, Me } from "@/components/entity/types";

/** Data untuk halaman entitas: baris (RLS), lookup customer/forecast/profil, dan user aktif. */
export async function loadEntity(key: EntityKey) {
  const def = ENTITIES[key];
  const ctx = await requireMenu(def.menuId);
  const { supabase, profile } = ctx;

  const needCustomers = def.fields.some((f) => f.type === "customer");
  const needForecasts = def.fields.some((f) => f.type === "forecast");

  let query = supabase.from(def.table).select(def.select);
  query = def.orderBy
    ? query.order(def.orderBy.column, { ascending: def.orderBy.ascending })
    : query.order("created_at", { ascending: false });

  const [rows, profiles, customers, forecasts] = await Promise.all([
    query,
    supabase.from("profiles").select("id, username, name, role").order("name"),
    needCustomers
      ? supabase.from("customers").select("id, customer_code, pt, pic, wa, site, sales_id").order("customer_code")
      : Promise.resolve({ data: [] }),
    needForecasts
      ? supabase.from("sales_forecast").select("id, part_no, sales_id, customer:customers(pt)").order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  if (rows.error) throw new Error(rows.error.message);

  const me: Me = {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    role: profile.role,
    tenant_id: profile.tenant_id,
  };
  const lookups: EntityLookups = {
    profiles: (profiles.data ?? []) as ProfileLite[],
    customers: (customers.data ?? []) as CustomerLite[],
    forecasts: (forecasts.data ?? []) as unknown as ForecastLite[],
  };
  return { ctx, rows: (rows.data ?? []) as unknown as Row[], lookups, me };
}
