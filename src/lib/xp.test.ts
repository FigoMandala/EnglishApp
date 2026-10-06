import assert from "node:assert/strict";
import test from "node:test";

import { DAILY_GOAL_XP, dailyGoalProgress, levelFromXp, levelTitle, xpForLevel } from "./xp";

test("xpForLevel naik makin cepat tiap level", () => {
  assert.equal(xpForLevel(1), 0);
  assert.ok(xpForLevel(2) > 0);
  assert.ok(xpForLevel(3) - xpForLevel(2) >= xpForLevel(2) - xpForLevel(1));
});

test("levelFromXp menghitung level dan progres", () => {
  const start = levelFromXp(0);
  assert.equal(start.level, 1);
  assert.equal(start.xpIntoLevel, 0);

  const next = levelFromXp(xpForLevel(2));
  assert.equal(next.level, 2);
  assert.equal(next.xpIntoLevel, 0);

  const mid = levelFromXp(xpForLevel(2) + Math.floor((xpForLevel(3) - xpForLevel(2)) / 2));
  assert.equal(mid.level, 2);
  assert.ok(mid.progress > 0 && mid.progress < 100);
});

test("levelFromXp aman untuk nilai negatif", () => {
  assert.equal(levelFromXp(-50).level, 1);
});

test("levelTitle memberi gelar sesuai level", () => {
  assert.equal(levelTitle(1), "Pemula");
  assert.equal(levelTitle(30), "Ahli");
});

test("dailyGoalProgress menandai target tercapai", () => {
  assert.equal(dailyGoalProgress(0).reached, false);
  assert.equal(dailyGoalProgress(DAILY_GOAL_XP).reached, true);
  assert.equal(dailyGoalProgress(DAILY_GOAL_XP * 2).progress, 100);
});