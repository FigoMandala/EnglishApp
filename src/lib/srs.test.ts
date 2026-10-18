import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLeech,
  nextReview,
  nextReviewFsrs,
  shiftDate,
  streakDays,
  streakDaysWithFreeze,
  todayISO,
  MAX_REVIEW_BOX,
} from "./srs";

describe("shiftDate & todayISO", () => {
  it("menggeser tanggal lintas bulan & tahun", () => {
    assert.equal(shiftDate("2026-01-31", 1), "2026-02-01");
    assert.equal(shiftDate("2025-12-31", 1), "2026-01-01");
    assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  });

  it("todayISO memakai zona Asia/Jakarta", () => {
    // 2026-01-01T17:00:00Z = 2026-01-02 00:00 WIB
    assert.equal(todayISO(new Date("2026-01-01T17:00:00Z")), "2026-01-02");
    // 2026-01-01T16:59:00Z = 2026-01-01 23:59 WIB
    assert.equal(todayISO(new Date("2026-01-01T16:59:00Z")), "2026-01-01");
  });
});

describe("nextReview (Leitner)", () => {
  it("naik box saat benar, reset saat salah", () => {
    assert.deepEqual(nextReview(0, true, "2026-09-24"), { box: 1, dueAt: "2026-09-26" });
    assert.deepEqual(nextReview(3, false, "2026-09-24"), { box: 0, dueAt: "2026-09-25" });
  });

  it("berhenti di box maksimum", () => {
    const state = nextReview(MAX_REVIEW_BOX, true, "2026-09-24");
    assert.equal(state.box, MAX_REVIEW_BOX);
  });
});

describe("nextReviewFsrs", () => {
  it("jawaban benar menaikkan box & menumbuhkan interval", () => {
    const state = nextReviewFsrs({
      box: 2,
      easeFactor: 250,
      intervalDays: 4,
      lapses: 0,
      correct: true,
      today: "2026-09-24",
    });
    assert.equal(state.box, 3);
    assert.equal(state.intervalDays, 10); // 4 * 2.5
    assert.equal(state.dueAt, "2026-10-04");
  });

  it("jawaban salah reset ke 1 hari + ease turun + lapses naik", () => {
    const state = nextReviewFsrs({
      box: 3,
      easeFactor: 250,
      intervalDays: 10,
      lapses: 1,
      correct: false,
      today: "2026-09-24",
    });
    assert.equal(state.box, 0);
    assert.equal(state.intervalDays, 1);
    assert.equal(state.dueAt, "2026-09-25");
    assert.equal(state.easeFactor, 230);
    assert.equal(state.lapses, 2);
  });

  it("ease tidak turun di bawah batas minimum", () => {
    const state = nextReviewFsrs({
      box: 0,
      easeFactor: 130,
      intervalDays: 1,
      lapses: 0,
      correct: false,
      today: "2026-09-24",
    });
    assert.equal(state.easeFactor, 130);
  });

  it("grade hard/easy menggeser interval dan ease", () => {
    const base = { box: 2, easeFactor: 250, intervalDays: 4, lapses: 0, correct: true, today: "2026-09-24" };
    const hard = nextReviewFsrs({ ...base, grade: "hard" });
    const good = nextReviewFsrs(base);
    const easy = nextReviewFsrs({ ...base, grade: "easy" });
    assert.equal(hard.intervalDays, 5); // 4 * 1.2
    assert.equal(good.intervalDays, 10);
    assert.equal(easy.intervalDays, 13); // 10 * 1.3
    assert.equal(hard.easeFactor, 235);
    assert.equal(easy.easeFactor, 265);
  });

  it("deteksi leech", () => {
    assert.equal(isLeech(4, 2), true);
    assert.equal(isLeech(3, 2), false);
    assert.equal(isLeech(5, 4), false);
  });
});

describe("streakDays", () => {
  it("menghitung streak berurutan termasuk hari ini", () => {
    const days = ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"];
    assert.equal(streakDays(days, "2026-09-24"), 5);
  });

  it("menghitung streak yang berakhir kemarin (belum belajar hari ini)", () => {
    const days = ["2026-09-22", "2026-09-23"];
    assert.equal(streakDays(days, "2026-09-24"), 2);
  });

  it("putus saat ada hari bolong", () => {
    const days = ["2026-09-20", "2026-09-22", "2026-09-23", "2026-09-24"];
    assert.equal(streakDays(days, "2026-09-24"), 3);
  });

  it("nol kalau tidak ada aktivitas", () => {
    assert.equal(streakDays([], "2026-09-24"), 0);
  });
});

describe("streakDaysWithFreeze", () => {
  it("mentoleransi satu hari bolong dengan 1 token", () => {
    const days = ["2026-09-20", "2026-09-21", "2026-09-23", "2026-09-24"];
    assert.equal(streakDaysWithFreeze(days, "2026-09-24", 1), 4);
  });

  it("tetap putus kalau bolong dua hari berturut", () => {
    // Belajar 24, bolong 23 & 22 (cuma 1 token) → streak berhenti di 1.
    const days = ["2026-09-20", "2026-09-21", "2026-09-24"];
    assert.equal(streakDaysWithFreeze(days, "2026-09-24", 1), 1);
  });

  it("menyambung rangkaian setelah satu hari bolong", () => {
    // Belajar 20, 21, [22 bolong], 23, 24 → 5 hari dengan 1 token.
    const days = ["2026-09-20", "2026-09-21", "2026-09-23", "2026-09-24"];
    assert.equal(streakDaysWithFreeze(days, "2026-09-24", 1), 4);
  });
});