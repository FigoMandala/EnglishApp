import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  grammarAttempts,
  grammarExercises,
  grammarLessons,
  toeflReviews,
  vocabulary,
  vocabularyProgress,
} from "@/db/schema";

/** Kata acak untuk mode latihan bebas. `withExample` hanya mengambil kata yang punya kalimat contoh. */
export async function randomVocabulary(count: number, options: { withExample?: boolean } = {}) {
  return db
    .select()
    .from(vocabulary)
    .where(
      and(
        // Buang nama diri, singkatan, dan kata terlalu pendek: tidak cocok untuk latihan.
        sql`length(${vocabulary.word}) > 3`,
        sql`${vocabulary.meaning} not like '%nama diri%'`,
        sql`${vocabulary.meaning} not like '%singkatan%'`,
        sql`${vocabulary.word} = ${vocabulary.wordLower}`,
        options.withExample ? isNotNull(vocabulary.exampleEn) : undefined,
        options.withExample ? sql`length(${vocabulary.exampleEn}) > 0` : undefined,
      ),
    )
    .orderBy(sql`random()`)
    .limit(Math.min(Math.max(count, 1), 60));
}

/* ═══ Bank Kesalahan: kelompok pola dari data nyata ═══ */
export type MistakeItem = { prompt: string; yours: string | null; key: string | null; note: string | null };
export type MistakeGroup = {
  key: string;
  kind: "grammar" | "vocab" | "eptr";
  title: string;
  tag: string;
  rule: string | null;
  /** Kesalahan yang belum ditebus. */
  open: number;
  /** Seluruh percobaan di kelompok ini, untuk menghitung persen dikuasai. */
  total: number;
  href: string;
  hrefLabel: string;
  items: MistakeItem[];
};

/**
 * Ringkasan Bank Kesalahan untuk shell: tiga aggregate SQL alih-alih memuat
 * seluruh riwayat percobaan user (yang dulu di-scan penuh di setiap navigasi).
 */
export async function mistakeSummary(userId: number) {
  const [attempts, lapsed, reviews] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        correct: sql<number>`coalesce(sum(case when ${grammarAttempts.correct} then 1 else 0 end), 0)`,
      })
      .from(grammarAttempts)
      .where(eq(grammarAttempts.userId, userId)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(vocabularyProgress)
      .where(
        and(
          eq(vocabularyProgress.userId, userId),
          sql`${vocabularyProgress.reviewCount} >= 1`,
          sql`${vocabularyProgress.box} = 0`,
        ),
      ),
    // Halaman penuh mengambil maks 30 baris ulangan EPrT; ikuti batas itu.
    db
      .select({ n: sql<number>`count(*)` })
      .from(toeflReviews)
      .where(eq(toeflReviews.userId, userId)),
  ]);
  const openGrammar = Number(attempts[0]?.total ?? 0) - Number(attempts[0]?.correct ?? 0);
  const openVocab = Number(lapsed[0]?.n ?? 0);
  const openEptr = Math.min(Number(reviews[0]?.n ?? 0), 30);
  return { openTotal: openGrammar + openVocab + openEptr };
}

export async function mistakeGroups(userId: number) {
  const groups: MistakeGroup[] = [];

  const attempts = await db
    .select({
      lessonId: grammarLessons.id,
      slug: grammarLessons.slug,
      title: grammarLessons.title,
      summary: grammarLessons.summary,
      prompt: grammarExercises.prompt,
      answers: grammarExercises.answers,
      explanation: grammarExercises.explanation,
      yours: grammarAttempts.answer,
      correct: grammarAttempts.correct,
    })
    .from(grammarAttempts)
    .innerJoin(grammarExercises, eq(grammarExercises.id, grammarAttempts.exerciseId))
    .innerJoin(grammarLessons, eq(grammarLessons.id, grammarExercises.lessonId))
    .where(eq(grammarAttempts.userId, userId));

  const byLesson = new Map<number, MistakeGroup>();
  let correctTotal = 0;
  for (const row of attempts) {
    if (row.correct) correctTotal += 1;
    let group = byLesson.get(row.lessonId);
    if (!group) {
      group = {
        key: `g-${row.lessonId}`,
        kind: "grammar",
        title: row.title,
        tag: "GRAMMAR",
        rule: row.summary,
        open: 0,
        total: 0,
        href: `/materi/${row.slug}`,
        hrefLabel: "BUKA MATERI",
        items: [],
      };
      byLesson.set(row.lessonId, group);
    }
    group.total += 1;
    if (!row.correct) {
      group.open += 1;
      let key: string | null = null;
      try {
        const parsed = JSON.parse(row.answers) as unknown;
        if (Array.isArray(parsed) && parsed[0]) key = String(parsed[0]);
      } catch {
        /* kunci tidak terbaca */
      }
      group.items.push({ prompt: row.prompt, yours: row.yours, key, note: row.explanation });
    }
  }
  groups.push(...[...byLesson.values()].filter((g) => g.open > 0).sort((a, b) => b.open - a.open));

  const vocab = await db
    .select({
      word: vocabulary.word,
      meaning: vocabulary.meaning,
      example: vocabulary.exampleEn,
      reviewCount: vocabularyProgress.reviewCount,
      correctCount: vocabularyProgress.correctCount,
      box: vocabularyProgress.box,
    })
    .from(vocabularyProgress)
    .innerJoin(vocabulary, eq(vocabulary.id, vocabularyProgress.vocabularyId))
    .where(and(eq(vocabularyProgress.userId, userId), sql`${vocabularyProgress.reviewCount} >= 1`));
  const lapsed = vocab.filter((v) => v.box === 0);
  if (lapsed.length > 0) {
    groups.push({
      key: "vocab",
      kind: "vocab",
      title: "Kosakata yang sering lupa",
      tag: "KOSAKATA",
      rule: "Kata di kotak awal setelah kamu lupa. Ulang pendek tapi sering, lalu kata ini naik kotak.",
      open: lapsed.length,
      total: vocab.length,
      href: "/kosakata/review",
      hrefLabel: "ULANG KARTU",
      items: lapsed.slice(0, 8).map((v) => ({ prompt: v.word, yours: null, key: v.meaning, note: v.example })),
    });
  }

  const reviews = await db
    .select({ question: toeflReviews.question, dueAt: toeflReviews.dueAt })
    .from(toeflReviews)
    .where(eq(toeflReviews.userId, userId))
    .orderBy(toeflReviews.dueAt)
    .limit(30);
  if (reviews.length > 0) {
    groups.push({
      key: "eptr",
      kind: "eptr",
      title: "Soal EPrT yang perlu diulang",
      tag: "EPrT",
      rule: "Soal tes yang kamu jawab salah masuk antrean ulang sesuai jadwal.",
      open: reviews.length,
      total: reviews.length,
      href: "/eptr",
      hrefLabel: "BUKA EPrT",
      items: reviews.slice(0, 8).map((r) => {
        let prompt = "Soal EPrT";
        try {
          const parsed = JSON.parse(r.question) as { q?: string };
          if (parsed.q) prompt = parsed.q.slice(0, 140);
        } catch {
          /* biarkan default */
        }
        return { prompt, yours: null, key: null, note: `jatuh tempo ${r.dueAt}` };
      }),
    });
  }

  const openTotal = groups.reduce((sum, g) => sum + g.open, 0);
  return { groups, openTotal, correctTotal };
}
