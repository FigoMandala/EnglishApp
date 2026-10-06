import { count, eq } from "drizzle-orm";

import "./load-env";

import { db } from "./index";
import { BEGINNER_EXERCISES, BEGINNER_LESSONS } from "./seed-beginner";
import { LEARNING_PATH } from "./seed-path";
import {
  grammarExercises,
  grammarLessons,
  learningUnitItems,
  learningUnits,
  vocabulary,
  type NewGrammarLesson,
} from "./schema";

type VocabularySeed = {
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleEn?: string;
  exampleId?: string;
  level?: "basic" | "intermediate" | "advanced";
  topic?: string;
};

const VOCABULARY: VocabularySeed[] = [
  { word: "abundant", meaning: "berlimpah", phonetic: "/əˈbʌn.dənt/", partOfSpeech: "adjective", exampleEn: "The region has abundant rainfall.", exampleId: "Daerah itu punya curah hujan berlimpah.", level: "intermediate", topic: "Akademik" },
  { word: "accumulate", meaning: "mengumpulkan, menumpuk", phonetic: "/əˈkjuː.mjə.leɪt/", partOfSpeech: "verb", exampleEn: "Dust accumulated on the shelves.", exampleId: "Debu menumpuk di rak.", level: "intermediate", topic: "Akademik" },
  { word: "adequate", meaning: "memadai, cukup", phonetic: "/ˈæd.ə.kwət/", partOfSpeech: "adjective", exampleEn: "The supply is adequate for a week.", exampleId: "Persediaannya cukup untuk seminggu.", level: "basic", topic: "Akademik" },
  { word: "adjacent", meaning: "berdampingan", phonetic: "/əˈdʒeɪ.sənt/", partOfSpeech: "adjective", exampleEn: "Our office is adjacent to the library.", exampleId: "Kantor kami berdampingan dengan perpustakaan.", level: "intermediate", topic: "Tempat" },
  { word: "advocate", meaning: "mendukung; pendukung", phonetic: "/ˈæd.və.keɪt/", partOfSpeech: "verb", exampleEn: "She advocates for cleaner energy.", exampleId: "Dia mendukung energi yang lebih bersih.", level: "advanced", topic: "Akademik" },
  { word: "ambiguous", meaning: "ambigu, bermakna ganda", phonetic: "/æmˈbɪɡ.ju.əs/", partOfSpeech: "adjective", exampleEn: "His answer was ambiguous.", exampleId: "Jawabannya ambigu.", level: "advanced", topic: "Akademik" },
  { word: "anticipate", meaning: "mengantisipasi", phonetic: "/ænˈtɪs.ɪ.peɪt/", partOfSpeech: "verb", exampleEn: "We anticipate a busy season.", exampleId: "Kami mengantisipasi musim sibuk.", level: "intermediate", topic: "Akademik" },
  { word: "arbitrary", meaning: "sewenang-wenang, sembarang", phonetic: "/ˈɑː.bɪ.trər.i/", partOfSpeech: "adjective", exampleEn: "The rule felt arbitrary.", exampleId: "Aturan itu terasa sembarangan.", level: "advanced", topic: "Akademik" },
  { word: "assemble", meaning: "merakit, berkumpul", phonetic: "/əˈsem.bəl/", partOfSpeech: "verb", exampleEn: "Students assembled in the hall.", exampleId: "Para siswa berkumpul di aula.", level: "basic", topic: "Akademik" },
  { word: "attribute", meaning: "mengaitkan; atribut", phonetic: "/əˈtrɪb.juːt/", partOfSpeech: "verb", exampleEn: "They attribute the rise to better tools.", exampleId: "Mereka mengaitkan kenaikan itu dengan alat yang lebih baik.", level: "advanced", topic: "Akademik" },
  { word: "coherent", meaning: "koheren, runtut", phonetic: "/kəʊˈhɪə.rənt/", partOfSpeech: "adjective", exampleEn: "Write a coherent paragraph.", exampleId: "Tulis paragraf yang runtut.", level: "intermediate", topic: "Menulis" },
  { word: "compel", meaning: "memaksa", phonetic: "/kəmˈpel/", partOfSpeech: "verb", exampleEn: "The evidence compelled a retrial.", exampleId: "Bukti itu memaksa sidang ulang.", level: "intermediate", topic: "Akademik" },
  { word: "comprehensive", meaning: "menyeluruh", phonetic: "/ˌkɒm.prɪˈhen.sɪv/", partOfSpeech: "adjective", exampleEn: "She gave a comprehensive report.", exampleId: "Dia memberi laporan menyeluruh.", level: "intermediate", topic: "Akademik" },
  { word: "consecutive", meaning: "berurutan", phonetic: "/kənˈsek.jə.tɪv/", partOfSpeech: "adjective", exampleEn: "It rained for five consecutive days.", exampleId: "Hujan turun lima hari berurutan.", level: "intermediate", topic: "Waktu" },
  { word: "constrain", meaning: "membatasi", phonetic: "/kənˈstreɪn/", partOfSpeech: "verb", exampleEn: "Budget limits constrain the plan.", exampleId: "Anggaran membatasi rencana itu.", level: "advanced", topic: "Akademik" },
  { word: "contradict", meaning: "bertentangan dengan", phonetic: "/ˌkɒn.trəˈdɪkt/", partOfSpeech: "verb", exampleEn: "The data contradict the claim.", exampleId: "Data itu bertentangan dengan klaim tersebut.", level: "intermediate", topic: "Akademik" },
  { word: "crucial", meaning: "krusial, sangat penting", phonetic: "/ˈkruː.ʃəl/", partOfSpeech: "adjective", exampleEn: "Timing is crucial here.", exampleId: "Waktu sangat penting di sini.", level: "basic", topic: "Akademik" },
  { word: "diminish", meaning: "berkurang", phonetic: "/dɪˈmɪn.ɪʃ/", partOfSpeech: "verb", exampleEn: "His interest diminished over time.", exampleId: "Minatnya berkurang seiring waktu.", level: "intermediate", topic: "Akademik" },
  { word: "distinct", meaning: "berbeda, jelas", phonetic: "/dɪˈstɪŋkt/", partOfSpeech: "adjective", exampleEn: "There are two distinct patterns.", exampleId: "Ada dua pola yang berbeda.", level: "basic", topic: "Akademik" },
  { word: "elaborate", meaning: "menjelaskan rinci; rumit", phonetic: "/ɪˈlæb.ər.ət/", partOfSpeech: "verb", exampleEn: "Could you elaborate on that point?", exampleId: "Bisa jelaskan lebih rinci poin itu?", level: "intermediate", topic: "Akademik" },
  { word: "emerge", meaning: "muncul", phonetic: "/ɪˈmɜːdʒ/", partOfSpeech: "verb", exampleEn: "A clear pattern emerged.", exampleId: "Sebuah pola yang jelas muncul.", level: "basic", topic: "Akademik" },
  { word: "emphasis", meaning: "penekanan", phonetic: "/ˈem.fə.sɪs/", partOfSpeech: "noun", exampleEn: "The course puts emphasis on speaking.", exampleId: "Kursus itu menekankan kemampuan berbicara.", level: "basic", topic: "Akademik" },
  { word: "endure", meaning: "bertahan, menahan", phonetic: "/ɪnˈdjʊə/", partOfSpeech: "verb", exampleEn: "The structure endured the storm.", exampleId: "Struktur itu bertahan dari badai.", level: "intermediate", topic: "Akademik" },
  { word: "enhance", meaning: "meningkatkan", phonetic: "/ɪnˈhɑːns/", partOfSpeech: "verb", exampleEn: "Good lighting enhances the room.", exampleId: "Pencahayaan bagus meningkatkan ruangan itu.", level: "intermediate", topic: "Akademik" },
  { word: "explicit", meaning: "eksplisit, tersurat", phonetic: "/ɪkˈsplɪs.ɪt/", partOfSpeech: "adjective", exampleEn: "The instructions were explicit.", exampleId: "Instruksinya tersurat jelas.", level: "advanced", topic: "Akademik" },
  { word: "facilitate", meaning: "mempermudah", phonetic: "/fəˈsɪl.ɪ.teɪt/", partOfSpeech: "verb", exampleEn: "The tool facilitates collaboration.", exampleId: "Alat itu mempermudah kolaborasi.", level: "intermediate", topic: "Akademik" },
  { word: "fundamental", meaning: "mendasar", phonetic: "/ˌfʌn.dəˈmen.təl/", partOfSpeech: "adjective", exampleEn: "This is a fundamental principle.", exampleId: "Ini prinsip yang mendasar.", level: "basic", topic: "Akademik" },
  { word: "hypothesis", meaning: "hipotesis", phonetic: "/haɪˈpɒθ.ə.sɪs/", partOfSpeech: "noun", exampleEn: "The hypothesis was supported.", exampleId: "Hipotesis itu didukung.", level: "intermediate", topic: "Penelitian" },
  { word: "imply", meaning: "menyiratkan", phonetic: "/ɪmˈplaɪ/", partOfSpeech: "verb", exampleEn: "The author implies a warning.", exampleId: "Penulis menyiratkan sebuah peringatan.", level: "intermediate", topic: "Membaca" },
  { word: "inherent", meaning: "melekat, bawaan", phonetic: "/ɪnˈhɪə.rənt/", partOfSpeech: "adjective", exampleEn: "Risk is inherent in the work.", exampleId: "Risiko melekat pada pekerjaan itu.", level: "advanced", topic: "Akademik" },
  { word: "intricate", meaning: "rumit", phonetic: "/ˈɪn.trɪ.kət/", partOfSpeech: "adjective", exampleEn: "The watch has an intricate design.", exampleId: "Jam itu punya desain rumit.", level: "advanced", topic: "Akademik" },
  { word: "notion", meaning: "gagasan", phonetic: "/ˈnəʊ.ʃən/", partOfSpeech: "noun", exampleEn: "She rejected that notion.", exampleId: "Dia menolak gagasan itu.", level: "intermediate", topic: "Akademik" },
  { word: "obsolete", meaning: "usang", phonetic: "/ˈɒb.sə.liːt/", partOfSpeech: "adjective", exampleEn: "The format is now obsolete.", exampleId: "Format itu kini usang.", level: "intermediate", topic: "Akademik" },
  { word: "persist", meaning: "bertahan, berlanjut", phonetic: "/pəˈsɪst/", partOfSpeech: "verb", exampleEn: "The problem persists.", exampleId: "Masalah itu berlanjut.", level: "basic", topic: "Akademik" },
  { word: "prevalent", meaning: "umum, lazim", phonetic: "/ˈprev.əl.ənt/", partOfSpeech: "adjective", exampleEn: "The practice is prevalent in cities.", exampleId: "Praktik itu lazim di kota.", level: "advanced", topic: "Akademik" },
  { word: "reinforce", meaning: "memperkuat", phonetic: "/ˌriː.ɪnˈfɔːs/", partOfSpeech: "verb", exampleEn: "Repetition reinforces memory.", exampleId: "Pengulangan memperkuat ingatan.", level: "intermediate", topic: "Akademik" },
  { word: "reluctant", meaning: "enggan", phonetic: "/rɪˈlʌk.tənt/", partOfSpeech: "adjective", exampleEn: "He was reluctant to change.", exampleId: "Dia enggan berubah.", level: "intermediate", topic: "Akademik" },
  { word: "subsequent", meaning: "berikutnya", phonetic: "/ˈsʌb.sɪ.kwənt/", partOfSpeech: "adjective", exampleEn: "Subsequent tests confirmed it.", exampleId: "Tes berikutnya mengonfirmasinya.", level: "advanced", topic: "Akademik" },
  { word: "summarize", meaning: "meringkas", phonetic: "/ˈsʌm.ə.raɪz/", partOfSpeech: "verb", exampleEn: "Summarize the passage in three lines.", exampleId: "Ringkas bacaan itu dalam tiga baris.", level: "basic", topic: "Membaca" },
  { word: "vital", meaning: "sangat penting", phonetic: "/ˈvaɪ.təl/", partOfSpeech: "adjective", exampleEn: "Water is vital for life.", exampleId: "Air sangat penting bagi kehidupan.", level: "basic", topic: "Akademik" },
];

