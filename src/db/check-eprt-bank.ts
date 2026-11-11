import { writeFileSync } from "node:fs";

import { eq } from "drizzle-orm";

import "./load-env";

import { db } from "@/db";
import { questionBank } from "@/db/schema";
import { chatJsonRaw, type ProviderMessage } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { parseAiJson } from "@/lib/api/toefl-turn";
import { dialogueKey, type ToeflQuestion } from "@/lib/toefl";

/**
 * Pemeriksa bank soal EPrT oleh model KEDUA (bukan pembuatnya): menjawab tiap soal tanpa kunci
 * dan menilai mutunya. Bawaan hanya melapor (dry-run); APPLY=1 menghapus item yang bermasalah.
 *
 *   CHECK_MODEL=gpt-6-luna   model pemeriksa (wajib)
 *   KINDS=structure,written  batasi jenis
 *   LIMIT=40                 batasi jumlah item (uji coba)
 *   CONCURRENCY=3            panggilan paralel
 *   NEWEST=1                 periksa item terbaru dulu (dipakai bersama LIMIT)
 *   APPLY=1                  hapus item yang bermasalah dari question_bank
 *   REPORT=path.json         lokasi laporan
 */
const MODEL = process.env.CHECK_MODEL;
const KINDS = (process.env.KINDS?.split(",") ?? ["structure", "written", "reading", "listen-short", "listen-long", "listen-lecture"]).map((s) => s.trim());
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const APPLY = process.env.APPLY === "1";
/** NEWEST=1: periksa item terbaru dulu (audit hasil generate terakhir) alih-alih yang tertua. */
const NEWEST = process.env.NEWEST === "1";
const REPORT = process.env.REPORT ?? "data/eprt-check-report.json";
const BATCH = 10;

const SYSTEM = `Kamu penguji soal EPrT/TOEFL ITP yang teliti. Untuk tiap soal: (1) jawab sendiri TANPA tahu kunci, (2) nilai mutu soal.
Balas HANYA JSON: {"results":[{"n":1,"answer":"A|B|C|D|NONE","issue":"none|ambiguous|no_correct|bad_sentence","note":"alasan singkat jika issue bukan none"}]}.
issue: ambiguous = lebih dari satu opsi bisa dibenarkan; no_correct = tidak ada opsi yang benar; bad_sentence = kalimat atau teks janggal/salah di luar bagian yang ditanyakan; none = soal baik.
Soal listening didahului [Naskah] (percakapan atau monolog); jawab HANYA berdasarkan naskah. Soal tanpa naskah baru memakai naskah terakhir di atasnya. issue bad_sentence juga dipakai bila naskahnya tidak natural atau tidak mendukung satu jawaban pun.
Soal "written" (error recognition): tiap soal adalah kalimat dengan 4 bagian bergaris bawah (A-D). Jawabanmu adalah bagian yang SALAH tata bahasanya. Kalau kalimat itu sebenarnya benar semua, jawab NONE dan issue no_correct. Hanya SATU bagian yang boleh salah.`;

type Row = { id: number; kind: string; level: string; passage: string | null; questions: ToeflQuestion[] };
type Res = { n: unknown; answer: unknown; issue?: unknown; note?: unknown }[];
type Flag = { id: number; kind: string; level: string; idx: number; fatal: boolean; q: string; key: string; got: string; issue: string; note: string };

const fmt = (q: ToeflQuestion, i: number) =>
  `${i + 1}. ${q.q}\n${q.options.map((option, j) => `   ${"ABCD"[j]}. ${option}`).join("\n")}`;

