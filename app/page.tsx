import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
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
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "TITAN APEX V4 — Industrial & Mining CRM",
  description: "CRM sales & marketing untuk industri dan pertambangan: pipeline, forecast, quotation, dan aktivitas tim dalam satu platform multi-tenant.",
};

// Foto: Unsplash License (bebas dipakai komersial, atribusi tidak wajib)
const img = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
const HERO = img("1654461339694-128902c5c075", 2400);

const FEATURES = [
  { icon: Kanban, title: "Pipeline Engine", desc: "Pantau setiap peluang dari prospek hingga closing dalam papan kanban yang jelas." },
  { icon: TrendingUp, title: "Sales Forecast", desc: "Proyeksi penjualan per periode dan bandingkan langsung dengan realisasi aktual." },
  { icon: FileText, title: "Monitoring Quotation", desc: "Lacak status penawaran harga agar tidak ada follow-up yang terlewat." },
  { icon: ClipboardList, title: "Daily Activity", desc: "Catatan aktivitas harian Sales & Admin yang rapi dan mudah diaudit." },
  { icon: Building2, title: "Customer DB", desc: "Database pelanggan terpusat dengan Customer Code yang terintegrasi." },
  { icon: BarChart3, title: "Analytics & Trend", desc: "Analisis tren forecast, performa tim, dan evaluasi bulanan sales." },
  { icon: GraduationCap, title: "Refreshment & Assessment", desc: "Program pelatihan dan penilaian berkala untuk menjaga kualitas tim." },
  { icon: Palette, title: "App Customizer", desc: "Atur warna aksen, font, kepadatan tampilan, dan menu kustom per company." },
];

const SHOWCASE = [
  {
    src: img("1709489662983-3674d790b224"),
    alt: "Truk tambang di area open pit",
    eyebrow: "Dari lapangan ke laporan",
    title: "Aktivitas tim tercatat real-time",
    desc: "Setiap kunjungan, follow-up, dan penawaran tercatat di satu tempat. Manajemen melihat kondisi lapangan tanpa menunggu laporan akhir bulan.",
    points: ["Sales & Admin Daily Activity", "Riwayat login & status online", "Dokumentasi terpusat"],
  },
  {
    src: img("1659291457360-13ef34276765"),
    alt: "Excavator raksasa di tambang terbuka",
    eyebrow: "Skala industri",
    title: "Forecast yang bisa dipertanggungjawabkan",
    desc: "Bandingkan forecast dengan realisasi, lihat tren antar periode, dan temukan deviasi lebih awal untuk proyek bernilai besar.",
    points: ["Forecast Trend Analysis", "Sales Actual vs Forecast", "Evaluasi bulanan otomatis"],
  },
];

const ROLES = [
  { icon: ShieldCheck, name: "Moderator", desc: "Kelola platform, company, dan aktivasi akun." },
  { icon: LockKeyhole, name: "Master", desc: "Kendali penuh atas company, kontrol akses menu." },
  { icon: Users, name: "Admin", desc: "Kelola tim Sales dan administrasi harian." },
  { icon: LayoutDashboard, name: "Sales", desc: "Fokus ke customer, pipeline, dan penawaran." },
];

