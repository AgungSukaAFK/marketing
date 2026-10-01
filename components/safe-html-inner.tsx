"use client";

import DOMPurify from "dompurify";

/**
 * Satu-satunya tempat `dangerouslySetInnerHTML` dipakai: konten menu kustom (SOP)
 * yang SELALU disanitasi DOMPurify (menutup celah stored XSS prototipe).
 */
export default function SafeHtmlInner({ html, className }: { html: string; className?: string }) {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "form", "input"] });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
