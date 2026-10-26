import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  LockKeyhole,
  Palette,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { AccentThemeSwitcher } from "@/components/accent-theme-switcher";
import { CompanyLogos } from "@/components/auth/auth-shell";
import { FontSwitcher } from "@/components/font-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { APP_TAGLINE, DEFAULT_APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${DEFAULT_APP_NAME} — ${APP_TAGLINE}`,
  description:
    "CRM sales & marketing untuk industri dan pertambangan: pipeline, forecast, quotation, dan aktivitas tim dalam satu platform multi-tenant.",
};

const FEATURES = [
  { icon: Kanban, title: "Pipeline Progress", desc: "Pantau progress tiap deal dari prospek hingga good receive, lengkap dengan riwayat tiap step." },
  { icon: TrendingUp, title: "Sales Forecast", desc: "Proyeksi penjualan per periode, dibandingkan langsung dengan realisasi." },
  { icon: FileText, title: "Monitoring Quotation", desc: "Lacak status penawaran harga agar follow-up tidak terlewat." },
  { icon: ClipboardList, title: "Daily Activity", desc: "Catatan aktivitas harian Sales & Admin yang rapi dan mudah diaudit." },
  { icon: Building2, title: "Customer DB", desc: "Database pelanggan terpusat dengan Customer Code terintegrasi." },
  { icon: BarChart3, title: "Analytics & Trend", desc: "Pencapaian sales, performa tim, dan evaluasi bulanan." },
  { icon: GraduationCap, title: "Refreshment & Assessment", desc: "Pelatihan dan penilaian berkala untuk menjaga kualitas tim." },
  { icon: Palette, title: "App Customizer", desc: "Atur nama aplikasi, warna aksen, font, dan menu per perusahaan." },
];

const SHOWCASE = [
  {
    src: "/slide3.webp",
    alt: "Tim lapangan di depan alat berat Komatsu",
    eyebrow: "Dari lapangan ke laporan",
    title: "Aktivitas tim tercatat real-time",
    desc: "Setiap kunjungan, follow-up, dan penawaran tercatat di satu tempat. Manajemen melihat kondisi lapangan tanpa menunggu laporan akhir bulan.",
    points: ["Sales & Admin Daily Activity", "Riwayat login & status online", "Dokumentasi terpusat"],
  },
  {
    src: "/slide4.webp",
    alt: "Pemasangan lampu kerja pada kabin excavator",
    eyebrow: "Skala industri",
    title: "Forecast yang bisa dipertanggungjawabkan",
    desc: "Bandingkan forecast dengan realisasi, lihat tren antar periode, dan temukan deviasi lebih awal untuk proyek bernilai besar.",
    points: ["Sales Actual", "Sales Actual vs Forecast", "Evaluasi bulanan otomatis"],
  },
];

const ROLES = [
  { icon: ShieldCheck, name: "Moderator", desc: "Kelola platform, company, dan aktivasi akun." },
  { icon: LockKeyhole, name: "Master", desc: "Kendali penuh atas company dan akses menu per akun." },
  { icon: Users, name: "Admin", desc: "Kelola tim Sales dan administrasi harian." },
  { icon: LayoutDashboard, name: "Sales", desc: "Fokus ke customer, pipeline, dan penawaran." },
];

