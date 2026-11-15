import { SECTION_MINUTES, SIM_PARTS, type SimKind } from "@/lib/eprt-simulation";
import type { ToeflSection } from "@/lib/toefl";

export type BriefGroup = { name: string; count: number };

export type BriefData = {
  section: ToeflSection;
  label: string;
  fullTitle: string;
  minutes: number;
  total: number;
  /** Satuan kotak angka ketiga: bagian untuk Listening/Structure, teks untuk Reading. */
  unit: string;
  groups: BriefGroup[];
  lead: string;
  rules: string[];
  checks: string[];
};

const KIND_NAME: Partial<Record<SimKind, string>> = {
  "listen-short": "Short Dialogue",
  "listen-long": "Long Dialogue",
  "listen-lecture": "Lecture",
  structure: "Sentence Completion",
  written: "Error Recognition",
};

const NO_PENALTY =
  "Tidak ada pengurangan nilai untuk jawaban salah, tetapi soal yang kosong dihitung salah. Benar atau salah baru tampil setelah simulasi selesai.";
const REVISIT = "Pindah antar soal lewat Daftar soal dan tandai soal yang masih ragu-ragu.";

/** Struktur dan angka diambil dari SIM_PARTS/SECTION_MINUTES, bukan ditulis ulang. */
export function buildBrief(section: ToeflSection): BriefData {
  const parts = SIM_PARTS.filter((part) => part.section === section);
  const minutes = SECTION_MINUTES[section];
  const total = parts.reduce((sum, part) => sum + part.count, 0);

  const groups: BriefGroup[] = [];
  for (const part of parts) {
    const name = KIND_NAME[part.kind];
    const last = groups[groups.length - 1];
    if (name && last?.name === name) last.count += part.count;
    else groups.push({ name: name ?? `Teks ${groups.length + 1}`, count: part.count });
  }

  const range = (kind: SimKind) => {
    const part = SIM_PARTS.find((item) => item.kind === kind)!;
    return `${part.first} sampai ${part.first + part.count - 1}`;
  };

  const base = { section, minutes, total, groups };
  if (section === "listening") {
    return {
      ...base,
      label: "Listening",
      fullTitle: "Listening Comprehension",
      unit: "bagian",
      lead: "Kamu akan mendengar percakapan dan kuliah dalam bahasa Inggris, lalu menjawab pertanyaan tentang isinya.",
      rules: [
        "Percakapan dan kuliah hanya diputar satu kali. Setelah itu hanya pertanyaannya yang bisa didengar ulang.",
        "Tekan Putar audio untuk memulai tiap bagian. Setelah kamu menekan Lanjut, audio soal berikutnya langsung diputar.",
        "Soal tidak bisa dibuka kembali setelah kamu lanjut.",
        NO_PENALTY,
      ],
      checks: [
        "Headset atau speaker sudah terpasang",
        `Ruangan cukup tenang selama ${minutes} menit`,
        "Tes suara terdengar jelas",
      ],
    };
  }
  if (section === "structure") {
    return {
      ...base,
      label: "Structure",
      fullTitle: "Structure & Written Expression",
      unit: "bagian",
      lead: "Kamu akan melengkapi kalimat dan menemukan bagian kalimat yang salah secara grammar.",
      rules: [
        `Soal ${range("structure")}: pilih kata atau frasa yang melengkapi kalimat.`,
        `Soal ${range("written")}: pilih satu bagian bergaris bawah yang salah.`,
        REVISIT,
        NO_PENALTY,
      ],
      checks: [`Waktu kosong ${minutes} menit tanpa gangguan`, "Notifikasi di perangkat sudah dimatikan"],
    };
  }
  return {
    ...base,
    label: "Reading",
    fullTitle: "Reading Comprehension",
    unit: "teks",
    lead: "Kamu akan membaca beberapa teks akademik, lalu menjawab pertanyaan tentang isi, kosakata, dan kesimpulannya.",
    rules: [
      `${groups.length} teks, tiap teks ${parts[0].count} soal. Tiap teks dibuka sebagai bagian sendiri, berurutan.`,
      "Jawab berdasarkan isi teks, bukan pengetahuan di luar teks.",
      REVISIT,
      NO_PENALTY,
    ],
    checks: [
      `Waktu kosong ${minutes} menit tanpa gangguan`,
      "Layar cukup terang dan nyaman untuk membaca",
      "Kertas coretan sudah siap",
    ],
  };
}
