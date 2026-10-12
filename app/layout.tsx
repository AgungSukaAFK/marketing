import type { Metadata } from "next";
import { CustomThemeProvider } from "@/lib/theme-provider";
import { fontVariables } from "@/lib/fonts";
import { fontInitScript } from "@/lib/font-options";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_TAGLINE, DEFAULT_APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${DEFAULT_APP_NAME} — ${APP_TAGLINE}`, template: `%s · ${DEFAULT_APP_NAME}` },
  description: "CRM sales & marketing untuk industri dan pertambangan",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    // iOS belum support SVG untuk apple-touch-icon, tetap pakai PNG
    apple: "/icons/icon-192.png",
  },
};

export const viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* aksen, font & ukuran tersimpan dipasang sebelum render (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
      </head>
      <body className="antialiased">
        <CustomThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "soft-light", "soft-dark"]}
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="bottom-right" />
        </CustomThemeProvider>
      </body>
    </html>
  );
}
