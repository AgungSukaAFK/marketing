export type Role = "moderator" | "master" | "admin" | "sales";
export type TenantRole = Exclude<Role, "moderator">;

export const ROLE_LABEL: Record<Role, string> = {
  moderator: "Moderator",
  master: "Master",
  admin: "Admin",
  sales: "Sales",
};

/** Nama aplikasi bawaan. Tiap perusahaan bisa menggantinya di App Customizer. */
export const DEFAULT_APP_NAME = "Lourdes Marketing";
export const APP_TAGLINE = "Industrial & Mining CRM";

export const TENANT_ROLES: TenantRole[] = ["sales", "admin", "master"];

/** Kelompok fitur di sidebar, dalam urutan tampil. Menu kustom masuk ke "custom". */
export const MENU_GROUPS = [
  { id: "overview", label: "Ringkasan" },
  { id: "activity", label: "Aktivitas Harian" },
  { id: "sales", label: "Penjualan" },
  { id: "forecast", label: "Forecast" },
  { id: "team", label: "Pengembangan Tim" },
  { id: "custom", label: "Halaman Kustom" },
  { id: "admin", label: "Administrasi" },
] as const;

export type MenuGroupId = (typeof MENU_GROUPS)[number]["id"];

/** Menu bawaan. `id` sama dengan prototipe (dipakai di menu_config & access_control). */
export type BaseMenu = {
  id: string;
  label: string;
  icon: string;
  href: string;
  group: MenuGroupId;
  roles?: TenantRole[];
};

export const BASE_MENUS: BaseMenu[] = [
  { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/dashboard", group: "overview" },
  { id: "customer", label: "Customer DB", icon: "building-2", href: "/customers", group: "sales" },
  { id: "sales_daily", label: "Sales Daily Activity", icon: "clipboard-list", href: "/sales-daily", group: "activity" },
  { id: "admin_daily", label: "Admin Daily Activity", icon: "file-cog", href: "/admin-daily", group: "activity" },
  { id: "pipeline", label: "Pipeline Engine", icon: "kanban", href: "/pipeline", group: "sales" },
  { id: "forecast", label: "Sales Forecast", icon: "trending-up", href: "/forecast", group: "forecast" },
  { id: "quotation", label: "Monitoring Quotation", icon: "file-text", href: "/quotation", group: "sales" },
  { id: "trend", label: "Forecast Trend Analysis", icon: "bar-chart-3", href: "/forecast-trend", group: "forecast" },
  { id: "actual", label: "Sales Actual vs Forecast", icon: "scale", href: "/actual", group: "forecast" },
  { id: "doc", label: "Documentation", icon: "folder-archive", href: "/documentation", group: "team" },
  { id: "refreshment", label: "Refreshment & Assessment", icon: "graduation-cap", href: "/refreshment", group: "team" },
  { id: "evaluation", label: "Evaluasi Bulanan Sales", icon: "star", href: "/evaluation", group: "team" },
  { id: "analytics", label: "Analytics", icon: "pie-chart", href: "/analytics", group: "overview" },
  { id: "akun", label: "Akun", icon: "users", href: "/accounts", group: "admin", roles: ["master", "admin"] },
  { id: "settings", label: "App Customizer / Settings", icon: "settings", href: "/settings", group: "admin", roles: ["master", "admin"] },
];

export const MENU_ICONS = [
  "layout-dashboard", "building-2", "clipboard-list", "file-cog", "kanban", "trending-up",
  "file-text", "bar-chart-3", "scale", "folder-archive", "graduation-cap", "star", "pie-chart",
  "users", "settings", "shield", "briefcase", "database", "link", "globe", "zap", "book-open",
  "notebook", "file-check", "contact",
] as const;

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
  salesDailyType: ["Visit", "Call", "Meeting", "Survey", "Delivery", "Entertaint", "Chat WhatsApp"],
  salesDailyStatus: ["Completed", "Pending", "In Progress"],
  adminDailyType: ["PO Input", "Buat Quotation", "Input Quotation Accurate", "Kontrak", "Buat Data", "Buat Budget", "Buat MR", "Meeting", "Lainnya"],
  adminDailyStatus: ["Draft", "Pending", "Proses", "Selesai", "Ditolak"],
  forecastStatus: ["On Track", "Achieved", "Delayed", "At Risk"],
  poStatus: ["Pending", "Win", "Loss", "Cancel"],
  refreshmentJenis: ["Weekly Brainstorming", "Monthly Test"],
  refreshmentStatus: ["Terjadwal", "Selesai", "Dibatalkan"],
  evaluationStatus: ["Open", "In Progress", "Closed"],
} as const;

export const STORAGE_BUCKET = "files";
