/**
 * Export client-side (logika dari prototipe): Excel (SheetJS), PDF (jsPDF +
 * autotable), Word (.docx via `docx`). Library di-load dinamis agar tidak
 * membebani bundle awal.
 */

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportExcel(rows: Record<string, unknown>[], name: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${name}_${stamp()}.xlsx`);
}

export async function exportPDF(title: string, headers: string[], body: string[][], name: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(12);
  doc.text(title, 14, 14);
  doc.setFontSize(8);
  doc.text(`Dicetak ${new Date().toLocaleString("id-ID")}`, 14, 19);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 23,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [244, 244, 245] },
  });
  doc.save(`${name}_${stamp()}.pdf`);
}

export async function exportWord(title: string, headers: string[], body: string[][], name: string) {
  const d = await import("docx");
  const cell = (text: string, bold = false) =>
    new d.TableCell({
      children: [
        new d.Paragraph({ children: [new d.TextRun({ text, bold, size: 16, color: bold ? "FFFFFF" : undefined })] }),
      ],
      shading: bold ? { fill: "18181B", type: d.ShadingType.CLEAR, color: "auto" } : undefined,
    });
  const table = new d.Table({
    width: { size: 100, type: d.WidthType.PERCENTAGE },
    rows: [
      new d.TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) }),
      ...body.map((r) => new d.TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });
  const doc = new d.Document({
    sections: [
      {
        properties: { page: { size: { orientation: d.PageOrientation.LANDSCAPE } } },
        children: [
          new d.Paragraph({ text: title, heading: d.HeadingLevel.HEADING_1 }),
          new d.Paragraph({
            children: [new d.TextRun({ text: `Dicetak ${new Date().toLocaleString("id-ID")}`, size: 16, italics: true })],
          }),
          table,
        ],
      },
    ],
  });
  download(await d.Packer.toBlob(doc), `${name}_${stamp()}.docx`);
}

/** Workbook beberapa sheet (array of arrays); lebar kolom mengikuti isi. */
export async function exportWorkbook(sheets: { name: string; rows: unknown[][] }[], filename: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const widths: number[] = [];
    for (const r of s.rows) r.forEach((v, i) => (widths[i] = Math.max(widths[i] ?? 10, String(v ?? "").length + 2)));
    ws["!cols"] = widths.map((w) => ({ wch: Math.min(w, 70) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  XLSX.writeFile(wb, filename);
}

export async function readExcel(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  // raw: CSV dibaca apa adanya — "03/04/2025" jangan ditebak sebagai tanggal format US
  const wb = XLSX.read(await file.arrayBuffer(), { cellNF: true, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // sel bertipe tanggal di Excel → "YYYY-MM-DD" (format yang diterima form), apa pun format
  // tampilannya (dateNF tidak berlaku untuk sel yang punya format sendiri, mis. d/m/yyyy)
  for (const [addr, c] of Object.entries(ws)) {
    if (addr[0] !== "!" && c.t === "n" && c.z && XLSX.SSF.is_date(c.z)) c.w = XLSX.SSF.format("yyyy-mm-dd", c.v);
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
  // nomor baris asli (non-enumerable dari SheetJS, hilang saat dikirim ke server action)
  return rows.map((r) => ({ ...r, __row: Number((r as { __rowNum__?: number }).__rowNum__) + 1 }));
}

export function downloadJSON(data: unknown, filename: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}
