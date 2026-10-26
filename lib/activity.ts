import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestContext } from "@/lib/request-context";
import type { ActivityAction } from "@/lib/activity-meta";

export type ActivityEvent = {
  action: ActivityAction;
  /** pelaku; tanpa ini dicari lewat `email` (login gagal, lupa password) */
  actorId?: string | null;
  email?: string;
  entity?: string;
  recordId?: string | null;
  /** nama data yang mudah dibaca */
  label?: string | null;
  /** company terkait; default company pelaku */
  tenantId?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Catat event aplikasi (login, export, download, …) ke Activity History.
 * Perubahan data sudah dicatat trigger DB; bila request yang sama juga mengubah
 * data, event ini menjadi ringkasan aksinya (digabung lewat request_id).
 *
 * Ditulis setelah response terkirim (user tidak menunggu) dan tidak pernah
 * menggagalkan aksi utama.
 */
export async function logActivity(ev: ActivityEvent) {
  const ctx = await requestContext();
  after(async () => {
    try {
      const admin = createAdminClient();
      const profiles = admin.from("profiles").select("id, name, username, role, tenant_id");
      const email = ev.email?.trim().toLowerCase();
      const { data: actor } = ev.actorId
        ? await profiles.eq("id", ev.actorId).maybeSingle()
        : email
          ? await profiles.eq("email", email).limit(1).maybeSingle()
          : { data: null };
      // undefined = kolom dibiarkan (tidak menimpa hasil trigger saat digabung)
      const row = {
        request_id: ctx.requestId,
        actor_id: actor?.id ?? ev.actorId ?? null,
        actor_name: actor?.name,
        actor_username: actor?.username,
        actor_role: actor?.role,
        tenant_id: ev.tenantId !== undefined ? ev.tenantId : (actor?.tenant_id ?? undefined),
        action: ev.action,
        entity: ev.entity,
        record_id: ev.recordId,
        label: ev.label,
        depth: 0,
        ip: ctx.ip || null,
        user_agent: ctx.userAgent || null,
        meta: ev.meta ?? {},
      };
      const { error } = await admin.from("activity_log").upsert(row, { onConflict: "request_id,actor_id" });
      if (error) console.error(`[activity] ${ev.action}: ${error.message}`);
    } catch (e) {
      console.error(`[activity] ${ev.action}:`, e);
    }
  });
}