const LESSONS: NewGrammarLesson[] = [
  {
    slug: "subject-verb-agreement",
    title: "Subject-Verb Agreement",
    level: "basic",
    summary: "Verb harus cocok dengan subjeknya, tunggal atau jamak.",
    orderIndex: 1,
    body: [
      "## Aturan dasar",
      "Verb harus cocok dengan **subjek**, bukan dengan kata di dekatnya.",
      "",
      "- Subjek tunggal memakai verb tunggal: The report **is** ready.",
      "- Subjek jamak memakai verb jamak: The reports **are** ready.",
      "",
      "## Jebakan umum di TOEFL",
      "Frasa di antara subjek dan verb tidak mengubah persetujuan.",
      "",
      "- The **number** of students *is* rising.",
      "- A **number** of students *are* waiting.",
      "",
      "## Latihan",
      "1. The children in the park ___ playing. (is/are)",
      "2. Each of the answers ___ correct. (is/are)",
      "",
      "Kunci: 1) are, 2) is.",
    ].join("\n"),
  },
  {
    slug: "tenses",
    title: "Tenses dan Bentuk Verb",
    level: "basic",
    summary: "Kapan memakai present, past, dan present perfect.",
    orderIndex: 2,
    body: [
      "## Tiga tenses yang paling sering muncul",
      "1. **Simple present** untuk fakta dan kebiasaan.",
      "2. **Simple past** untuk kejadian yang selesai.",
      "3. **Present perfect** untuk kejadian yang masih berdampak.",
      "",
      "## Tanda waktu",
      "- now, every day, usually, generally",
      "- yesterday, last week, in 1990",
      "- since, for, already, yet, so far",
      "",
      "## Contoh",
      "- The water **freezes** at zero degrees.",
      "- The author **published** the paper in 2019.",
      "- Researchers **have shown** this for decades.",
    ].join("\n"),
  },
  {
    slug: "passive-voice",
    title: "Passive Voice",
    level: "intermediate",
    summary: "Be + V3, dan kapan lebih tepat daripada aktif.",
    orderIndex: 3,
    body: [
      "## Bentuk",
      "Passive = **be + past participle (V3)**.",
      "",
      "- Present: The samples **are analyzed** daily.",
      "- Past: The bridge **was built** in 1930.",
      "- Perfect: The rule **has been applied** widely.",
      "",
      "## Kapan dipakai",
      "Passive tepat saat pelaku tidak penting atau tidak diketahui.",
      "",
      "## Jebakan",
      "Jangan pakai + ing setelah be kecuali pengertiannya continuous.",
      "- Salah: The data is *analyze* every day.",
      "- Benar: The data is **analyzed** every day.",
    ].join("\n"),
  },
  {
    slug: "clauses",
    title: "Klausa dan Konektor",
    level: "intermediate",
    summary: "Noun, adjective, dan adverb clause beserta penghubungnya.",
    orderIndex: 4,
    body: [
      "## Jenis klausa",
      "- **Noun clause**: what she said surprised me.",
      "- **Adjective clause**: the book **that I bought** is heavy.",
      "- **Adverb clause**: **although** it rained, we went out.",
      "",
      "## Penghubung penting",
      "- Sebab: because, since, as",
      "- Kontras: although, though, even though, whereas, while",
      "- Waktu: when, while, before, after, until",
      "",
      "## Aturan",
      "Adverb clause di depan dipisah koma; di belakang tidak.",
      "- Although it rained, we went out.",
      "- We went out although it rained.",
    ].join("\n"),
  },
  {
    slug: "reduced-clauses",
    title: "Reduced Clause dan Participle",
    level: "advanced",
    summary: "Meringkas klausa dengan V-ing atau V3.",
    orderIndex: 5,
    body: [
      "## Aturan",
      "Klausa bisa diringkas bila subjeknya sama dengan klausa utama.",
      "",
      "- The man **who is standing** there is my uncle.",
      "- The man **standing** there is my uncle.",
      "",
      "## Aktif vs pasif",
      "- Aktif diringkas dengan V-ing: **Walking** home, she saw a friend.",
      "- Pasif diringkas dengan V3: **Written** in 1900, the book still sells.",
      "",
      "## Jebakan",
      "Jangan sampai subjeknya berbeda, itu jadi dangling modifier.",
    ].join("\n"),
  },
  {
    slug: "parallel-structure",
    title: "Parallel Structure",
    level: "intermediate",
    summary: "Bentuk sejajar setelah and, or, but, dan both...and.",
    orderIndex: 6,
    body: [
      "## Aturan",
      "Item dalam daftar harus berbentuk sama.",
      "",
      "- Salah: She likes reading, writing, and **to paint**.",
      "- Benar: She likes reading, writing, and **painting**.",
      "",
      "## Pola pasangan",
      "- both A **and** B",
      "- not only A **but also** B",
      "- either A **or** B",
      "- neither A **nor** B",
      "",
      "## Latihan",
      "The job requires patience, accuracy, and ___. (attention / to attend)",
      "Kunci: attention.",
    ].join("\n"),
  },
  {
    slug: "articles-prepositions",
    title: "Article dan Preposisi",
    level: "advanced",
    summary: "a, an, the, dan preposisi yang sering salah.",
    orderIndex: 7,
    body: [
      "## Article",
      "- **a/an** untuk benda tunggal yang belum tentu diketahui.",
      "- **the** untuk benda yang sudah jelas atau unik.",
      "- Tanpa article untuk benda tak terhitung yang umum.",
      "",
      "## Contoh",
      "- I saw **a** bird. **The** bird was blue.",
      "- **Water** boils at 100 degrees.",
      "",
      "## Preposisi yang sering diuji",
      "- depend **on**, interested **in**, similar **to**, different **from**",
      "- capable **of**, responsible **for**, aware **of**",
    ].join("\n"),
  },
];

