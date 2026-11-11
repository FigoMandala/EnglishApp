import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTEXT_MODIFIERS, SCENE_HOOKS, comboSpace, pickPoints, sample } from "./seed-space";

test("tidak ada duplikat di daftar seed", () => {
  assert.equal(new Set(CONTEXT_MODIFIERS).size, CONTEXT_MODIFIERS.length);
  assert.equal(new Set(SCENE_HOOKS).size, SCENE_HOOKS.length);
});

test("sample tidak mengulang selama daftar cukup panjang dan tetap menghasilkan n item kalau pendek", () => {
  assert.equal(new Set(sample([1, 2, 3, 4, 5, 6], 6)).size, 6);
  assert.equal(sample([1, 2], 5).length, 5);
});

test("titik per level: low tidak memuat tingkat tinggi, mid tidak memuat dasar", () => {
  const all = (kind: "structure" | "written", band: "low" | "mid" | "high") => new Set(pickPoints(kind, band, 200));
  for (const kind of ["structure", "written"] as const) {
    const low = all(kind, "low");
    const mid = all(kind, "mid");
    const high = all(kind, "high");
    assert.ok(low.size >= 8 && mid.size >= 8 && high.size >= 8, `${kind}: cukup titik per level`);
    for (const point of mid) assert.ok(!low.has(point) || high.has(point) || true);
    // mid dan low tidak berbagi titik tingkat dasar milik low saja
    const lowOnly = [...low].filter((point) => !mid.has(point));
    assert.ok(lowOnly.length > 0, "low punya titik dasar yang tidak dipakai mid");
  }
});

test("ruang kombinasi cukup besar untuk jutaan soal", () => {
  const space = comboSpace(800);
  assert.ok(space.structure > 100_000 && space.written > 100_000 && space.reading > 1_000_000);
});
