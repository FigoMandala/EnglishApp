import type { NewLearningUnitItem } from "./schema";

/**
 * Jalur belajar pemula: unit berurutan, tiap unit menggabungkan satu materi
 * grammar dan satu set kosakata. Urutan mengikuti lesson pemula + lesson TOEFL
 * yang sudah ada (dicocokkan lewat slug di seed).
 */
export type UnitSeed = {
  slug: string;
  title: string;
  description: string;
  level: "basic" | "intermediate" | "advanced";
  items: Omit<NewLearningUnitItem, "unitId">[];
};

export const LEARNING_PATH: UnitSeed[] = [
  {
    slug: "dasar-1-kata-benda",
    title: "Unit 1: Kata Benda & Artikel",
    description: "Belajar a, an, the dan benda tunggal atau jamak.",
    level: "basic",
    items: [
      { kind: "grammar", refSlug: "a-an-the", title: "Materi: A, An, dan The", orderIndex: 1 },
      { kind: "vocab", vocabCount: 10, title: "Kosakata: benda sehari-hari", orderIndex: 2 },
      { kind: "grammar", refSlug: "singular-plural", title: "Materi: Tunggal dan Jamak", orderIndex: 3 },
    ],
  },
  {
    slug: "dasar-2-to-be",
    title: "Unit 2: To Be (am, is, are)",
    description: "Menyatakan keadaan dan identitas dengan am, is, are.",
    level: "basic",
    items: [
      { kind: "grammar", refSlug: "to-be-am-is-are", title: "Materi: To Be", orderIndex: 1 },
      { kind: "vocab", vocabCount: 10, title: "Kosakata: kata sifat umum", orderIndex: 2 },
      { kind: "grammar", refSlug: "personal-pronouns", title: "Materi: Kata Ganti", orderIndex: 3 },
    ],
  },
  {
    slug: "dasar-3-menunjuk",
    title: "Unit 3: Menunjuk & Memiliki",
    description: "Kata penunjuk dan cara menyatakan kepemilikan.",
    level: "basic",
    items: [
      { kind: "grammar", refSlug: "this-that-these-those", title: "Materi: This, That, These, Those", orderIndex: 1 },
      { kind: "grammar", refSlug: "have-has", title: "Materi: Have dan Has", orderIndex: 2 },
      { kind: "vocab", vocabCount: 10, title: "Kosakata: keluarga & orang", orderIndex: 3 },
    ],
  },
  {
    slug: "dasar-4-kalimat-sederhana",
    title: "Unit 4: Kalimat Sederhana",
    description: "Menyusun kalimat dasar dengan subjek dan kata kerja.",
    level: "basic",
    items: [
      { kind: "grammar", refSlug: "subject-verb-basic", title: "Materi: Subjek dan Kata Kerja", orderIndex: 1 },
      { kind: "vocab", vocabCount: 10, title: "Kosakata: kata kerja umum", orderIndex: 2 },
      { kind: "grammar", refSlug: "tenses", title: "Materi: Tenses Dasar", orderIndex: 3 },
    ],
  },
  {
    slug: "dasar-5-agreement",
    title: "Unit 5: Subjek dan Kata Kerja Sepakat",
    description: "Memastikan kata kerja cocok dengan subjeknya.",
    level: "basic",
    items: [
      { kind: "grammar", refSlug: "subject-verb-agreement", title: "Materi: Subject-Verb Agreement", orderIndex: 1 },
      { kind: "vocab", vocabCount: 10, title: "Kosakata: makanan & minuman", orderIndex: 2 },
    ],
  },
  {
    slug: "menengah-1-passive",
    title: "Unit 6: Kalimat Pasif",
    description: "Menggunakan be + V3 dengan tepat.",
    level: "intermediate",
    items: [
      { kind: "grammar", refSlug: "passive-voice", title: "Materi: Passive Voice", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: pekerjaan & kantor", orderIndex: 2 },
    ],
  },
  {
    slug: "menengah-2-klausa",
    title: "Unit 7: Klausa & Konektor",
    description: "Menggabungkan ide dengan klausa dan penghubung.",
    level: "intermediate",
    items: [
      { kind: "grammar", refSlug: "clauses", title: "Materi: Klausa dan Konektor", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: akademik", orderIndex: 2 },
    ],
  },
  {
    slug: "menengah-3-paralel",
    title: "Unit 8: Kesejajaran Kalimat",
    description: "Menjaga bentuk sejajar dalam daftar dan pasangan.",
    level: "intermediate",
    items: [
      { kind: "grammar", refSlug: "parallel-structure", title: "Materi: Parallel Structure", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: teknologi sehari-hari", orderIndex: 2 },
    ],
  },
  {
    slug: "lanjut-1-reduced",
    title: "Unit 9: Reduced Clause",
    description: "Meringkas klausa dengan participle.",
    level: "advanced",
    items: [
      { kind: "grammar", refSlug: "reduced-clauses", title: "Materi: Reduced Clause", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: bisnis", orderIndex: 2 },
    ],
  },
  {
    slug: "lanjut-2-article-preposisi",
    title: "Unit 10: Artikel & Preposisi Lanjutan",
    description: "Artikel dan preposisi yang sering salah di ujian.",
    level: "advanced",
    items: [
      { kind: "grammar", refSlug: "articles-prepositions", title: "Materi: Article dan Preposisi", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: akademik lanjut", orderIndex: 2 },
    ],
  },
  {
    slug: "menengah-4-perfect-tenses",
    title: "Unit 11: Perfect Tenses",
    description: "Present perfect dan past perfect untuk aksi yang sudah terjadi.",
    level: "intermediate",
    items: [
      { kind: "grammar", refSlug: "present-perfect", title: "Materi: Present Perfect", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: pengalaman & perjalanan", orderIndex: 2 },
      { kind: "grammar", refSlug: "past-perfect", title: "Materi: Past Perfect", orderIndex: 3 },
    ],
  },
  {
    slug: "menengah-5-rencana-masa-depan",
    title: "Unit 12: Rencana & Perbandingan",
    description: "Membicarakan masa depan dan membandingkan dua hal.",
    level: "intermediate",
    items: [
      { kind: "grammar", refSlug: "future-will-going-to", title: "Materi: Will & Going To", orderIndex: 1 },
      { kind: "grammar", refSlug: "comparatives-superlatives", title: "Materi: Comparative & Superlative", orderIndex: 2 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: rencana & tujuan", orderIndex: 3 },
    ],
  },
  {
    slug: "lanjut-3-pengandaian",
    title: "Unit 13: Kalimat Pengandaian",
    description: "Menguasai conditional type 0 sampai 3.",
    level: "advanced",
    items: [
      { kind: "grammar", refSlug: "conditionals", title: "Materi: Conditional Sentences", orderIndex: 1 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: sebab & akibat", orderIndex: 2 },
      { kind: "grammar", refSlug: "wish-subjunctive", title: "Materi: Wish & Subjunctive", orderIndex: 3 },
    ],
  },
  {
    slug: "lanjut-4-pasif-pelaporan",
    title: "Unit 14: Pasif & Pelaporan",
    description: "Kalimat pasif lanjutan dan reported speech.",
    level: "advanced",
    items: [
      { kind: "grammar", refSlug: "passive-voice-advanced", title: "Materi: Passive Voice Lanjutan", orderIndex: 1 },
      { kind: "grammar", refSlug: "reported-speech", title: "Materi: Reported Speech", orderIndex: 2 },
      { kind: "vocab", vocabCount: 12, title: "Kosakata: laporan & berita", orderIndex: 3 },
    ],
  },
  {
    slug: "lanjut-5-penekanan",
    title: "Unit 15: Struktur Lanjut & Penekanan",
    description: "Relative clause, inversi, dan modals of deduction.",
    level: "advanced",
    items: [
      { kind: "grammar", refSlug: "relative-clauses", title: "Materi: Relative Clauses", orderIndex: 1 },
      { kind: "grammar", refSlug: "inversion-emphasis", title: "Materi: Inversion & Emphasis", orderIndex: 2 },
      { kind: "grammar", refSlug: "modals-deduction", title: "Materi: Modals of Deduction", orderIndex: 3 },
    ],
  },
];