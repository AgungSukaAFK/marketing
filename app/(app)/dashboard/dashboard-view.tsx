"use client";

import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { CustomizeButton, CustomizeSheet, usePrefsEditor } from "@/components/insights/customize-sheet";
import { PeriodBar } from "@/components/insights/period-bar";
import { InsightsProvider, PendingFrame } from "@/components/insights/provider";
import { fmtNumber } from "@/lib/format";
import type { DashboardData } from "@/lib/insights/types";
import { DASHBOARD_PRESETS } from "@/lib/period";
import {
  DASHBOARD_TILES,
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_PREFS,
  type DashboardPrefs,
  type DashboardWidgetId,
  type WidgetSize,
} from "@/lib/prefs";
import { AnniversaryCard } from "./anniversary-card";
import {
  ActivityTrendWidget,
  AgendaWidget,
  FunnelWidget,
  HeroWidget,
  KategoriWidget,
  LeaderboardWidget,
  QuotationWidget,
  RecentWidget,
  SalesTrendWidget,
  StatsWidget,
} from "./widgets";

type WidgetProps = { data: DashboardData; size: WidgetSize };

function AnniversaryWidget({ data, size }: WidgetProps) {
  return (
    <AnniversaryCard
      className={size === "half" ? "lg:col-span-6" : undefined}
      items={data.anniversaries}
      salesName={new Map(data.anniversaries.filter((a) => a.sales_id && a.salesName).map((a) => [a.sales_id!, a.salesName!]))}
    />
  );
}

const WIDGETS: Record<DashboardWidgetId, (p: WidgetProps) => React.ReactNode> = {
  hero: HeroWidget,
  stats: StatsWidget,
  agenda: AgendaWidget,
  sales_trend: SalesTrendWidget,
  activity_trend: ActivityTrendWidget,
  funnel: FunnelWidget,
  quotation: QuotationWidget,
  kategori: KategoriWidget,
  leaderboard: LeaderboardWidget,
  recent: RecentWidget,
  anniversary: AnniversaryWidget,
};

function GreetingIcon({ hello }: { hello: string }) {
  const Icon = hello.endsWith("pagi") ? Sunrise : hello.endsWith("siang") ? Sun : hello.endsWith("sore") ? Sunset : Moon;
  return <Icon className="size-5 text-primary" aria-hidden />;
}

export function DashboardView({ data }: { data: DashboardData }) {
  const editor = usePrefsEditor<DashboardPrefs>("dashboard", data.prefs, DEFAULT_DASHBOARD_PREFS);
  const prefs = editor.value;
  const view = { ...data, prefs };
  const { viewer, greeting, agenda, anniversaries } = data;
  const pending = agenda.reduce((a, x) => a + x.count, 0);
  const today = anniversaries.filter((a) => a.daysLeft === 0).length;
  const firstName = viewer.name.split(" ")[0];

  const visible = prefs.widgets.filter((w) => {
    if (!w.visible) return false;
    const def = DASHBOARD_WIDGETS.find((d) => d.id === w.id);
    return def && (!("manager" in def) || viewer.isManager);
  });

  return (
    <InsightsProvider basePath="/dashboard" viewer={viewer} filter={data.filter}>
      <header className="col-span-12 flex min-w-0 flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <GreetingIcon hello={greeting.hello} />
          {greeting.hello}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {greeting.date}
          {pending ? ` · ${fmtNumber(pending)} hal perlu tindak lanjut` : " · Semua tindak lanjut beres"}
          {today ? ` · ${fmtNumber(today)} customer ulang tahun hari ini` : ""}
        </p>
      </header>

      <PeriodBar presets={DASHBOARD_PRESETS} actions={<CustomizeButton onClick={editor.open} />} />

      <PendingFrame>
        {visible.map((w) => {
          const Widget = WIDGETS[w.id as DashboardWidgetId];
          return <Widget key={w.id} data={view} size={w.size} />;
        })}
        {!visible.length && (
          <p className="col-span-12 py-16 text-center text-sm text-muted-foreground">
            Semua widget disembunyikan. Klik <span className="font-medium text-foreground">Atur Tampilan</span> untuk menampilkannya lagi.
          </p>
        )}
      </PendingFrame>

      <CustomizeSheet
        open={editor.editing}
        title="Atur Dashboard"
        description="Pilih widget yang tampil, urutan, dan lebarnya. Tersimpan untuk akun kamu."
        defs={DASHBOARD_WIDGETS}
        layout={prefs.widgets}
        onLayout={(widgets) => editor.change({ widgets })}
        isManager={viewer.isManager}
        tiles={{ defs: DASHBOARD_TILES, value: prefs.tiles, onChange: (tiles) => editor.change({ tiles }) }}
        period={prefs.period}
        presets={DASHBOARD_PRESETS}
        onPeriod={(period) => editor.change({ period })}
        dirty={editor.dirty}
        saving={editor.saving}
        onSave={editor.save}
        onReset={editor.reset}
        onCancel={editor.cancel}
      />
    </InsightsProvider>
  );
}
