"use client";

import dynamic from "next/dynamic";

/** Render HTML tersanitasi, hanya di browser (DOMPurify butuh DOM). */
export const SafeHtml = dynamic(() => import("./safe-html-inner"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-xl bg-muted" />,
});
