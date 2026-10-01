import type { TenantRole } from "@/lib/constants";
import type { CustomerLite, ForecastLite, ProfileLite } from "@/lib/entities";

export type Me = ProfileLite & { role: TenantRole; tenant_id: string };

export type EntityLookups = {
  profiles: ProfileLite[];
  customers: CustomerLite[];
  forecasts: ForecastLite[];
};

export const isManager = (me: Me) => me.role === "master" || me.role === "admin";

/** Cermin aturan RLS update/delete: pemilik atau Master/Admin */
export const canModify = (me: Me, row: { owner: string }) => isManager(me) || row.owner === me.id;