async function main() {
  if (!MODEL) {
    console.error("Isi CHECK_MODEL (model pemeriksa).");
    process.exit(1);
  }
  const config = { ...(await getAiConfig()), model: MODEL };
  if (!aiConfigured(config)) {
    console.error("AI_API_KEY belum diisi.");
    process.exit(1);
  }

  const rows: Row[] = (await db.select().from(questionBank).where(eq(questionBank.track, "eptr")))
    .filter((row) => KINDS.includes(row.kind))
    .sort((a, b) => (NEWEST ? b.id - a.id : 0))
    .slice(0, LIMIT)
    .map((row) => {
      const item = JSON.parse(row.item) as { passage: string | null; questions: ToeflQuestion[] };
      return { id: row.id, kind: row.kind, level: row.levelBand, passage: item.passage, questions: item.questions };
    });

  // Structure/written digabung per 10 soal, reading satu teks per panggilan.
  const jobs: { rows: Row[]; passage: string | null; questions: { row: Row; q: ToeflQuestion }[] }[] = [];
  for (const kind of ["structure", "written"]) {
    const list = rows.filter((row) => row.kind === kind);
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      jobs.push({ rows: chunk, passage: null, questions: chunk.map((row) => ({ row, q: row.questions[0] })) });
    }
  }
  for (const row of rows.filter((r) => r.kind === "reading")) {
    jobs.push({ rows: [row], passage: row.passage, questions: row.questions.map((q) => ({ row, q })) });
  }
  const shorts = rows.filter((row) => row.kind === "listen-short");
  for (let i = 0; i < shorts.length; i += BATCH) {
    const chunk = shorts.slice(i, i + BATCH);
    jobs.push({ rows: chunk, passage: null, questions: chunk.map((row) => ({ row, q: row.questions[0] })) });
  }
  for (const row of rows.filter((r) => r.kind === "listen-long" || r.kind === "listen-lecture")) {
    jobs.push({ rows: [row], passage: null, questions: row.questions.map((q) => ({ row, q })) });
  }
  console.log(`Pemeriksa: ${MODEL}; item ${rows.length}; panggilan ${jobs.length}; ${APPLY ? "MENGHAPUS yang bermasalah" : "dry-run (tidak menghapus)"}.`);

  const flags: Flag[] = [];
  const checked = new Set<number>();
  let judged = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      let lastScript = "";
      const parts = job.questions.map(({ q }, i) => {
        const script = q.audio?.length ? dialogueKey(q) : "";
        const header = script && script !== lastScript ? `[Naskah]\n${script}\n\n` : "";
        if (script) lastScript = script;
        return header + fmt(q, i);
      });
      const body = `${job.passage ? `Teks:\n${job.passage}\n\n` : ""}${parts.join("\n\n")}`;
      const messages: ProviderMessage[] = [
        { role: "system", content: SYSTEM },
        { role: "user", content: body },
      ];
      let results: Res | null = null;
      for (let attempt = 0; attempt < 3 && !results; attempt += 1) {
        try {
          const response = await chatJsonRaw(config, messages, 180_000);
          const parsed = parseAiJson(response.content) as { results?: Res };
          if (Array.isArray(parsed.results) && parsed.results.length) results = parsed.results;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 4_000));
        }
      }
      if (!results) {
        failed += 1;
        console.error(`! gagal memeriksa ${job.rows[0].kind} (id ${job.rows[0].id})`);
        continue;
      }
      job.questions.forEach(({ row, q }, i) => {
        const idx = row.questions.indexOf(q);
        const result = results!.find((entry) => Number(entry.n) === i + 1);
        if (!result) return;
        judged += 1;
        checked.add(row.id);
        const key = "ABCD"[q.answer];
        const got = String(result.answer ?? "").trim().toUpperCase().slice(0, 4);
        const issue = String(result.issue ?? "none");
        if (got.startsWith(key) && issue === "none") return;
        // bad_sentence di Reading (comma splice dsb.) hanya dilaporkan: kuncinya tetap benar.
        const fatal = !got.startsWith(key) || issue === "no_correct" || issue === "ambiguous" || (issue === "bad_sentence" && row.kind !== "reading");
        flags.push({ id: row.id, kind: row.kind, level: row.level, idx, fatal, q: q.q, key, got, issue, note: String(result.note ?? "").slice(0, 200) });
      });
      console.log(`  ${next}/${jobs.length} panggilan; ${judged} soal dinilai; ${flags.length} ditandai`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const fatal = flags.filter((flag) => flag.fatal);
  const badIds = [...new Set(fatal.map((flag) => flag.id))];
  writeFileSync(REPORT, JSON.stringify({ model: MODEL, judged, failed, flagged: flags }, null, 1));
  const by = (key: (flag: Flag) => string) => {
    const total: Record<string, number> = {};
    for (const flag of flags) total[key(flag)] = (total[key(flag)] ?? 0) + 1;
    return total;
  };
  console.log(`\nSelesai. Soal dinilai ${judged}; panggilan gagal ${failed}; ditandai ${flags.length} soal; fatal ${fatal.length} soal (${badIds.length} item).`);
  console.log("Per jenis:", JSON.stringify(by((f) => f.kind)), "| per level:", JSON.stringify(by((f) => f.level)), "| per masalah:", JSON.stringify(by((f) => f.issue)));
  console.log(`Laporan: ${REPORT}`);

  if (APPLY && badIds.length) {
    let removedItems = 0;
    let trimmed = 0;
    for (const id of badIds) {
      const row = rows.find((r) => r.id === id)!;
      const bad = new Set(fatal.filter((flag) => flag.id === id).map((flag) => flag.idx));
      // Item multi-soal dipangkas soalnya bila sisanya masih cukup (Reading >= 10, naskah Listening >= 3); selain itu dihapus utuh.
      const minLeft = row.kind === "reading" ? 10 : row.kind === "listen-long" || row.kind === "listen-lecture" ? 3 : null;
      if (minLeft !== null) {
        const left = row.questions.filter((_, i) => !bad.has(i));
        if (left.length >= minLeft) {
          await db
            .update(questionBank)
            .set({ item: JSON.stringify({ passage: row.passage, questions: left }), questionCount: left.length })
            .where(eq(questionBank.id, id));
          trimmed += 1;
          continue;
        }
      }
      await db.delete(questionBank).where(eq(questionBank.id, id));
      removedItems += 1;
    }
    console.log(`Dihapus ${removedItems} item; ${trimmed} item multi-soal dipangkas soalnya.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
