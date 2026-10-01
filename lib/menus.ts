import { BASE_MENUS, type TenantRole } from "@/lib/constants";

export type MenuConfig = {
  labels: Record<string, string>;
  icons: Record<string, string>;
  menu_order: string[];
  visibility: Record<string, boolean>;
};

export type CustomMenuRow = {
  id: string;
  menu_key: string;
  label: string;
  icon: string;
  content: string;
};

export type AccessRow = { enabled: boolean; allowed_menus: string[] } | null;

export type ResolvedMenu = {
  id: string;
  label: string;
  defaultLabel: string;
  icon: string;
  href: string;
  custom: boolean;
  roles?: TenantRole[];
};

/** Semua menu (bawaan + kustom) dalam urutan konfigurasi, tanpa filter apa pun. */
export function allMenusOrdered(cfg: MenuConfig, custom: CustomMenuRow[]): ResolvedMenu[] {
  const all: ResolvedMenu[] = [
    ...BASE_MENUS.map((m) => ({
      id: m.id,
      label: cfg.labels[m.id] || m.label,
      defaultLabel: m.label,
      icon: cfg.icons[m.id] || m.icon,
      href: m.href,
      custom: false,
      roles: m.roles,
    })),
    ...custom.map((c) => ({
      id: c.menu_key,
      label: cfg.labels[c.menu_key] || c.label,
      defaultLabel: c.label,
      icon: cfg.icons[c.menu_key] || c.icon || "file-text",
      href: `/custom/${c.menu_key}`,
      custom: true,
    })),
  ];
  const ordered = cfg.menu_order.map((id) => all.find((m) => m.id === id)).filter((m): m is ResolvedMenu => !!m);
  for (const m of all) if (!ordered.includes(m)) ordered.push(m);
  return ordered;
}

/**
 * Menu yang boleh dilihat user — logika sama dengan prototipe:
 * urutan → visibilitas global → role → batasan per akun (kecuali Master).
 */
export function visibleMenus(
  cfg: MenuConfig,
  custom: CustomMenuRow[],
  role: TenantRole,
  access: AccessRow,
): ResolvedMenu[] {
  return allMenusOrdered(cfg, custom)
    .filter((m) => cfg.visibility[m.id] !== false)
    .filter((m) => !m.roles || m.roles.includes(role))
    .filter((m) => role === "master" || !access?.enabled || access.allowed_menus.includes(m.id));
}
