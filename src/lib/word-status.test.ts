import assert from "node:assert/strict";
import { test } from "node:test";

import { wordStatus } from "./word-status";

test("wordStatus memilah baru, jatuh tempo, dikuasai, dan nanti", () => {
  const today = "2026-10-23";
  assert.equal(wordStatus({ box: 0, dueAt: null, lastReviewedAt: null }, today).kind, "new");
  assert.equal(wordStatus({ box: 2, dueAt: "2026-10-23", lastReviewedAt: "2026-10-20" }, today).kind, "due");
  assert.equal(wordStatus({ box: 6, dueAt: "2026-11-20", lastReviewedAt: "2026-10-20" }, today).kind, "mastered");
  assert.equal(wordStatus({ box: 3, dueAt: "2026-10-24", lastReviewedAt: "2026-10-20" }, today).label, "besok");
  assert.equal(wordStatus({ box: 3, dueAt: "2026-10-27", lastReviewedAt: "2026-10-20" }, today).label, "dalam 4 hari");
});
