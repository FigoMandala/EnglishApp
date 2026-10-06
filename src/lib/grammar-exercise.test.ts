import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAnswer,
  normalizeAnswer,
  parseAnswers,
  parseOptions,
  shuffleWords,
  validateAnswerText,
} from "./grammar-exercise";

test("normalizeAnswer menyeragamkan huruf, tanda baca, dan spasi", () => {
  assert.equal(normalizeAnswer("She IS a Doctor!"), "she is a doctor");
  assert.equal(normalizeAnswer("  hello   world  "), "hello world");
  assert.equal(normalizeAnswer("he's tired."), "he s tired");
});

test("parseAnswers dan parseOptions aman untuk JSON rusak", () => {
  assert.deepEqual(parseAnswers(JSON.stringify(["a", "an"])), ["a", "an"]);
  assert.deepEqual(parseAnswers("bukan json"), []);
  assert.deepEqual(parseAnswers(null), []);
  assert.deepEqual(parseOptions(JSON.stringify(["a", "b"])), ["a", "b"]);
  assert.deepEqual(parseOptions("{rusak"), []);
});

test("checkAnswer mengabaikan huruf besar dan tanda baca", () => {
  assert.equal(checkAnswer("fill", "A", ["a"]), true);
  assert.equal(checkAnswer("fill", "  the ", ["the"]), true);
  assert.equal(checkAnswer("choice", "ARE", ["are"]), true);
  assert.equal(checkAnswer("choice", "is", ["are"]), false);
  assert.equal(checkAnswer("translate", "She is a doctor.", ["she is a doctor"]), true);
  assert.equal(checkAnswer("translate", "She is doctor", ["she is a doctor"]), false);
});

test("susun kata butuh urutan yang benar", () => {
  const keys = ["he is tired"];
  assert.equal(checkAnswer("arrange", "He is tired", keys), true);
  assert.equal(checkAnswer("arrange", "is He tired", keys), false);
});

test("jawaban kosong selalu salah", () => {
  assert.equal(checkAnswer("fill", "   ", ["a"]), false);
  assert.equal(checkAnswer("fill", "a", []), false);
});

test("shuffleWords menghasilkan kata yang sama, urutan stabil", () => {
  const words = ["a", "b", "c", "d"];
  const first = shuffleWords(words, 7);
  const second = shuffleWords(words, 7);
  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), [...words].sort());
});

test("validateAnswerText menolak kosong dan kepanjangan", () => {
  assert.ok(validateAnswerText(""));
  assert.equal(validateAnswerText("hello"), null);
  assert.ok(validateAnswerText("x".repeat(500)));
});