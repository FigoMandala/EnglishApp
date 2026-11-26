/**
 * Ruang variasi untuk pembuat soal TOEFL ITP. Topik (800) saja habis terpakai ratusan kali pada ratusan ribu
 * soal; di sini tiap soal mendapat kombinasi konteks x pengubah x titik yang diuji (x bentuk teks /
 * pemicu skenario), sehingga ruang kombinasinya jutaan dan soal tidak berulang pola.
 */
import type { LevelBand } from "@/db/queries/question-bank";
import type { SkillKey } from "@/lib/toefl";

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

/** Pola per topik untuk Latihan Structure satu topik, supaya 10 soal tidak memakai satu pola. Mengikuti larangan prompt kualitas. */
const SKILL_POINTS: Partial<Record<SkillKey, string[]>> = {
  sv: ["subjek yang hilang", "verb utama yang hilang", "subjek panjang yang disela frasa preposisi lalu butuh verb utama", "appositive yang menyela subjek dan verb", "there/it sebagai subjek semu", "klausa nomina sebagai subjek lalu butuh verb utama", "klausa relatif pada subjek lalu butuh verb utama", "subjek dan verb setelah frasa pembuka yang panjang", "verb kedua dalam kalimat majemuk setelah konjungsi koordinatif"],
  agreement: ["subjek disela frasa preposisi berisi nomina berbeda jumlah", "each/every + nomina", "one of the + nomina jamak", "gerund sebagai subjek", "either...or / neither...nor mengikuti subjek terdekat", "verb pada klausa relatif mengikuti anteseden", "urutan terbalik setelah there atau frasa tempat", "klausa nomina sebagai subjek", "along with / as well as tidak mengubah jumlah subjek"],
  tense: ["present perfect dengan since/for", "past perfect dengan by the time", "future perfect dengan by + waktu mendatang", "simple past dengan penanda waktu lampau", "past continuous yang disela simple past", "present tense pada klausa waktu bermakna mendatang", "bentuk verb setelah modal", "modal perfect", "bentuk verb setelah have atau be"],
  passive: ["pasif simple past", "pasif present perfect", "pasif setelah modal", "pasif progressive", "pasif dengan reporting verb (is said to have)", "perfect passive infinitive", "get/have + objek + V3", "verb intransitif yang tidak boleh dipasifkan", "pasif dengan verb berobjek ganda"],
  clause: ["noun clause dengan what", "noun clause dengan whether atau that", "klausa relatif who/which/whose", "preposisi + relative pronoun", "klausa kontras although/whereas", "klausa sebab because/since", "klausa waktu atau syarat (once, unless)", "so...that / such...that", "konektor klausa vs preposisi (because vs because of)"],
  reduced: ["appositive berupa frasa nomina", "participle V3 pengganti klausa relatif pasif", "participle V-ing pengganti klausa relatif aktif", "while/when + V-ing dengan subjek yang cocok", "having + V3 di awal kalimat", "once/if/unless + V3", "frasa pembuka V3 yang menerangkan subjek", "adjective phrase pengganti klausa relatif"],
  inversion: ["adverbia negatif di awal (rarely, seldom, never)", "hardly/scarcely ... when", "no sooner ... than", "only after / only when di awal", "not until di awal", "not only di awal", "conditional tanpa if (had, were, should)", "so + adjektiva di awal diikuti that", "frasa tempat di awal diikuti verb lalu subjek"],
  parallel: ["daftar tiga nomina", "daftar tiga gerund", "deret infinitive", "both ... and", "either ... or / neither ... nor", "not only ... but also", "dua klausa sejajar", "perbandingan yang menuntut bentuk sejajar setelah than", "rather than dengan bentuk sejajar"],
  comparison: ["comparative + than", "as ... as", "superlative dengan the + lingkup", "pola the + comparative, the + comparative", "kelipatan (twice as ... as)", "that of / those of dalam perbandingan", "penguat comparative (far, much)", "fewer vs less", "unlike / like pada perbandingan dua nomina"],
  "noun-pronoun": ["nomina tak terhitung", "bentuk jamak tak beraturan", "pronomina cocok jumlah dengan rujukan", "kasus pronomina subjek/objek/kepemilikan", "its vs their", "pronomina reflexive", "those who / that of", "quantifier many/much sesuai nomina", "another/other/others"],
  "word-form": ["adverbia penerang verb", "adverbia penerang adjektiva", "adjektiva setelah linking verb", "nomina setelah determiner", "nomina pelaku vs nomina bidang", "participial adjective -ing vs -ed", "verb vs nomina seakar", "adjektiva sebelum nomina", "nomina setelah preposisi"],
  "article-prep": ["a vs an menurut bunyi", "the untuk rujukan spesifik atau superlatif", "tanpa artikel pada nomina umum", "preposisi waktu in/on/at", "preposisi tempat", "adjektiva + preposisi", "verb + preposisi", "nomina + preposisi (increase in, demand for)", "despite / during / by / until"],
};

/** Pola yang diuji untuk n soal satu topik, merata tanpa pengulangan selama daftarnya cukup. */
export function pickSkillPoints(skill: SkillKey, n: number, random = Math.random) {
  const list = SKILL_POINTS[skill];
  if (!list) throw new Error(`topik tanpa pola: ${skill}`);
  return sample(list, n, random);
}

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

/**
 * Posisi bagian bergaris bawah yang SALAH (0=A .. 3=D) untuk n soal Written, dari himpunan yang diizinkan.
 * Siklus teracak supaya kunci tersebar rata; kalau dibiarkan ke model, kunci menumpuk di C (43-46%).
 */
export function pickKeyPositions(n: number, allowed: readonly number[] = [0, 1, 2, 3], random = Math.random): number[] {
  const out: number[] = [];
  while (out.length < n) out.push(...sample(allowed, allowed.length, random));
  return out.slice(0, n);
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
