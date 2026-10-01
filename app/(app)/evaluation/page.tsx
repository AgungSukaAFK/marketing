import { EntityPage } from "@/components/entity/entity-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Semester</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semester</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Isu</TableHead>
                <TableHead>Rata-rata Skor</TableHead>
                <TableHead>Topik</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length ? (
                summary.map((s) => (
                  <TableRow key={`${s.sem}|${s.sales}`}>
                    <TableCell>{s.sem}</TableCell>
                    <TableCell>{s.sales}</TableCell>
                    <TableCell className="tabular-nums">{s.count}</TableCell>
                    <TableCell className="font-bold tabular-nums">{(s.total / s.count).toFixed(1)}</TableCell>
                    <TableCell className="max-w-md truncate">{s.topics.join(", ")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Belum ada data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </EntityPage>
  );
}