export default async function Home() {
  const session = await getSession();
  const appHref = session ? (session.profile?.role === "moderator" ? "/moderator" : "/dashboard") : null;

  return (
    <div className="min-h-svh overflow-x-clip">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-md" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{DEFAULT_APP_NAME}</span>
              <span className="block truncate text-xs text-muted-foreground">{APP_TAGLINE}</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#fitur" className="transition-colors hover:text-foreground">
              Fitur
            </a>
            <a href="#solusi" className="transition-colors hover:text-foreground">
              Solusi
            </a>
            <a href="#akses" className="transition-colors hover:text-foreground">
              Hak Akses
            </a>
          </nav>
          <div className="flex items-center gap-0.5">
            <div className="hidden items-center gap-0.5 sm:flex">
              <AccentThemeSwitcher />
              <FontSwitcher />
            </div>
            <ThemeSwitcher />
            {appHref ? (
              <Button asChild size="sm" className="ml-1.5">
                <Link href={appHref}>Buka Aplikasi</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="ml-1.5 hidden sm:inline-flex">
                  <Link href="/register">Daftar</Link>
                </Button>
                <Button asChild size="sm" className="ml-1.5">
                  <Link href="/login">Masuk</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <Image
          src="/slide2.webp"
          alt="Excavator Komatsu PC3000 di area tambang"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
          style={{ objectPosition: "50% 55%" }}
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-slate-950/70 via-transparent to-transparent" />
        <div className="mx-auto flex min-h-[80svh] w-full max-w-7xl flex-col justify-end px-4 py-16 md:px-6 md:py-24">
          <p className="text-sm font-medium text-white/75">Lourdes Auto Parts · PT. Garuda Mart Indonesia</p>
          <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold tracking-tight text-balance md:text-5xl">
            CRM untuk tim sales industri &amp; pertambangan
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Pipeline, forecast, quotation, dan aktivitas harian tim sales dalam satu platform. Data tiap perusahaan
            terisolasi, akses diatur per peran.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-6">
              <Link href={appHref ?? "/login"}>
                {appHref ? "Buka Aplikasi" : "Masuk ke Platform"} <ArrowRight />
              </Link>
            </Button>
            {!appHref && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/30 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/register">Daftar Akun</Link>
              </Button>
            )}
          </div>
          <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-6 sm:grid-cols-4">
            {[
              ["15+", "Modul siap pakai"],
              ["4", "Level hak akses"],
              ["Multi", "Tenant terisolasi"],
              ["Live", "Status tim online"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-2xl font-semibold tabular-nums">{v}</dt>
                <dd className="mt-0.5 text-xs text-white/70">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
        <SectionHead eyebrow="Fitur" title="Semua yang dibutuhkan tim sales B2B" desc="Modul yang saling terhubung, dari data customer hingga evaluasi performa." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="gap-0 py-5">
              <CardHeader className="gap-3 px-5">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section id="solusi" className="scroll-mt-20 border-y bg-muted/50 dark:bg-muted/10">
        <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 md:px-6 md:py-24">
          {SHOWCASE.map((s, i) => (
            <div key={s.title} className="grid items-center gap-10 md:grid-cols-2">
              <div className={`relative aspect-4/3 overflow-hidden rounded-xl border shadow-sm ${i % 2 ? "md:order-2" : ""}`}>
                <Image src={s.src} alt={s.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">{s.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-3xl">{s.title}</h2>
                <p className="mt-4 text-muted-foreground">{s.desc}</p>
                <ul className="mt-6 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hak akses */}
      <section id="akses" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
        <SectionHead
          eyebrow="Keamanan"
          title="Hierarki akses yang jelas"
          desc="Setiap company punya data sendiri yang terisolasi. Master bisa membatasi menu per akun."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ icon: Icon, name, desc }, i) => (
            <Card key={name} className="relative gap-0 py-5">
              <CardHeader className="gap-3 px-5">
                <span className="absolute top-4 right-5 font-mono text-xs text-muted-foreground">0{i + 1}</span>
                <Icon className="size-5 text-primary" />
                <CardTitle>{name}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center md:px-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">Siap merapikan pipeline tim Anda?</h2>
            <p className="mt-2 max-w-xl text-primary-foreground/80">
              Daftar sekarang. Akun diaktifkan moderator dan dihubungkan ke company Anda.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="h-11 shrink-0 px-6">
            <Link href={appHref ?? "/register"}>
              {appHref ? "Buka Aplikasi" : "Daftar Sekarang"} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 md:px-6">
          <CompanyLogos className="w-full max-w-md" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PT. Garuda Mart Indonesia · {DEFAULT_APP_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{desc}</p>
    </div>
  );
}
