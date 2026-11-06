import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWord, parseGeneratedWords, toVocabRow } from "./vocabulary-generator";

const fallback = { level: "basic" as const, topic: "Makanan" };

test("parseGeneratedWords membaca array JSON valid", () => {
  const raw = JSON.stringify([
    { word: "apple", meaning: "apel", phonetic: "/ˈæp.əl/", partOfSpeech: "noun", exampleEn: "I eat an apple.", exampleId: "Saya makan apel.", level: "basic", topic: "Makanan" },
    { word: "bread", meaning: "roti" },
  ]);
  const words = parseGeneratedWords(raw, fallback, new Set());
  assert.equal(words.length, 2);
  assert.equal(words[0].level, "basic");
  assert.equal(words[1].level, "basic");
  assert.equal(words[1].topic, "Makanan");
});

test("parseGeneratedWords melewatkan kata duplikat yang sudah ada", () => {
  const raw = JSON.stringify([{ word: "Apple", meaning: "apel" }, { word: "bread", meaning: "roti" }]);
  const words = parseGeneratedWords(raw, fallback, new Set(["apple"]));
  assert.deepEqual(words.map((item) => item.word), ["bread"]);
});

test("parseGeneratedWords menolak entri tanpa arti atau bukan kata", () => {
  const raw = JSON.stringify([
    { word: "", meaning: "kosong" },
    { word: "bread" },
    { word: "123", meaning: "angka" },
    { word: "milk", meaning: "susu" },
  ]);
  const words = parseGeneratedWords(raw, fallback, new Set());
  assert.deepEqual(words.map((item) => item.word), ["milk"]);
});

test("parseGeneratedWords menolak kata tanpa vokal (akronim, kata rusak)", () => {
  const raw = JSON.stringify([
    { word: "sbjct", meaning: "subjek" },
    { word: "html", meaning: "bahasa markup" },
    { word: "gym", meaning: "pusat kebugaran" },
  ]);
  const words = parseGeneratedWords(raw, fallback, new Set());
  // gym lolos karena y dihitung vokal; sbjct dan html ditolak.
  assert.deepEqual(words.map((item) => item.word), ["gym"]);
});

test("parseGeneratedWords aman untuk JSON rusak", () => {
  assert.deepEqual(parseGeneratedWords("bukan json", fallback, new Set()), []);
  assert.deepEqual(parseGeneratedWords("{}", fallback, new Set()), []);
});

test("level asing dikembalikan ke level fallback", () => {
  const raw = JSON.stringify([{ word: "run", meaning: "berlari", level: "super" }]);
  const words = parseGeneratedWords(raw, { level: "intermediate", topic: "Kata kerja" }, new Set());
  assert.equal(words[0].level, "intermediate");
});

test("toVocabRow mengisi wordLower dari kata", () => {
  const [item] = parseGeneratedWords(
    JSON.stringify([{ word: "Run", meaning: "berlari" }]),
    fallback,
    new Set(),
  );
  const row = toVocabRow(item);
  assert.equal(row.wordLower, "run");
  assert.equal(normalizeWord("  Run "), "run");
});