import {
  BarChart3, BookOpen, Briefcase, Building2, ClipboardList, Contact, Database, FileCheck, FileCog,
  FileText, FolderArchive, Globe, GraduationCap, Kanban, LayoutDashboard, Link, Notebook, PieChart,
  Scale, Settings, Shield, Star, TrendingUp, Users, Zap, type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "building-2": Building2,
  "clipboard-list": ClipboardList,
  "file-cog": FileCog,
  kanban: Kanban,
  "trending-up": TrendingUp,
  "file-text": FileText,
  "bar-chart-3": BarChart3,
  scale: Scale,
  "folder-archive": FolderArchive,
  "graduation-cap": GraduationCap,
  star: Star,
  "pie-chart": PieChart,
  users: Users,
  settings: Settings,
  shield: Shield,
  briefcase: Briefcase,
  database: Database,
  link: Link,
  globe: Globe,
  zap: Zap,
  "book-open": BookOpen,
  notebook: Notebook,
  "file-check": FileCheck,
  contact: Contact,
};

export function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? FileText;
  return <Icon className={className} />;
}
