"use client";

import { createContext, use, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DrillFilter, DrillKind } from "@/lib/insights/drill";
import type { PageFilter, Viewer } from "@/lib/insights/types";
import type { DateRange } from "@/lib/period";
import { cn } from "@/lib/utils";
import { DrillDialog } from "./drill-dialog";

export type DrillOpen = {
  kind: DrillKind;
  title: string;
  /** baris kedua di header modal, mis. "Kategori Electrical" */
  subtitle?: string;
  /** default: periode halaman */
  range?: DateRange;
  filter?: DrillFilter;
  /** default: filter Sales halaman; null = semua */
  sales?: string | null;
};

type Ctx = {
  viewer: Viewer;
  filter: PageFilter;
  pending: boolean;
  /** ubah query string (null/"" = hapus) lalu render ulang server dalam transition */
  navigate: (patch: Record<string, string | null | undefined>) => void;
  openDrill: (d: DrillOpen) => void;
};

const InsightsContext = createContext<Ctx | null>(null);

export function useInsights() {
  const ctx = use(InsightsContext);
  if (!ctx) throw new Error("useInsights harus di dalam <InsightsProvider>");
  return ctx;
}

/**
 * Bingkai halaman Dashboard/Analytics: filter disimpan di URL, perubahan filter
 * dirender ulang di server dalam transition — tampilan lama tetap terlihat
 * (redup) sampai data baru siap, tanpa skeleton/lompatan layout.
 */
export function InsightsProvider({
  basePath,
  viewer,
  filter,
  children,
}: {
  basePath: string;
  viewer: Viewer;
  filter: PageFilter;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drill, setDrill] = useState<DrillOpen | null>(null);

  const navigate = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const q = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v) q.set(k, v);
        else q.delete(k);
      }
      const qs = q.toString();
      // replace: ganti filter tidak menumpuk riwayat, Back langsung keluar dari halaman
      startTransition(() => router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false }));
    },
    [basePath, router],
  );

  const value = useMemo(() => ({ viewer, filter, pending, navigate, openDrill: setDrill }), [viewer, filter, pending, navigate]);

  return (
    <InsightsContext value={value}>
      <div
        role="progressbar"
        aria-hidden={!pending}
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary transition-[opacity,transform] duration-500",
          pending ? "scale-x-75 opacity-100" : "scale-x-0 opacity-0",
        )}
      />
      {children}
      <DrillDialog request={drill} onClose={() => setDrill(null)} />
    </InsightsContext>
  );
}

/** Area konten yang ikut redup saat filter sedang dimuat. */
export function PendingFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useInsights();
  return (
    <div
      aria-busy={pending}
      className={cn(
        // min-w-0: item grid tidak boleh melebar melebihi layar karena lebar minimum isinya
        "col-span-12 grid min-w-0 grid-cols-12 items-start gap-4 transition-opacity duration-200 md:gap-6 [&>*]:min-w-0",
        pending && "pointer-events-none opacity-60",
        className,
      )}
    >
      {children}
    </div>
  );
}
