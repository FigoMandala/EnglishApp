import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { grammarLessons, vocabulary } from "@/db/schema";

import { listGrammarLessons } from "./grammar";

/**
 * Cache konten yang jarang berubah (kosakata & materi grammar).
 * Diberi tag supaya bisa di-invalidate saat admin mengubah konten
 * via `revalidateTag("vocab")` / `revalidateTag("lessons")`.
 */

export const cachedVocabulary = unstable_cache(
  async () => db.select().from(vocabulary).orderBy(asc(vocabulary.word)),
  ["vocabulary-all"],
  { revalidate: 3600, tags: ["vocab"] },
);

export const cachedGrammarLessonBySlug = unstable_cache(
  async (slug: string) => {
    const [row] = await db
      .select()
      .from(grammarLessons)
      .where(eq(grammarLessons.slug, slug))
      .limit(1);
    return row ?? null;
  },
  ["grammar-lesson-slug"],
  { revalidate: 3600, tags: ["lessons"] },
);

/** Daftar materi per user tetap dipanggil langsung (bergantung progres user). */
export { listGrammarLessons };