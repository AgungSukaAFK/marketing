import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot", "/auth"];

/** Refresh sesi Supabase di setiap request + redirect dasar (login/non-login). */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Tanpa env, createServerClient akan throw → 500 polos di semua halaman. Tampilkan pesan jelas.
  if (!url || !anonKey) {
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Konfigurasi belum lengkap</title>" +
        "<body style='font-family:system-ui;padding:2rem;background:#060913;color:#e2e8f0'>" +
        "<h1>Konfigurasi Supabase belum di-set</h1>" +
        "<p>Set <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dan " +
        "<code>SUPABASE_SERVICE_ROLE_KEY</code> di environment, lalu deploy ulang.</p></body>",
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Jangan sisipkan logika di antara createServerClient dan getClaims().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
