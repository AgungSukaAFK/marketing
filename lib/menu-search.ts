/**
 * Pencarian menu sidebar yang "longgar": cocok lewat label, sinonim (ID/EN),
 * nama kelompok, dan tetap toleran terhadap salah ketik ringan.
 */

/** Sinonim per id menu bawaan — kata yang mungkin diketik user selain labelnya. */
const MENU_KEYWORDS: Record<string, string[]> = {
  dashboard: ["dasbor", "dasboard", "home", "beranda", "utama", "ringkasan", "overview", "summary"],
  customer: ["pelanggan", "klien", "client", "konsumen", "perusahaan", "company", "database", "kontak", "contact"],
  sales_daily: ["aktivitas", "kegiatan", "harian", "laporan", "report", "visit", "kunjungan", "daily", "activity"],
  admin_daily: ["aktivitas", "kegiatan", "harian", "laporan", "report", "administrasi", "daily", "activity"],
  pipeline: ["prospek", "prospect", "deal", "funnel", "kanban", "peluang", "opportunity", "lead", "progress", "stepper", "riwayat"],
  forecast: ["prakiraan", "perkiraan", "proyeksi", "projection", "target", "ramalan"],
  quotation: ["penawaran", "quote", "harga", "price", "offer", "sph"],
  sales_actual: ["realisasi", "aktual", "penjualan", "pencapaian", "achievement", "omzet", "revenue"],
  actual: ["realisasi", "aktual", "pencapaian", "achievement", "perbandingan", "compare", "versus", "vs"],
  doc: ["dokumen", "dokumentasi", "file", "berkas", "arsip", "archive", "foto", "lampiran"],
  refreshment: ["pelatihan", "training", "ujian", "tes", "test", "kuis", "quiz", "penilaian", "assessment", "materi"],
  evaluation: ["evaluasi", "penilaian", "review", "kinerja", "performance", "kpi", "rating", "bulanan", "monthly"],
  kpi: ["kpi", "indikator", "kinerja", "performance", "target", "skor", "score", "rapor", "peringkat", "ranking", "pencapaian"],
  analytics: ["analitik", "analisis", "statistik", "statistics", "laporan", "report", "grafik", "chart"],
  akun: ["account", "user", "pengguna", "member", "anggota", "tim", "team", "karyawan", "staff", "akses", "role"],
  settings: ["pengaturan", "setelan", "konfigurasi", "config", "customize", "kustomisasi", "tema", "theme", "tampilan", "preferensi"],
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const words = (s: string) => normalize(s).split(" ").filter(Boolean);

/** Jarak edit Damerau-Levenshtein (versi optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Batas salah ketik yang masih ditoleransi, makin panjang kata makin longgar. */
const tolerance = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);

/**
 * Skor kecocokan satu kata ketikan terhadap satu kata kandidat (0 = tidak cocok).
 * Prefix/substring dinilai paling tinggi, lalu salah ketik pada kata utuh atau awalannya.
 */
function wordScore(q: string, w: string): number {
  if (w === q) return 100;
  if (w.startsWith(q)) return 90;
  if (q.length >= 3 && w.includes(q)) return 70;
  const tol = tolerance(q.length);
  if (!tol) return 0;
  let best = editDistance(q, w);
  // ketikan yang belum selesai: bandingkan dengan awalan kata sepanjang ketikan (+1)
  for (let n = q.length; n <= q.length + 1; n++) {
    if (n < w.length) best = Math.min(best, editDistance(q, w.slice(0, n)));
  }
  return best <= tol ? 60 - best * 15 : 0;
}

export type SearchableMenu = { id: string; label: string; defaultLabel?: string };

/**
 * Skor menu terhadap query; 0 berarti disembunyikan. Semua kata di query harus
 * cocok dengan salah satu kata kandidat (label, label bawaan, sinonim, kelompok).
 */
export function menuSearchScore(menu: SearchableMenu, query: string, groupLabel = ""): number {
  const qWords = words(query);
  if (!qWords.length) return 1;

  const label = words(menu.label);
  const extra = [
    ...words(menu.defaultLabel ?? ""),
    ...(MENU_KEYWORDS[menu.id] ?? []).flatMap(words),
    ...words(groupLabel),
  ];

  // seluruh query sebagai satu frasa di label → paling relevan
  const phraseBonus = normalize(menu.label).includes(normalize(query)) ? 50 : 0;

  let total = 0;
  for (const q of qWords) {
    const onLabel = Math.max(0, ...label.map((w) => wordScore(q, w)));
    const onExtra = Math.max(0, ...extra.map((w) => wordScore(q, w))) * 0.8;
    const s = Math.max(onLabel, onExtra);
    if (!s) return 0;
    total += s;
  }
  return total / qWords.length + phraseBonus;
}

/**
 * Saring & urutkan menu berdasarkan query. Hasil yang skornya jauh di bawah hasil
 * terbaik dibuang, supaya kecocokan salah-ketik tidak mengotori hasil yang jelas.
 */
export function searchMenus<T extends SearchableMenu>(
  menus: T[],
  query: string,
  groupLabel: (m: T) => string = () => "",
): T[] {
  const scored = menus
    .map((m) => ({ m, score: menuSearchScore(m, query, groupLabel(m)) }))
    .filter((x) => x.score > 0);
  const top = Math.max(0, ...scored.map((x) => x.score));
  return scored
    .filter((x) => x.score >= top * 0.5)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}
