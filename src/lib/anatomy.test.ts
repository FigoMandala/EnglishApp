import assert from "node:assert/strict";
import { test } from "node:test";

import { blankAnatomy } from "./anatomy";

test("blankAnatomy membelah di titik rumpang dan menandai jawaban salah", () => {
  const parts = blankAnatomy("Each of the students ______ a laptop.", "have brought", "has brought");
  assert.deepEqual(parts, [
    { text: "Each of the students", tone: "plain" },
    { text: "have brought", label: "Jawabanmu", tone: "wrong" },
    { text: "has brought", label: "Yang benar", tone: "right" },
    { text: "a laptop.", tone: "plain" },
  ]);
});

test("blankAnatomy tanpa rumpang atau kunci mengembalikan null", () => {
  assert.equal(blankAnatomy("No blank here.", "x", "y"), null);
  assert.equal(blankAnatomy("A ___ b", "x", null), null);
});

test("blankAnatomy tidak menampilkan jawabanmu kalau sama (beda huruf besar)", () => {
  const parts = blankAnatomy("She ___ home.", "Goes", "goes");
  assert.equal(parts?.some((p) => p.tone === "wrong"), false);
});
