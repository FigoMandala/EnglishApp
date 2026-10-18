import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankRows, tierIndexForXp, weekBounds } from "./league";

describe("weekBounds", () => {
  it("minggu dimulai Senin dan berakhir Minggu", () => {
    // 2026-10-17 adalah Sabtu
    assert.deepEqual(weekBounds("2026-10-17"), {
      start: "2026-10-12",
      end: "2026-10-18",
      prevStart: "2026-10-05",
      prevEnd: "2026-10-11",
    });
  });

  it("hari Minggu masuk minggu yang sama", () => {
    assert.equal(weekBounds("2026-10-18").start, "2026-10-12");
  });
});

describe("tierIndexForXp", () => {
  it("memetakan level ke tingkat liga", () => {
    assert.equal(tierIndexForXp(0), 0);
    assert.ok(tierIndexForXp(100_000) >= 3);
  });
});

describe("rankRows", () => {
  it("mengurutkan XP turun, nama sebagai pemecah seri", () => {
    const rows = rankRows([
      { userId: 1, name: "Budi", xp: 10, isMe: false },
      { userId: 2, name: "Ani", xp: 10, isMe: true },
      { userId: 3, name: "Cici", xp: 40, isMe: false },
    ]);
    assert.deepEqual(rows.map((r) => r.name), ["Cici", "Ani", "Budi"]);
  });
});
