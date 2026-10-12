import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback saat pindah menu. Semua halaman (app) dinamis (auth + query Supabase), jadi tanpa
 * file ini Next.js tidak bisa prefetch dan klik sidebar terasa "hang" sampai server selesai render.
 * Sidebar & header tetap tampil; hanya area konten yang diganti skeleton.
 */
export default function Loading() {
  return (
    <Card className="col-span-12" aria-busy="true" aria-label="Memuat halaman">
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="ml-auto h-9 w-28" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full opacity-70" />
        ))}
      </CardContent>
    </Card>
  );
}
