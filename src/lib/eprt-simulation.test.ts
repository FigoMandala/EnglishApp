import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  batchCount,
  DEADLINE_GRACE_MS,
  emptyParts,
  isExpired,
  partBatches,
  parseParts,
  parseScope,
  parseTimers,
  partsInScope,
  remainingMs,
  scopeQuestionTotal,
  serializeTimers,
  SIM_BATCH_TOTAL,
  SIM_PARTS,
  SIM_QUESTION_TOTAL,
  simulationScore,
} from "./eprt-simulation";

describe("SIM_PARTS", () => {
  it("mengikuti susunan EPrT 50/40/50", () => {
    const per = (section: string) =>
      SIM_PARTS.filter((part) => part.section === section).reduce((sum, part) => sum + part.count, 0);
    assert.equal(per("listening"), 50);
    assert.equal(per("structure"), 40);
    assert.equal(per("reading"), 50);
    assert.equal(SIM_QUESTION_TOTAL, 140);
  });
});

describe("partBatches", () => {
  it("jumlah batch sama dengan jumlah soal tiap bagian", () => {
    for (const part of SIM_PARTS) {
      const total = partBatches(part).reduce((sum, batch) => sum + batch.count, 0);
      assert.equal(total, part.count, part.title);
    }
  });

  it("offset tiap batch berurutan mulai dari nol", () => {
    for (const part of SIM_PARTS) {
      let expected = 0;
      for (const batch of partBatches(part)) {
        assert.equal(batch.offset, expected, part.title);
        expected += batch.count;
      }
    }
  });

  it("reading tidak dipecah, bagian besar dipecah lebih dari satu", () => {
    const reading = SIM_PARTS.find((part) => part.kind === "reading")!;
    assert.equal(batchCount(reading), 1);

    const written = SIM_PARTS.find((part) => part.kind === "written")!;
    assert.ok(batchCount(written) > 1);
    assert.ok(partBatches(written).every((batch) => batch.count <= 10));
  });

  it("total batch seluruh simulasi masuk akal", () => {
    assert.equal(
      SIM_BATCH_TOTAL,
      SIM_PARTS.reduce((sum, part) => sum + batchCount(part), 0),
    );
    assert.ok(SIM_BATCH_TOTAL > SIM_PARTS.length);
  });
});

describe("parseParts", () => {
  it("mengisi null untuk bagian yang belum dibuat", () => {
    assert.deepEqual(parseParts(emptyParts()), SIM_PARTS.map(() => null));
    assert.deepEqual(parseParts("[7, null, \"x\"]").slice(0, 3), [7, null, null]);
    assert.equal(parseParts("rusak").length, SIM_PARTS.length);
  });
});

describe("simulationScore", () => {
  it("skor sempurna dan nol ada di ujung skala", () => {
    const all = (ratio: number) =>
      simulationScore([
        { section: "listening", correct: 50 * ratio, total: 50 },
        { section: "structure", correct: 40 * ratio, total: 40 },
        { section: "reading", correct: 50 * ratio, total: 50 },
      ]);
    assert.equal(all(1).total, 677);
    assert.equal(all(0).total, 310);
  });

  it("menjumlahkan beberapa bagian dalam satu section", () => {
    const score = simulationScore([
      { section: "reading", correct: 10, total: 10 },
      { section: "reading", correct: 0, total: 10 },
    ]);
    assert.equal(score.correct.reading, 10);
    assert.equal(score.answered.reading, 20);
  });
});

describe("mini-test per section", () => {
  it("scope disimpan di timers tanpa mengganggu parseTimers", () => {
    const start = "2026-09-23T10:00:00.000Z";
    const raw = serializeTimers({ reading: start }, "reading");
    assert.equal(parseScope(raw), "reading");
    assert.deepEqual(parseTimers(raw), { reading: start });
    assert.equal(parseScope(serializeTimers({}, null)), null);
    assert.equal(parseScope(JSON.stringify({ scope: "lain" })), null);
    assert.equal(parseScope("rusak"), null);
    assert.equal(parseScope(null), null);
  });

  it("jumlah soal tiap section sama dengan susunan EPrT", () => {
    assert.equal(scopeQuestionTotal("listening"), 50);
    assert.equal(scopeQuestionTotal("structure"), 40);
    assert.equal(scopeQuestionTotal("reading"), 50);
    assert.equal(scopeQuestionTotal(null), SIM_QUESTION_TOTAL);
  });

  it("partsInScope menjaga indeks asli bagian", () => {
    const reading = partsInScope("reading");
    assert.equal(reading.length, 5);
    assert.ok(reading.every(({ part, index }) => SIM_PARTS[index] === part && part.section === "reading"));
    assert.equal(partsInScope(null).length, SIM_PARTS.length);
  });
});

describe("timer section", () => {
  const start = "2026-09-23T10:00:00.000Z";
  const at = (minutes: number) => Date.parse(start) + minutes * 60_000;

  it("belum dimulai berarti tidak ada batas", () => {
    assert.equal(remainingMs({}, "reading"), null);
    assert.equal(isExpired({}, "reading"), false);
  });

  it("menghitung sisa waktu dari batas tiap section", () => {
    assert.equal(remainingMs({ structure: start }, "structure", at(10)), 15 * 60_000);
    assert.equal(remainingMs({ reading: start }, "reading", at(10)), 45 * 60_000);
  });

  it("baru dianggap habis setelah toleransi jaringan", () => {
    const end = at(25);
    assert.equal(isExpired({ structure: start }, "structure", end + DEADLINE_GRACE_MS - 1), false);
    assert.equal(isExpired({ structure: start }, "structure", end + DEADLINE_GRACE_MS + 1), true);
  });

  it("mengabaikan isi timer yang rusak", () => {
    assert.deepEqual(parseTimers("rusak"), {});
    assert.deepEqual(parseTimers(JSON.stringify({ reading: start, lain: "x", listening: 5 })), { reading: start });
  });
});
