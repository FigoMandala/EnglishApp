import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { judgeQuestion, MIN_ATTEMPTS, summarize } from "./calibration";

describe("judgeQuestion", () => {
  it("belum dinilai sebelum jawaban cukup", () => {
    assert.equal(judgeQuestion(undefined, "mid"), "unknown");
    assert.equal(judgeQuestion({ attempts: MIN_ATTEMPTS - 1, correct: 0 }, "mid"), "unknown");
  });

  it("menandai soal yang hampir selalu dijawab salah", () => {
    assert.equal(judgeQuestion({ attempts: 10, correct: 1 }, "mid"), "faulty");
    assert.equal(judgeQuestion({ attempts: 10, correct: 3 }, "mid"), "ok");
  });

  it("soal terlalu mudah hanya disaring di level mid dan high", () => {
    const easy = { attempts: 20, correct: 20 };
    assert.equal(judgeQuestion(easy, "low"), "ok");
    assert.equal(judgeQuestion(easy, "mid"), "too-easy");
    assert.equal(judgeQuestion(easy, "high"), "too-easy");
  });
});

describe("summarize", () => {
  it("menggabungkan per level dan jenis soal", () => {
    const rows = [
      { kind: "structure", levelBand: "mid" as const, attempts: 20, correct: 19 },
      { kind: "structure", levelBand: "mid" as const, attempts: 20, correct: 18 },
      { kind: "reading", levelBand: "mid" as const, attempts: 5, correct: 1 },
    ];
    const result = summarize(rows);
    const structure = result.find((group) => group.kind === "structure")!;
    assert.equal(structure.questions, 2);
    assert.equal(structure.attempts, 40);
    assert.equal(structure.status, "too-easy");
    assert.equal(structure.tooEasy, 1);
    assert.equal(result.find((group) => group.kind === "reading")!.status, "thin");
  });
});
