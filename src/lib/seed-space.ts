/**
 * Ruang variasi untuk pembuat soal EPrT. Topik (800) saja habis terpakai ratusan kali pada ratusan ribu
 * soal; di sini tiap soal mendapat kombinasi konteks x pengubah x titik yang diuji (x bentuk teks /
 * pemicu skenario), sehingga ruang kombinasinya jutaan dan soal tidak berulang pola.
 */
import type { LevelBand } from "@/db/queries/question-bank";

export type Tier = "L" | "M" | "H";

/** Tingkat titik yang boleh dipakai per level: level menengah dan tinggi tidak menguji hal dasar. */
const TIERS: Record<LevelBand, Tier[]> = { low: ["L", "M"], mid: ["M"], high: ["M", "H"] };

/** Pengubah konteks yang ditempel pada topik supaya tiap soal berlatar berbeda. */
export const CONTEXT_MODIFIERS = [
  "in a small coastal town", "at a university laboratory", "during the nineteenth century", "in a rapidly growing city",
  "at a family-run business", "in a remote mountain village", "after a long period of drought", "at an international airport",
  "in a hospital ward", "during a national election year", "in a developing economy", "at a software start-up",
  "in a national park", "during a heat wave", "in a medieval market town", "at a public library",
  "on a research vessel", "in an agricultural cooperative", "in a design studio", "at a city council meeting",
  "during the early years of the internet", "in a school with limited funding", "in a museum's restoration workshop", "at a regional train station",
  "in a community garden", "during a power outage", "at a multinational company", "in a fishing village",
  "after a major earthquake", "in a night-shift factory", "at a wildlife sanctuary", "in an online learning platform",
  "during a historic trade expansion", "in an urban rooftop farm", "at a local newspaper", "in a mountain observatory",
  "at a small pharmacy", "in a cross-border partnership", "during a school sports season", "in a recycling plant",
];

/** Titik tata bahasa Sentence Completion (Structure) per tingkat. Tidak memuat hal yang sengaja dilarang prompt kualitas. */
const STRUCTURE_POINTS: [string, Tier][] = [
  ["article a/an/the/tanpa artikel yang tepat", "L"], ["preposisi waktu/tempat yang tepat", "L"], ["bentuk komparatif adjektiva", "L"],
  ["quantifier many/much/few/little sesuai jenis kata benda", "L"], ["adjektiva vs adverbia (word form)", "L"], ["because vs because of", "L"],
  ["gerund setelah preposisi", "L"], ["infinitive untuk menyatakan tujuan", "L"], ["present perfect dengan penanda waktu", "L"],
  ["kata ganti relatif who/which/that/whose", "M"], ["kalimat pasif present/past", "M"], ["conditional nyata atau tidak nyata di masa kini", "M"],
  ["noun clause dengan whether/that/what", "M"], ["konektor kontras although/despite/whereas", "M"], ["konektor sebab-akibat since/as a result of", "M"],
  ["perbandingan as...as / more...than", "M"], ["paralelisme dalam daftar tiga unsur", "M"], ["not only...but also", "M"],
  ["so...that / such...that", "M"], ["too/enough + infinitive", "M"], ["gerund vs infinitive setelah verba tertentu", "M"],
  ["past perfect dengan by the time", "M"], ["adjektiva + preposisi (interested in, capable of)", "M"], ["klausa waktu dengan tense yang benar", "M"],
  ["inversi setelah adverbia negatif (rarely, hardly, only after, not until)", "H"], ["conditional tipe 3 dengan inversi", "H"], ["kalimat belah It is...that", "H"],
  ["frasa apositif", "H"], ["perfect infinitive atau pasif perfect", "H"], ["paralelisme dengan either...or / neither...nor", "H"],
  ["klausa adverbial yang direduksi (while/after + V-ing) dengan subjek yang cocok", "H"], ["kausatif have/get/make", "H"],
  ["kata ganti relatif setelah preposisi (in which, to whom)", "H"], ["modal perfect (should have, might have)", "H"], ["mixed conditional", "H"],
  ["future perfect", "H"], ["so/neither + auxiliary", "H"], ["kalimat pasif dengan reporting verb (is said to have)", "H"],
  ["klausa nomina sebagai pelengkap subjek", "H"], ["urutan kata dalam pertanyaan tidak langsung (embedded question)", "M"],
];

