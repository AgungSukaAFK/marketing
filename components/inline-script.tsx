"use client";

/**
 * Script inline yang dijalankan browser saat parsing HTML (sebelum paint).
 * Di klien dirender sebagai text/plain supaya React tidak memperingatkan
 * <script> saat navigasi klien; suppressHydrationWarning menutup selisih type.
 * Lihat node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
