"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocalStorage, writeLocalStorage } from "@/lib/use-local-storage";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  FOLLOW_COMPANY,
  accentThemes,
  isAccentTheme,
  type AccentTheme,
} from "@/lib/accent-options";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  fontSizes,
  isFontFamily,
  type FontFamily,
  type FontSize,
} from "@/lib/font-options";

export { accentThemes, type AccentTheme };

/** Pilihan user: nilai tertentu, atau ikut default perusahaan. */
export type AccentChoice = AccentTheme | typeof FOLLOW_COMPANY;
export type FontChoice = FontFamily | typeof FOLLOW_COMPANY;

type CompanyDefaults = { accent: AccentTheme; font: FontFamily };

interface CustomThemeContextType {
  /** Aksen yang sedang dipakai (hasil pilihan user / default perusahaan). */
  accent: AccentTheme;
  accentChoice: AccentChoice;
  setAccent: (accent: AccentChoice) => void;
  fontFamily: FontFamily;
  fontChoice: FontChoice;
  setFontFamily: (font: FontChoice) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  /** Default dari App Customizer; null di luar halaman perusahaan. */
  company: CompanyDefaults | null;
  setCompany: (company: CompanyDefaults | null) => void;
}

const CustomThemeContext = createContext<CustomThemeContextType | undefined>(undefined);

export function CustomThemeProvider({ children, ...props }: ThemeProviderProps) {
  // null = belum dibaca dari localStorage (server & render hydrate), supaya
  // nilai yang sudah dipasang script anti-flash tidak tertimpa default dulu.
  const storedAccent = useLocalStorage(ACCENT_STORAGE_KEY);
  const storedFont = useLocalStorage(FONT_FAMILY_STORAGE_KEY);
  const storedSize = useLocalStorage(FONT_SIZE_STORAGE_KEY);
  const [company, setCompany] = useState<CompanyDefaults | null>(null);

  const accentChoice: AccentChoice | null =
    storedAccent === undefined ? null : isAccentTheme(storedAccent) ? storedAccent : FOLLOW_COMPANY;
  const fontChoice: FontChoice | null =
    storedFont === undefined ? null : isFontFamily(storedFont) ? storedFont : FOLLOW_COMPANY;
  const fontSize: FontSize | null =
    storedSize === undefined ? null : (fontSizes.find((x) => x.name === storedSize)?.name ?? DEFAULT_FONT_SIZE);

  const accent: AccentTheme =
    accentChoice && accentChoice !== FOLLOW_COMPANY ? accentChoice : (company?.accent ?? DEFAULT_ACCENT);
  const fontFamily: FontFamily =
    fontChoice && fontChoice !== FOLLOW_COMPANY ? fontChoice : (company?.font ?? DEFAULT_FONT_FAMILY);

  // Terapkan aksen ke <html> sebagai class theme-<name> (kecuali zinc default)
  useEffect(() => {
    if (!accentChoice) return;
    const root = document.documentElement;
    accentThemes.forEach((t) => root.classList.remove(`theme-${t.name}`));
    if (accent !== DEFAULT_ACCENT) root.classList.add(`theme-${accent}`);
  }, [accent, accentChoice]);

  // Terapkan font & ukuran ke <html> (dipetakan di globals.css)
  useEffect(() => {
    if (!fontChoice) return;
    const root = document.documentElement;
    if (fontFamily === DEFAULT_FONT_FAMILY) delete root.dataset.font;
    else root.dataset.font = fontFamily;
  }, [fontFamily, fontChoice]);

  useEffect(() => {
    if (!fontSize) return;
    const root = document.documentElement;
    if (fontSize === DEFAULT_FONT_SIZE) delete root.dataset.fontSize;
    else root.dataset.fontSize = fontSize;
  }, [fontSize]);

  const setAccent = useCallback((v: AccentChoice) => writeLocalStorage(ACCENT_STORAGE_KEY, v), []);
  const setFontFamily = useCallback((v: FontChoice) => writeLocalStorage(FONT_FAMILY_STORAGE_KEY, v), []);
  const setFontSize = useCallback((v: FontSize) => writeLocalStorage(FONT_SIZE_STORAGE_KEY, v), []);

  return (
    <CustomThemeContext.Provider
      value={{
        accent,
        accentChoice: accentChoice ?? FOLLOW_COMPANY,
        setAccent,
        fontFamily,
        fontChoice: fontChoice ?? FOLLOW_COMPANY,
        setFontFamily,
        fontSize: fontSize ?? DEFAULT_FONT_SIZE,
        setFontSize,
        company,
        setCompany,
      }}
    >
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </CustomThemeContext.Provider>
  );
}

/** Hook kustom untuk membaca & mengubah aksen, font, dan ukuran font. */
export const useCustomTheme = () => {
  const context = useContext(CustomThemeContext);
  if (context === undefined) {
    throw new Error("useCustomTheme must be used within a CustomThemeProvider");
  }
  return context;
};

/**
 * Daftarkan default aksen & font perusahaan (App Customizer) selama halaman
 * perusahaan terbuka. Dilepas lagi saat keluar (login, moderator, dll).
 */
export function CompanyTheme({ accent, font }: CompanyDefaults) {
  const { setCompany } = useCustomTheme();
  useEffect(() => {
    setCompany({ accent, font });
  }, [accent, font, setCompany]);
  useEffect(() => () => setCompany(null), [setCompany]);
  return null;
}
