export type Role = "moderator" | "master" | "admin" | "sales";
export type TenantRole = Exclude<Role, "moderator">;

export const ROLE_LABEL: Record<Role, string> = {
  moderator: "Moderator",
  master: "Master",
  admin: "Admin",
  sales: "Sales",
};

export const TENANT_ROLES: TenantRole[] = ["sales", "admin", "master"];

/** Menu bawaan. `id` sama dengan prototipe (dipakai di menu_config & access_control). */
export type BaseMenu = {
  id: string;
  label: string;
  icon: string;
  href: string;
  roles?: TenantRole[];
};

export const BASE_MENUS: BaseMenu[] = [
  { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/dashboard" },
  { id: "customer", label: "Customer DB", icon: "building-2", href: "/customers" },
  { id: "sales_daily", label: "Sales Daily Activity", icon: "clipboard-list", href: "/sales-daily" },
  { id: "admin_daily", label: "Admin Daily Activity", icon: "file-cog", href: "/admin-daily" },
  { id: "pipeline", label: "Pipeline Engine", icon: "kanban", href: "/pipeline" },
  { id: "forecast", label: "Sales Forecast", icon: "trending-up", href: "/forecast" },
  { id: "quotation", label: "Monitoring Quotation", icon: "file-text", href: "/quotation" },
  { id: "trend", label: "Forecast Trend Analysis", icon: "bar-chart-3", href: "/forecast-trend" },
  { id: "actual", label: "Sales Actual vs Forecast", icon: "scale", href: "/actual" },
  { id: "doc", label: "Documentation", icon: "folder-archive", href: "/documentation" },
  { id: "refreshment", label: "Refreshment & Assessment", icon: "graduation-cap", href: "/refreshment" },
  { id: "evaluation", label: "Evaluasi Bulanan Sales", icon: "star", href: "/evaluation" },
  { id: "analytics", label: "Analytics", icon: "pie-chart", href: "/analytics" },
  { id: "akun", label: "Akun", icon: "users", href: "/accounts", roles: ["master", "admin"] },
  { id: "settings", label: "App Customizer / Settings", icon: "settings", href: "/settings", roles: ["master", "admin"] },
];

export const MENU_ICONS = [
  "layout-dashboard", "building-2", "clipboard-list", "file-cog", "kanban", "trending-up",
  "file-text", "bar-chart-3", "scale", "folder-archive", "graduation-cap", "star", "pie-chart",
  "users", "settings", "shield", "briefcase", "database", "link", "globe", "zap", "book-open",
  "notebook", "file-check", "contact",
] as const;

/** [warna utama, warna terang (teks di dark), warna gelap (teks di light)] */
export const ACCENTS: Record<string, [string, string, string]> = {
  Emerald: ["#10b981", "#34d399", "#047857"],
  Cyan: ["#06b6d4", "#22d3ee", "#0e7490"],
  Indigo: ["#6366f1", "#818cf8", "#4338ca"],
  Amber: ["#f59e0b", "#fcd34d", "#b45309"],
  Rose: ["#f43f5e", "#fb7185", "#be123c"],
};

/** Nama font → CSS variable dari next/font (lihat app/layout.tsx) */
export const FONTS: Record<string, string> = {
  Inter: "var(--font-inter)",
  "JetBrains Mono": "var(--font-jetbrains)",
  "Space Grotesk": "var(--font-space-grotesk)",
  Manrope: "var(--font-manrope)",
  Outfit: "var(--font-outfit)",
};

export const DENSITIES = ["Nyaman", "Kompak"] as const;

export type HeaderCfg = {
  showClock: boolean;
  showBadge: boolean;
  showTheme: boolean;
  showOnline: boolean;
};

export const HEADER_CFG_LABELS: Record<keyof HeaderCfg, string> = {
  showClock: "Jam WIB",
  showBadge: "Badge Live",
  showTheme: "Theme Switcher",
  showOnline: "Widget Akun Online",
};

export const PIPELINE_STAGES = [
  "Market Map", "Lead", "Qualified", "Proposal", "Negotiation", "PO", "Delivery", "Handover",
] as const;

export const OPTIONS = {
  salesDailyType: ["Visit", "Call", "Meeting", "Survey", "Delivery"],
  salesDailyStatus: ["Completed", "Pending", "In Progress"],
  adminDailyType: ["PO Input", "Buat Quotation", "Input Quotation Accurate", "Kontrak", "Buat Data", "Lainnya"],
  adminDailyStatus: ["Draft", "Pending", "Proses", "Selesai", "Ditolak", "Postponed"],
  forecastStatus: ["On Track", "Achieved", "Delayed", "At Risk"],
  poStatus: ["Pending", "Win", "Loss", "Cancel"],
  refreshmentJenis: ["Weekly Brainstorming", "Monthly Test"],
  refreshmentStatus: ["Terjadwal", "Selesai", "Dibatalkan"],
  evaluationStatus: ["Open", "In Progress", "Closed"],
} as const;

export const STORAGE_BUCKET = "files";
