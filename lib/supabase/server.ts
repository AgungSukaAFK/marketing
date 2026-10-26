import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { activityHeaders } from "@/lib/request-context";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // id request, IP & perangkat untuk Activity History (trigger activity_capture)
      global: { headers: await activityHeaders() },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Dipanggil dari Server Component: sesi di-refresh oleh proxy.ts
          }
        },
      },
    },
  );
}
