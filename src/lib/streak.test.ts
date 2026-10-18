import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeStreak, freezesAvailable, longestStreak, timeLeftToday } from "./streak";

const none = { frozen: [], weekendEasy: false };

describe("computeStreak", () => {
  it("menghitung hari beruntun sampai hari ini", () => {
    assert.equal(computeStreak(["2026-10-15", "2026-10-16", "2026-10-17"], "2026-10-17", none), 3);
  });

  it("hari ini belum belajar tidak memutus streak", () => {
    assert.equal(computeStreak(["2026-10-15", "2026-10-16"], "2026-10-17", none), 2);
  });

  it("kemarin kosong memutus streak", () => {
    assert.equal(computeStreak(["2026-10-14", "2026-10-15"], "2026-10-17", none), 0);
  });

  it("pelindung menyambung hari bolong", () => {
    const options = { frozen: ["2026-10-16"], weekendEasy: false };
    assert.equal(computeStreak(["2026-10-14", "2026-10-15", "2026-10-17"], "2026-10-17", options), 4);
  });

  it("akhir pekan santai: Sabtu-Minggu kosong tidak memutus dan tidak menambah", () => {
    // 2026-10-17 = Sabtu, 16 = Jumat, 12-15 = Senin-Kamis
    const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
    assert.equal(computeStreak(days, "2026-10-19", { frozen: [], weekendEasy: true }), 5);
    assert.equal(computeStreak(days, "2026-10-19", none), 0);
  });
});

describe("longestStreak", () => {
  it("memilih rangkaian terpanjang", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"];
    assert.equal(longestStreak(days, "2026-10-17", none), 3);
  });

  it("riwayat kosong = 0", () => {
    assert.equal(longestStreak([], "2026-10-17", none), 0);
  });
});

describe("freezesAvailable", () => {
  it("terisi 1 tiap 7 hari belajar, maksimal 2, dikurangi yang dipakai", () => {
    assert.equal(freezesAvailable(6, 0), 0);
    assert.equal(freezesAvailable(7, 0), 1);
    assert.equal(freezesAvailable(40, 0), 2);
    assert.equal(freezesAvailable(14, 1), 1);
    assert.equal(freezesAvailable(7, 3), 0);
  });
});

describe("timeLeftToday", () => {
  it("menghitung sisa jam dan menit di zona Jakarta", () => {
    // 20:48 WIB = 13:48 UTC -> sisa 3 jam 12 menit
    const left = timeLeftToday(new Date("2026-10-17T13:48:00Z"));
    assert.deepEqual(left, { hours: 3, minutes: 12 });
  });
});
