"use client";

import { CustomizeButton, CustomizeSheet, usePrefsEditor } from "@/components/insights/customize-sheet";
import { PeriodBar } from "@/components/insights/period-bar";
import { InsightsProvider, PendingFrame } from "@/components/insights/provider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsData } from "@/lib/insights/types";
import { ANALYTICS_PRESETS } from "@/lib/period";
import {
  ANALYTICS_SECTIONS,
  DEFAULT_ANALYTICS_PREFS,
  TOP_N_OPTIONS,
  type AnalyticsPrefs,
  type AnalyticsSectionId,
  type TopN,
  type WidgetSize,
} from "@/lib/prefs";
import {
  ActivityTrendSection,
  ActivityTypesSection,
  ConversionSection,
  KategoriSection,
  QuotationTrendSection,
  SalesTrendSection,
  SummarySection,
  TopCustomersSection,
  TopPartsSection,
  TopSalesSection,
} from "./sections";

type SectionProps = { data: AnalyticsData; size: WidgetSize };

const SECTIONS: Record<AnalyticsSectionId, (p: SectionProps) => React.ReactNode> = {
  summary: SummarySection,
  sales_trend: SalesTrendSection,
  activity_trend: ActivityTrendSection,
  quotation_trend: QuotationTrendSection,
  top_sales: TopSalesSection,
  top_customers: TopCustomersSection,
  top_parts: TopPartsSection,
  kategori: KategoriSection,
  conversion: ConversionSection,
  activity_types: ActivityTypesSection,
};

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const editor = usePrefsEditor<AnalyticsPrefs>("analytics", data.prefs, DEFAULT_ANALYTICS_PREFS);
  const prefs = editor.value;
  const view = { ...data, prefs };
  const { viewer } = data;

  const visible = prefs.sections.filter((s) => {
    if (!s.visible) return false;
    const def = ANALYTICS_SECTIONS.find((d) => d.id === s.id);
    return def && (!("manager" in def) || viewer.isManager);
  });

  return (
    <InsightsProvider basePath="/analytics" viewer={viewer} filter={data.filter}>
      <header className="col-span-12 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Performa penjualan, quotation, pipeline & aktivitas · dibanding periode sebelumnya · klik angka atau grafik untuk lihat datanya
        </p>
      </header>

      <PeriodBar presets={ANALYTICS_PRESETS} actions={<CustomizeButton onClick={editor.open} />} />

      <PendingFrame>
        {visible.map((s) => {
          const Section = SECTIONS[s.id as AnalyticsSectionId];
          return <Section key={s.id} data={view} size={s.size} />;
        })}
        {!visible.length && (
          <p className="col-span-12 py-16 text-center text-sm text-muted-foreground">
            Semua seksi disembunyikan. Klik <span className="font-medium text-foreground">Atur Tampilan</span> untuk menampilkannya lagi.
          </p>
        )}
      </PendingFrame>

      <CustomizeSheet
        open={editor.editing}
        title="Atur Analytics"
        description="Pilih seksi yang tampil, urutan, dan lebarnya. Tersimpan untuk akun kamu."
        defs={ANALYTICS_SECTIONS}
        layout={prefs.sections}
        onLayout={(sections) => editor.change({ sections })}
        isManager={viewer.isManager}
        period={prefs.period}
        presets={ANALYTICS_PRESETS}
        onPeriod={(period) => editor.change({ period })}
        extra={
          <div className="grid gap-2">
            <Label htmlFor="pref-topn">Jumlah baris Top Customer & Sparepart</Label>
            <Select value={String(prefs.topN)} onValueChange={(v) => editor.change({ topN: Number(v) as TopN })}>
              <SelectTrigger id="pref-topn" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOP_N_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Top {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        dirty={editor.dirty}
        saving={editor.saving}
        onSave={editor.save}
        onReset={editor.reset}
        onCancel={editor.cancel}
      />
    </InsightsProvider>
  );
}
