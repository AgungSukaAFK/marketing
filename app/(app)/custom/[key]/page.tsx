import { notFound } from "next/navigation";
import { SafeHtml } from "@/components/safe-html";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMenu } from "@/lib/auth";

export default async function CustomMenuPage({ params }: PageProps<"/custom/[key]">) {
  const { key } = await params;
  const { customMenus, menu } = await requireMenu(key);
  const cm = customMenus.find((c) => c.menu_key === key);
  if (!cm) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{menu.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl bg-muted p-4">
          <SafeHtml html={cm.content} className="prose prose-sm dark:prose-invert max-w-none" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Isi menu ini diedit lewat Settings › Menu Kustom.</p>
      </CardContent>
    </Card>
  );
}