/** Jenis kesalahan Error Recognition (Written): hanya kategori yang tegas. */
const WRITTEN_ERRORS: [string, Tier][] = [
  ["tense kata kerja yang bertentangan dengan penanda waktu", "L"], ["agreement subjek-verba pada subjek yang jelas tunggal/jamak", "L"],
  ["preposisi yang salah", "L"], ["artikel yang hilang atau berlebih", "L"], ["quantifier tidak cocok dengan jenis kata benda", "L"],
  ["bentuk kata kerja setelah modal atau to", "L"],
  ["word form: kata benda/adjektiva/adverbia tertukar", "M"], ["kata ganti relatif salah (whose/which/who)", "M"], ["paralelisme dalam daftar", "M"],
  ["bentuk komparatif atau superlatif", "M"], ["konjungsi salah (although/despite, because/because of)", "M"], ["gerund vs infinitive setelah verba tertentu", "M"],
  ["bentuk pasif yang salah (be hilang atau participle salah)", "M"], ["pronomina dengan rujukan atau kasus yang jelas salah", "M"],
  ["penanda ganda (more better, most easiest)", "M"], ["bentuk kata kerja dalam conditional", "M"],
  ["inversi yang hilang setelah adverbia negatif", "H"], ["paralelisme dengan correlative conjunctions", "H"], ["bentuk participle pada klausa yang direduksi", "H"],
  ["urutan tense dengan past perfect", "H"], ["urutan kata dalam embedded question", "H"], ["kolokasi preposisi setelah adjektiva/verba", "H"],
  ["few/little/fewer/less", "H"], ["bentuk setelah prefer / would rather", "H"], ["used to vs be used to", "H"],
];

/** Bentuk teks Reading, selain sudut pembahasan yang sudah ada. */
export const READING_REGISTERS = [
  "fitur majalah sains populer", "esai sejarah ringkas", "studi kasus bisnis", "profil bergaya wawancara",
  "panduan museum atau pameran", "artikel perjalanan informatif", "ringkasan hasil penelitian untuk awam", "kutipan biografi",
  "laporan lingkungan yang disederhanakan", "ulasan teknologi", "kolom pendidikan", "artikel perencanaan kota",
];

/** Pemicu dinamika dialog Listening supaya skenario yang sama tidak menghasilkan percakapan yang sama. */
export const SCENE_HOOKS = [
  "salah satu pembicara sedang terburu-buru", "ada kesalahpahaman kecil yang kemudian jelas", "mereka mengubah rencana", "satu pembicara memberi saran yang diragukan lawan bicara",
  "tenggat waktu menimbulkan tekanan", "seseorang menawarkan alternatif", "mereka tidak setuju dengan sopan", "ada kabar mengejutkan",
  "salah satu pembicara meminta maaf", "biaya atau harga menjadi pertimbangan", "jadwal bentrok", "salah satu merekomendasikan tempat atau orang",
  "sebuah aturan membatasi pilihan", "seseorang meminta bantuan", "kabar baik dengan syarat", "seseorang menyadari kesalahannya",
  "permintaan klarifikasi", "keluhan ringan tentang layanan", "persiapan acara", "memilih antara dua pilihan",
];

export function sample<T>(list: readonly T[], n: number, random = Math.random): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  // Daftar lebih pendek dari n: isi sisanya dengan pengulangan acak.
  while (out.length < n) out.push(list[Math.floor(random() * list.length)]);
  return out;
}

const forBand = (list: [string, Tier][], band: LevelBand) => list.filter(([, tier]) => TIERS[band].includes(tier)).map(([text]) => text);

/** Titik tata bahasa yang diuji (Structure) atau jenis kesalahan (Written), tanpa pengulangan dalam satu batch. */
export function pickPoints(kind: "structure" | "written", band: LevelBand, n: number, random = Math.random) {
  return sample(forBand(kind === "structure" ? STRUCTURE_POINTS : WRITTEN_ERRORS, band), n, random);
}

export const pickModifier = (random = Math.random) => CONTEXT_MODIFIERS[Math.floor(random() * CONTEXT_MODIFIERS.length)];
export const pickRegister = (random = Math.random) => READING_REGISTERS[Math.floor(random() * READING_REGISTERS.length)];
export const pickHooks = (n: number, random = Math.random) => sample(SCENE_HOOKS, n, random);

/** Ukuran ruang kombinasi (untuk laporan dan tes). */
export function comboSpace(topics: number) {
  return {
    structure: topics * CONTEXT_MODIFIERS.length * forBand(STRUCTURE_POINTS, "mid").length,
    written: topics * CONTEXT_MODIFIERS.length * forBand(WRITTEN_ERRORS, "mid").length,
    reading: topics * CONTEXT_MODIFIERS.length * READING_REGISTERS.length * 8,
  };
}
