import { ACCENTS, FONTS } from "@/lib/constants";

/** CSS override aksen & font per tenant (disisipkan sebagai <style> di layout app). */
export function tenantThemeCss(accent: string, font: string) {
  const [brand, brand2, strong] = ACCENTS[accent] ?? ACCENTS.Emerald;
  const fontVar = FONTS[font] ?? FONTS.Inter;
  return `:root{--brand:${brand};--brand-2:${brand2};--brand-strong:${strong};--font-sans:${fontVar};}`;
}
