import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_ONBOARDING, levelsToSkip, parseOnboarding, placedCefr } from "./onboarding";

const byLevel = { basic: [3, 3], intermediate: [2, 3], advanced: [0, 2] } as const;

describe("placedCefr", () => {
  it("hasil tes menang atas pilihan sendiri", () => {
    const data = { ...EMPTY_ONBOARDING, cefr: "C1" as const, placement: { score: 2, total: 8, byLevel: { ...byLevel } as never } };
    assert.equal(placedCefr(data), "A2");
  });

  it("tanpa tes memakai pilihan sendiri, bawaan A1", () => {
    assert.equal(placedCefr({ ...EMPTY_ONBOARDING, cefr: "B1" }), "B1");
    assert.equal(placedCefr(EMPTY_ONBOARDING), "A1");
  });

  it("skor tinggi memberi B2 atau C1", () => {
    const high = (score: number) => ({ ...EMPTY_ONBOARDING, placement: { score, total: 10, byLevel: {} as never } });
    assert.equal(placedCefr(high(8)), "B2");
    assert.equal(placedCefr(high(10)), "C1");
  });
});

describe("levelsToSkip", () => {
  it("level dasar tidak melewati apa pun, menengah melewati dasar", () => {
    assert.deepEqual(levelsToSkip("A2"), []);
    assert.deepEqual(levelsToSkip("B1"), ["basic"]);
    assert.deepEqual(levelsToSkip("C1"), ["basic", "intermediate"]);
  });
});

describe("parseOnboarding", () => {
  it("menerima payload valid", () => {
    const parsed = parseOnboarding(
      JSON.stringify({ goal: "eprt", cefr: "B1", dailyMinutes: 15, placement: { score: 5, total: 8, byLevel: { basic: [3, 3] } } }),
    );
    assert.equal(parsed?.goal, "eprt");
    assert.equal(parsed?.dailyMinutes, 15);
    assert.equal(parsed?.placement?.score, 5);
    assert.deepEqual(parsed?.placement?.byLevel.basic, [3, 3]);
  });

  it("menolak nilai di luar daftar dan bentuk salah", () => {
    assert.equal(parseOnboarding("bukan json"), null);
    assert.equal(parseOnboarding(JSON.stringify({ goal: "hack", cefr: "Z9", dailyMinutes: 999 }))?.goal, null);
    assert.equal(parseOnboarding(JSON.stringify({ dailyMinutes: 999 }))?.dailyMinutes, 10);
    assert.equal(parseOnboarding(JSON.stringify({ placement: { score: 9, total: 8 } }))?.placement, null);
    assert.equal(parseOnboarding("x".repeat(3000)), null);
  });

  it("jawaban tes penempatan divalidasi: id positif, pilihan terpotong, maksimal 20", () => {
    const parsed = parseOnboarding(
      JSON.stringify({
        placementResponses: [
          { id: 7, choice: "goes" },
          { id: 8, choice: null },
          { id: -3, choice: "x" },
          { id: 9, choice: "y".repeat(500) },
          "rusak",
          { id: 10 },
        ],
      }),
    );
    assert.deepEqual(parsed?.placementResponses, [
      { id: 7, choice: "goes" },
      { id: 8, choice: null },
      { id: 9, choice: "y".repeat(300) },
      { id: 10, choice: null },
    ]);
    const flood = parseOnboarding(JSON.stringify({ placementResponses: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, choice: null })) }));
    assert.equal(flood?.placementResponses.length, 20);
  });

  it("tanpa placementResponses tetap bernilai array kosong", () => {
    assert.deepEqual(parseOnboarding(JSON.stringify({ goal: "eprt" }))?.placementResponses, []);
    assert.deepEqual(EMPTY_ONBOARDING.placementResponses, []);
  });
});
