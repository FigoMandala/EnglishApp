import assert from "node:assert/strict";
import test from "node:test";

import { pickUnitWords, topicFromItemTitle, type UnitWordCandidate } from "./unit-words";

const card = (
  id: number,
  word: string,
  level: UnitWordCandidate["level"],
  topic: string | null,
  frequencyRank: number | null = null,
): UnitWordCandidate => ({ id, word, level, topic, frequencyRank });

const CARDS = [
  card(1, "abundant", "intermediate", "Akademik", 900),
  card(2, "apple", "basic", "Makanan & minuman", 300),
  card(3, "bread", "basic", "Makanan & minuman", 200),
  card(4, "cuisine", "intermediate", "Makanan & minuman", 50),
  card(5, "table", "basic", "Rumah & perabot", 100),
  card(6, "chair", "basic", "Rumah & perabot", 150),
];

test("topicFromItemTitle membuang awalan dan memakai alias", () => {
  assert.equal(topicFromItemTitle("Kosakata: Makanan & Minuman"), "makanan & minuman");
  assert.equal(topicFromItemTitle("Kosakata: benda sehari-hari"), "rumah & perabot");
  assert.equal(topicFromItemTitle("Kosakata: akademik lanjut"), "akademik");
});

test("pickUnitWords memilih topik yang cocok, level unit lebih dulu", () => {
  const words = pickUnitWords(CARDS, { title: "Kosakata: makanan & minuman", level: "basic", unitOrder: 5, count: 3 });
  assert.deepEqual(words.map((w) => w.word), ["bread", "apple", "cuisine"]);
});

test("pickUnitWords memakai alias benda sehari-hari", () => {
  const words = pickUnitWords(CARDS, { title: "Kosakata: benda sehari-hari", level: "basic", unitOrder: 1, count: 10 });
  assert.deepEqual(words.map((w) => w.word), ["table", "chair"]);
});

test("pickUnitWords fallback berbeda antar unit kalau topik tidak ada", () => {
  const first = pickUnitWords(CARDS, { title: "Kosakata: antariksa", level: "basic", unitOrder: 1, count: 2 });
  const second = pickUnitWords(CARDS, { title: "Kosakata: antariksa", level: "basic", unitOrder: 2, count: 2 });
  assert.equal(first.length, 2);
  assert.notDeepEqual(first.map((w) => w.id), second.map((w) => w.id));
});
