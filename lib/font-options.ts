// Opsi font & ukuran font yang bisa dipilih (lihat FontSwitcher & App
// Customizer). Dipisah dari theme-provider.tsx (client module) supaya bisa
// dipakai juga di server component (layout.tsx) untuk script anti-flash.

import {
  ACCENT_STORAGE_KEY,
  FOLLOW_COMPANY,
  accentThemes,
  type AccentTheme,
} from "@/lib/accent-options";

// `preview` = font-family untuk contoh teks di menu. Penerapan ke seluruh
// app lewat html[data-font=<name>] di globals.css (variable dari lib/fonts.ts).
export const fontFamilies = [
  { name: "geist", label: "Geist (Default)", preview: "var(--font-geist-sans)" },
  { name: "inter", label: "Inter", preview: "var(--font-inter)" },
  { name: "jakarta", label: "Plus Jakarta Sans", preview: "var(--font-jakarta)" },
  { name: "poppins", label: "Poppins", preview: "var(--font-poppins)" },
  { name: "nunito", label: "Nunito", preview: "var(--font-nunito)" },
  { name: "roboto", label: "Roboto", preview: "var(--font-roboto)" },
  { name: "atkinson", label: "Atkinson Hyperlegible", preview: "var(--font-atkinson)" },
  { name: "system", label: "Font Sistem", preview: "system-ui, sans-serif" },
] as const;

// Ukuran dipasang sebagai font-size <html>, jadi semua ukuran berbasis rem
// (Tailwind) ikut membesar/mengecil.
export const fontSizes = [
  { name: "sm", label: "Kecil", scale: "87.5%" },
  { name: "md", label: "Menengah", scale: "100%" },
  { name: "lg", label: "Besar", scale: "112.5%" },
  { name: "xl", label: "Sangat Besar", scale: "125%" },
] as const;

export type FontFamily = (typeof fontFamilies)[number]["name"];
export type FontSize = (typeof fontSizes)[number]["name"];

export const DEFAULT_FONT_FAMILY: FontFamily = "geist";
export const DEFAULT_FONT_SIZE: FontSize = "md";
export const FONT_FAMILY_STORAGE_KEY = "font-family";
export const FONT_SIZE_STORAGE_KEY = "font-size";

export const isFontFamily = (v: unknown): v is FontFamily =>
  typeof v === "string" && fontFamilies.some((f) => f.name === v);

/** Nilai font dari DB → nama font valid (data lama tersimpan "Inter" dll). */
export function normalizeFont(v: string | null | undefined): FontFamily {
  const s = (v ?? "").toLowerCase();
  return isFontFamily(s) ? s : DEFAULT_FONT_FAMILY;
}

const ACCENT_NAMES = JSON.stringify(accentThemes.map((t) => t.name));
const FONT_NAMES = JSON.stringify(fontFamilies.map((f) => f.name));
const SIZE_NAMES = JSON.stringify(fontSizes.map((s) => s.name));

// Dijalankan inline di <head> sebelum hydrate, supaya tidak ada kedipan
// aksen/font/ukuran default saat halaman pertama dimuat. Hanya pilihan user;
// default perusahaan dipasang oleh companyThemeScript di layout app.
export const fontInitScript = `(function(){try{var d=document.documentElement;var a=localStorage.getItem(${JSON.stringify(
  ACCENT_STORAGE_KEY,
)});var f=localStorage.getItem(${JSON.stringify(FONT_FAMILY_STORAGE_KEY)});var s=localStorage.getItem(${JSON.stringify(
  FONT_SIZE_STORAGE_KEY,
)});if(a&&a!=="zinc"&&${ACCENT_NAMES}.indexOf(a)>-1)d.classList.add("theme-"+a);if(f&&f!=="geist"&&${FONT_NAMES}.indexOf(f)>-1)d.dataset.font=f;if(s&&s!=="md"&&${SIZE_NAMES}.indexOf(s)>-1)d.dataset.fontSize=s;}catch(e){}})();`;

/**
 * Pasang aksen & font default perusahaan sebelum paint, hanya kalau user
 * belum memilih sendiri (atau memilih "Default Perusahaan"). Nilai sudah
 * dinormalisasi di server (normalizeAccent/normalizeFont).
 */
export function companyThemeScript(accent: AccentTheme, font: FontFamily) {
  return `(function(){try{var d=document.documentElement;var F=${JSON.stringify(FOLLOW_COMPANY)};var a=localStorage.getItem(${JSON.stringify(
    ACCENT_STORAGE_KEY,
  )});if(!a||a===F){${ACCENT_NAMES}.forEach(function(n){d.classList.remove("theme-"+n)});${
    accent === "zinc" ? "" : `d.classList.add(${JSON.stringify(`theme-${accent}`)});`
  }}var f=localStorage.getItem(${JSON.stringify(FONT_FAMILY_STORAGE_KEY)});if(!f||f===F){${
    font === DEFAULT_FONT_FAMILY ? "delete d.dataset.font;" : `d.dataset.font=${JSON.stringify(font)};`
  }}}catch(e){}})();`;
}
