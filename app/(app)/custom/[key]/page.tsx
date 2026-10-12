import { notFound } from "next/navigation";
import { Content } from "@/components/content";
import { SafeHtml } from "@/components/safe-html";
import { requireMenu } from "@/lib/auth";

export default async function CustomMenuPage({ params }: PageProps<"/custom/[key]">) {
  const { key } = await params;
  const { customMenus, menu } = await requireMenu(key);
  const cm = customMenus.find((c) => c.menu_key === key);
  if (!cm) notFound();

  return (
    <Content title={menu.label} description="Isi menu ini diedit lewat Settings › Menu Kustom.">
      <SafeHtml html={cm.content} className="prose prose-sm max-w-none dark:prose-invert" />
    </Content>
  );
}
