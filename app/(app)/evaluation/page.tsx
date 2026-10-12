import { EntityPage } from "@/components/entity/entity-page";
import { Content } from "@/components/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadEntity } from "@/lib/data";
import { semesterOf, toNumber } from "@/lib/format";

export default async function Page() {
  const { rows, lookups, me } = await loadEntity("evaluation");
  const username = new Map(lookups.profiles.map((p) => [p.id, p.username]));

  // Ringkasan semester (dihitung, tidak disimpan) — sama dengan prototipe
  type Group = { sem: string; sales: string; count: number; total: number; topics: string[] };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const sem = semesterOf(r.periode);
    const sales = (r.sales_id && username.get(r.sales_id)) || "-";
    const key = `${sem}|${sales}`;
    const g: Group = groups.get(key) ?? { sem, sales, count: 0, total: 0, topics: [] };
    g.count++;
    g.total += toNumber(r.skor);
    g.topics.push(r.topik);
    groups.set(key, g);
  }
  const summary = [...groups.values()].sort((a, b) => b.sem.localeCompare(a.sem) || a.sales.localeCompare(b.sales));

  return (
    <EntityPage entity="evaluation" rows={rows} lookups={lookups} me={me}>
      <Content title="Ringkasan Semester" description="Dihitung otomatis dari evaluasi per sales per semester">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground">Semester</TableHead>
                <TableHead className="text-muted-foreground">Sales</TableHead>
                <TableHead className="text-right text-muted-foreground">Isu</TableHead>
                <TableHead className="text-right text-muted-foreground">Rata-rata Skor</TableHead>
                <TableHead className="text-muted-foreground">Topik</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length ? (
                summary.map((s) => (
                  <TableRow key={`${s.sem}|${s.sales}`}>
                    <TableCell className="font-medium">{s.sem}</TableCell>
                    <TableCell>{s.sales}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{(s.total / s.count).toFixed(1)}</TableCell>
                    <TableCell className="max-w-md truncate" title={s.topics.join(", ")}>
                      {s.topics.join(", ")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                    Belum ada data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Content>
    </EntityPage>
  );
}
