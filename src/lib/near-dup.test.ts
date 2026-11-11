import assert from "node:assert/strict";
import { test } from "node:test";

import { NearDupIndex } from "./near-dup";

const WORDS = "river stone market policy energy signal garden bridge harvest museum orbit leader window forest craft planet ocean tunnel engine valley harbor mirror candle summit meadow lantern compass thunder island canyon desert glacier".split(" ");

/** Pembangkit acak deterministik supaya tes tidak flaky. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function sentence(random: () => number, n = 20) {
  return Array.from({ length: n }, () => WORDS[Math.floor(random() * WORDS.length)] + Math.floor(random() * 50)).join(" ");
}

test("teks identik selalu terdeteksi", () => {
  const index = new NearDupIndex(0.6);
  const text = "The committee decided to postpone the final vote until all members had reviewed the new budget proposal carefully.";
  index.add(text);
  assert.equal(index.has(text), true);
});

test("teks yang jauh berbeda tidak terdeteksi", () => {
  const random = rng(1);
  const index = new NearDupIndex(0.6);
  for (let i = 0; i < 500; i += 1) index.add(sentence(random));
  let falsePositive = 0;
  for (let i = 0; i < 200; i += 1) if (index.has(sentence(random))) falsePositive += 1;
  assert.ok(falsePositive <= 4, `false positive ${falsePositive}/200`);
});

test("teks nyaris kembar (satu kata diganti) tertangkap pada sebagian besar kasus", () => {
  const random = rng(7);
  const index = new NearDupIndex(0.6);
  const originals: string[] = [];
  for (let i = 0; i < 300; i += 1) {
    const text = sentence(random);
    originals.push(text);
    index.add(text);
  }
  let caught = 0;
  for (const text of originals) {
    const words = text.split(" ");
    words[Math.floor(random() * words.length)] = "zzz" + Math.floor(random() * 1000);
    if (index.has(words.join(" "))) caught += 1;
  }
  assert.ok(caught / originals.length >= 0.85, `recall ${caught}/${originals.length}`);
});

test("ambang rendah (teks bacaan) menangkap teks yang berbagi separuh isinya", () => {
  const random = rng(11);
  const index = new NearDupIndex(0.3, { rows: 2 });
  const a = sentence(random, 120);
  index.add(a);
  const words = a.split(" ");
  const mixed = [...words.slice(0, 70), ...sentence(random, 50).split(" ")].join(" ");
  assert.equal(index.has(mixed), true);
});

test("indeks tumbuh melewati kapasitas awal tanpa merusak hasil", () => {
  const random = rng(3);
  const index = new NearDupIndex(0.6);
  const first = sentence(random);
  index.add(first);
  for (let i = 0; i < 3000; i += 1) index.add(sentence(random));
  assert.equal(index.length, 3001);
  assert.equal(index.has(first), true);
});

test("has() tetap cepat pada puluhan ribu teks", () => {
  const random = rng(5);
  const index = new NearDupIndex(0.6);
  for (let i = 0; i < 30_000; i += 1) index.add(sentence(random));
  const started = Date.now();
  for (let i = 0; i < 50; i += 1) index.has(sentence(random));
  const perCheck = (Date.now() - started) / 50;
  assert.ok(perCheck < 5, `${perCheck}ms per cek`);
});
