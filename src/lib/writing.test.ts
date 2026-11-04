import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ESSAY_MIN_WORDS,
  PARAGRAPH_MAX_WORDS,
  PARAGRAPH_MIN_WORDS,
  parseStoredScore,
  parseWritingScore,
  validateEssay,
  validateParagraph,
  wordCount,
} from "./writing";

describe("wordCount", () => {
  it("menghitung kata dan mengabaikan spasi berlebih", () => {
    assert.equal(wordCount("  one two   three "), 3);
    assert.equal(wordCount(""), 0);
    assert.equal(wordCount("   "), 0);
  });
});

describe("parseWritingScore", () => {
  const raw = JSON.stringify({
    aspects: [
      { aspect: "task", score: 80, note: "Ide utama jelas." },
      { aspect: "organization", score: 70, note: "Alur cukup runtut." },
      { aspect: "grammar", score: 60, note: "Ada beberapa tense salah." },
      { aspect: "vocabulary", score: 65, note: "Kosakata memadai." },
    ],
    strengths: ["Ada thesis statement"],
    improvements: ["Perbaiki tenses"],
    corrections: [{ original: "he go", correction: "he goes", reason: "subjek tunggal" }],
    summary: "Esai cukup baik namun perlu perbaikan grammar.",
  });

  it("membaca JSON valid dan menghitung total sebagai rata-rata", () => {
    const score = parseWritingScore(raw);
    assert.ok(score);
    assert.equal(score.total, 69);
    assert.equal(score.aspects.length, 4);
    assert.equal(score.corrections[0].correction, "he goes");
  });

  it("membaca JSON di dalam pagar kode", () => {
    const score = parseWritingScore("```json\n" + raw + "\n```");
    assert.ok(score);
    assert.equal(score.total, 69);
  });

  it("menjepit skor di luar 0-100", () => {
    const score = parseWritingScore(
      JSON.stringify({ aspects: [{ aspect: "task", score: 150, note: "x" }] }),
    );
    assert.equal(score?.aspects.find((a) => a.aspect === "task")?.score, 100);
  });

  it("mengisi aspek yang tidak disebut dengan skor nol", () => {
    const score = parseWritingScore(
      JSON.stringify({ aspects: [{ aspect: "task", score: 80, note: "ok" }] }),
    );
    assert.equal(score?.aspects.find((a) => a.aspect === "grammar")?.score, 0);
    assert.equal(score?.total, 80);
  });

  it("mengembalikan null untuk isi rusak atau tanpa aspek", () => {
    assert.equal(parseWritingScore("bukan json"), null);
    assert.equal(parseWritingScore("{}"), null);
    assert.equal(parseWritingScore(JSON.stringify({ aspects: [] })), null);
  });
});

describe("parseStoredScore", () => {
  it("membaca JSON tersimpan dan aman saat rusak", () => {
    assert.equal(parseStoredScore("rusak"), null);
    assert.equal(parseStoredScore(null), null);
    const score = parseStoredScore(JSON.stringify({ total: 75, aspects: [] }));
    assert.equal(score?.total, 75);
  });
});

describe("validateEssay", () => {
  it("menolak kosong", () => {
    assert.equal(validateEssay("   "), "Tulisan masih kosong.");
  });

  it("menolak terlalu pendek dan terlalu panjang", () => {
    assert.match(validateEssay("only a few words here") ?? "", /minimal/);
    const long = Array.from({ length: 701 }, () => "word").join(" ");
    assert.match(validateEssay(long) ?? "", /maksimal 700 kata/);
  });

  it("menerima panjang yang wajar", () => {
    const essay = Array.from({ length: 150 }, () => "word").join(" ");
    assert.equal(validateEssay(essay), null);
  });
});

describe("validateParagraph", () => {
  const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");

  it("menolak paragraf kosong", () => {
    assert.equal(validateParagraph("  \n "), "Paragraf masih kosong.");
  });

  it("memakai batas kata khusus paragraf kilat", () => {
    assert.match(validateParagraph(words(PARAGRAPH_MIN_WORDS - 1)) ?? "", new RegExp(`minimal ${PARAGRAPH_MIN_WORDS}`));
    assert.equal(validateParagraph(words(PARAGRAPH_MIN_WORDS)), null);
    assert.equal(validateParagraph(words(PARAGRAPH_MAX_WORDS)), null);
    assert.match(validateParagraph(words(PARAGRAPH_MAX_WORDS + 1)) ?? "", /maksimal 180 kata/);
  });

  it("lebih longgar dari batas esai penuh", () => {
    assert.ok(PARAGRAPH_MIN_WORDS < ESSAY_MIN_WORDS);
    assert.ok(PARAGRAPH_MAX_WORDS < 700);
  });
});