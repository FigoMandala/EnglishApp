import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  copiesExample,
  fingerprint,
  pickFresh,
  pickScenes,
  questionText,
  rememberSeeds,
  similarity,
  SimilarityIndex,
  SUBTOPICS,
  trigrams,
} from "./question-variety";

describe("SUBTOPICS", () => {
  it("cukup banyak dan tidak kembar", () => {
    assert.ok(SUBTOPICS.length >= 800, `hanya ${SUBTOPICS.length}`);
    assert.equal(new Set(SUBTOPICS).size, SUBTOPICS.length);
  });
});

describe("pickFresh", () => {
  const pool = ["a", "b", "c", "d"];

  it("tidak memilih yang baru dipakai dan tidak kembar", () => {
    const picked = pickFresh(pool, ["a", "b"], 2);
    assert.deepEqual([...picked].sort(), ["c", "d"]);
  });

  it("saat pool habis, pakai yang paling lama dipakai dulu", () => {
    assert.deepEqual(pickFresh(pool, ["b", "a", "d", "c"], 2), ["b", "a"]);
  });
});

describe("pickScenes", () => {
  it("menghasilkan skenario unik yang tidak ada di riwayat", () => {
    const first = pickScenes([], 20);
    assert.equal(new Set(first).size, 20);
    const next = pickScenes(first, 20);
    assert.ok(next.every((scene) => !first.includes(scene)));
  });
});

describe("rememberSeeds", () => {
  it("memindahkan seed terpakai ke akhir dan membatasi panjang", () => {
    assert.deepEqual(rememberSeeds(["a", "b", "c"], ["a"], 3), ["b", "c", "a"]);
    assert.deepEqual(rememberSeeds(["a", "b", "c"], ["d"], 3), ["b", "c", "d"]);
  });
});

describe("kemiripan", () => {
  const a = "The ancient Egyptians built pyramids as tombs for their pharaohs.";

  it("fingerprint mengabaikan huruf besar dan tanda baca", () => {
    assert.equal(fingerprint(a), fingerprint("the ANCIENT egyptians built pyramids, as tombs for their pharaohs"));
  });

  it("teks identik bernilai 1, teks berbeda rendah", () => {
    assert.equal(similarity(trigrams(a), trigrams(a)), 1);
    assert.ok(similarity(trigrams(a), trigrams("Solar panels convert sunlight into electricity.")) < 0.1);
  });

  it("SimilarityIndex mengenali soal yang hampir sama", () => {
    const index = new SimilarityIndex([a]);
    assert.equal(index.has("The ancient Egyptians built pyramids as tombs for their kings."), true);
    assert.equal(index.has("Bees communicate the location of flowers by dancing."), false);
  });

  it("menolak frasa contoh resmi", () => {
    assert.equal(copiesExample("Excuse me, my name is Mike Wheeler."), true);
    assert.equal(copiesExample("The Romans worshiped many gods."), false);
  });
});

describe("questionText", () => {
  it("tidak terpengaruh urutan opsi", () => {
    const base = { q: "Pick one", options: ["alpha", "beta", "gamma", "delta"] };
    const shuffled = { ...base, options: ["gamma", "alpha", "delta", "beta"] };
    assert.equal(fingerprint(questionText(base)), fingerprint(questionText(shuffled)));
  });
});