async function main() {
  const [existingVocab] = await db.select({ n: count() }).from(vocabulary);
  if (Number(existingVocab?.n ?? 0) === 0) {
    await db.insert(vocabulary).values(
      VOCABULARY.map((item) => ({ ...item, wordLower: item.word.toLowerCase() })),
    );
    console.log(`Kosakata: ${VOCABULARY.length} kata ditambahkan.`);
  } else {
    console.log(`Kosakata: sudah ada ${existingVocab.n} kata, dilewati.`);
  }

  const [existingLessons] = await db.select({ n: count() }).from(grammarLessons);
  if (Number(existingLessons?.n ?? 0) === 0) {
    await db.insert(grammarLessons).values(LESSONS);
    console.log(`Materi: ${LESSONS.length} pelajaran ditambahkan.`);
  } else {
    console.log(`Materi: sudah ada ${existingLessons.n} pelajaran, dilewati.`);
  }

  await seedBeginner();
  await seedLearningPath();

  console.log("Seed selesai.");
}

/** Jalur belajar: unit + isinya. Aman diulang, hanya menambah yang belum ada. */
async function seedLearningPath() {
  const [existing] = await db.select({ n: count() }).from(learningUnits);
  if (Number(existing?.n ?? 0) > 0) {
    console.log(`Jalur belajar: sudah ada ${existing.n} unit, dilewati.`);
    return;
  }

  let order = 0;
  for (const unit of LEARNING_PATH) {
    order += 1;
    const [row] = await db
      .insert(learningUnits)
      .values({
        slug: unit.slug,
        title: unit.title,
        description: unit.description,
        level: unit.level,
        orderIndex: order,
      })
      .returning();
    if (!row) continue;

    const items = unit.items.map((item) => ({ ...item, unitId: row.id }));
    if (items.length) await db.insert(learningUnitItems).values(items);
  }

  console.log(`Jalur belajar: ${LEARNING_PATH.length} unit ditambahkan.`);
}

/** Materi & soal pemula: aman diulang, hanya menambah yang belum ada. */
async function seedBeginner() {
  let lessonsAdded = 0;
  for (const lesson of BEGINNER_LESSONS) {
    const [existing] = await db
      .select({ id: grammarLessons.id })
      .from(grammarLessons)
      .where(eq(grammarLessons.slug, lesson.slug))
      .limit(1);
    if (existing) continue;

    const [row] = await db.insert(grammarLessons).values(lesson).returning();
    const exercises = BEGINNER_EXERCISES[lesson.slug] ?? [];
    if (exercises.length && row) {
      await db
        .insert(grammarExercises)
        .values(exercises.map((exercise) => ({ ...exercise, lessonId: row.id })));
    }
    lessonsAdded += 1;
  }
  if (lessonsAdded) console.log(`Materi pemula: ${lessonsAdded} pelajaran ditambahkan.`);
  else console.log("Materi pemula: sudah ada, dilewati.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