export default async function Home() {
  const session = await getSession();
  const appHref = session ? (session.profile?.role === "moderator" ? "/moderator" : "/dashboard") : null;

  return (
    <div className="min-h-svh overflow-x-clip">
      {/* Navbar */}
      <header className="glass fixed inset-x-0 top-0 z-30 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-black text-primary-foreground">T</span>
            <span className="leading-tight">
              <span className="block font-bold text-brand-text">TITAN APEX</span>
              <span className="block text-[10px] tracking-widest text-muted-foreground">INDUSTRIAL &amp; MINING CRM</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#fitur" className="hover:text-foreground">Fitur</a>
            <a href="#solusi" className="hover:text-foreground">Solusi</a>
            <a href="#akses" className="hover:text-foreground">Hak Akses</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {appHref ? (
              <Button asChild size="sm" className="font-bold">
                <Link href={appHref}>Buka Aplikasi</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/register">Daftar</Link>
                </Button>
                <Button asChild size="sm" className="font-bold">
                  <Link href="/login">Masuk</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate flex min-h-[92svh] items-center pt-16">
        <Image src={HERO} alt="Bucket wheel excavator di tambang terbuka" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/80 via-background/75 to-background" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--brand)_28%,transparent),transparent_60%)]" />
        <div className="fade-in mx-auto w-full max-w-7xl px-4 py-20 md:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-text">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Master Control Edition · V4
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-balance md:text-6xl">
            CRM yang dibangun untuk <span className="bg-gradient-to-r from-brand to-cyan-400 bg-clip-text text-transparent">industri &amp; pertambangan</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Pipeline, forecast, quotation, dan aktivitas harian tim sales dalam satu platform. Data tiap perusahaan terisolasi penuh, akses
            diatur per peran.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="font-bold">
              <Link href={appHref ?? "/login"}>
                {appHref ? "Buka Aplikasi" : "Masuk ke Platform"} <ArrowRight />
              </Link>
            </Button>
            {!appHref && (
              <Button asChild size="lg" variant="secondary">
                <Link href="/register">Daftar Akun</Link>
              </Button>
            )}
          </div>
          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["15+", "Modul siap pakai"],
              ["4", "Level hak akses"],
              ["Multi", "Tenant terisolasi"],
              ["Live", "Status tim online"],
            ].map(([v, l]) => (
              <div key={l} className="glass rounded-xl border p-4">
                <dt className="text-2xl font-black text-brand-text">{v}</dt>
                <dd className="mt-1 text-xs text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 md:px-6">
        <SectionHead eyebrow="Fitur" title="Semua yang dibutuhkan tim sales B2B" desc="Modul yang saling terhubung — dari data customer hingga evaluasi performa." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border bg-card p-5 transition-colors hover:border-brand/50 dark:bg-gradient-to-b dark:from-white/6 dark:to-white/2"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand/15 text-brand-text transition-colors group-hover:bg-brand group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section id="solusi" className="scroll-mt-20 border-y bg-card/40">
        <div className="mx-auto max-w-7xl space-y-20 px-4 py-20 md:px-6">
          {SHOWCASE.map((s, i) => (
            <div key={s.title} className="grid items-center gap-10 md:grid-cols-2">
              <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl border ${i % 2 ? "md:order-2" : ""}`}>
                <Image src={s.src} alt={s.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest text-brand-text uppercase">{s.eyebrow}</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-balance">{s.title}</h2>
                <p className="mt-4 text-muted-foreground">{s.desc}</p>
                <ul className="mt-6 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <span className="size-1.5 rounded-full bg-brand" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hak akses */}
      <section id="akses" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 md:px-6">
        <SectionHead
          eyebrow="Keamanan"
          title="Hierarki akses yang jelas"
          desc="Setiap company punya data sendiri yang terisolasi. Master bisa membatasi menu per akun."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ icon: Icon, name, desc }, i) => (
            <div key={name} className="relative rounded-2xl border bg-card p-5">
              <span className="absolute top-4 right-4 font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <Icon className="size-6 text-brand-text" />
              <h3 className="mt-3 font-bold">{name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="relative isolate overflow-hidden rounded-3xl border p-8 md:p-14">
          <Image src={img("1603479147545-1ae6bc737e48")} alt="" fill sizes="100vw" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/90 to-background/40" />
          <h2 className="max-w-xl text-3xl font-black tracking-tight text-balance md:text-4xl">Siap merapikan pipeline tim Anda?</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Daftar sekarang. Akun akan diaktifkan oleh moderator dan dihubungkan ke company Anda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="font-bold">
              <Link href={appHref ?? "/register"}>
                {appHref ? "Buka Aplikasi" : "Daftar Sekarang"} <ArrowRight />
              </Link>
            </Button>
            {!appHref && (
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">Sudah punya akun</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} TITAN APEX — Industrial &amp; Mining CRM</p>
          <p>
            Foto dari{" "}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Unsplash
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold tracking-widest text-brand-text uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-balance md:text-4xl">{title}</h2>
      <p className="mt-4 text-muted-foreground">{desc}</p>
    </div>
  );
}
