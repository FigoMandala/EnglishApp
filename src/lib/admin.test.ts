import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bankItemPreview,
  editBankItem,
  isLeech,
  lapseRate,
  missingFields,
  moveInOrder,
  parseWordInput,
  roleChangeError,
} from "./admin";
import { fingerprint, questionText } from "./question-variety";

describe("kata leech", () => {
  it("butuh minimal dua pelajar yang nyangkut", () => {
    assert.equal(isLeech(undefined), false);
    assert.equal(isLeech({ reviews: 40, lapses: 20, leechLearners: 1 }), false);
    assert.equal(isLeech({ reviews: 40, lapses: 20, leechLearners: 2 }), true);
  });

  it("persen lupa aman saat belum pernah diulang", () => {
    assert.equal(lapseRate({ reviews: 0, lapses: 0, leechLearners: 0 }), null);
    assert.equal(lapseRate({ reviews: 10, lapses: 3, leechLearners: 0 }), 0.3);
  });
});

describe("missingFields", () => {
  it("melaporkan bagian kartu yang kosong", () => {
    assert.deepEqual(missingFields({ phonetic: " ", exampleEn: "x", exampleId: null, cefr: "B1" }), [
      "fonetik",
      "terjemahan contoh",
    ]);
  });
});

describe("parseWordInput", () => {
  const form = (values: Record<string, string>) => (key: string) => values[key] ?? null;

  it("menolak input tanpa kata atau arti", () => {
    assert.deepEqual(parseWordInput(form({ meaning: "x", level: "basic" })), { error: "Kata wajib diisi." });
  });

  it("menolak level, CEFR, dan peringkat yang tidak valid", () => {
    assert.ok("error" in parseWordInput(form({ word: "a", meaning: "b", level: "expert" })));
    assert.ok("error" in parseWordInput(form({ word: "a", meaning: "b", level: "basic", cefr: "Z9" })));
    assert.ok("error" in parseWordInput(form({ word: "a", meaning: "b", level: "basic", frequencyRank: "-3" })));
  });

  it("merapikan nilai dan mengosongkan kolom opsional", () => {
    const result = parseWordInput(form({ word: " thrive ", meaning: "berkembang", level: "advanced", frequencyRank: "990" }));
    assert.ok("values" in result);
    assert.equal(result.values.word, "thrive");
    assert.equal(result.values.phonetic, null);
    assert.equal(result.values.cefr, null);
    assert.equal(result.values.frequencyRank, 990);
  });
});

describe("roleChangeError", () => {
  const base = { actorId: 1, targetId: 2, currentRole: "admin" as const, nextRole: "user" as const, adminCount: 3 };

  it("melarang mencabut peran sendiri", () => {
    assert.ok(roleChangeError({ ...base, targetId: 1 }));
  });

  it("melarang menghapus admin terakhir", () => {
    assert.ok(roleChangeError({ ...base, adminCount: 1 }));
  });

  it("mengizinkan perubahan yang wajar", () => {
    assert.equal(roleChangeError(base), null);
    assert.equal(roleChangeError({ ...base, currentRole: "user", nextRole: "admin", adminCount: 1 }), null);
  });
});

describe("bankItemPreview", () => {
  it("mengambil soal pertama dan menahan JSON rusak", () => {
    assert.deepEqual(bankItemPreview(JSON.stringify({ passage: null, questions: [{ q: "Pick one" }, { q: "Two" }] })), {
      text: "Pick one",
      count: 2,
    });
    assert.deepEqual(bankItemPreview("{oops"), { text: "(item rusak)", count: 0 });
  });
});

describe("moveInOrder", () => {
  it("menukar dengan tetangga dan diam di ujung", () => {
    assert.deepEqual(moveInOrder([1, 2, 3], 2, -1), [2, 1, 3]);
    assert.deepEqual(moveInOrder([1, 2, 3], 2, 1), [1, 3, 2]);
    assert.deepEqual(moveInOrder([1, 2, 3], 1, -1), [1, 2, 3]);
    assert.deepEqual(moveInOrder([1, 2, 3], 9, 1), [1, 2, 3]);
  });
});

describe("editBankItem", () => {
  const question = {
    type: "structure",
    skill: null,
    q: "1. The committee ___ the winners yesterday.",
    options: ["has announced", "announced", "have announced", "announcing"],
    answer: 0,
    explain_id: "lama",
  };
  const raw = JSON.stringify({ passage: null, questions: [question] });
  const oldPrint = fingerprint(questionText({ ...question, q: "The committee ___ the winners yesterday." }));
  const edit = (patch: Partial<{ q: string; options: string[]; answer: number; explain: string }>) => ({
    passage: null,
    questions: [
      {
        q: "The committee ___ the winners yesterday.",
        options: question.options,
        answer: 0,
        explain: "Ada yesterday, jadi pakai past simple.",
        ...patch,
      },
    ],
  });

  it("mereset statistik saat kunci berubah dan menyimpan field lain", () => {
    const result = editBankItem(raw, edit({ answer: 1 }));
    assert.ok("item" in result);
    assert.deepEqual(result.resetPrints, [oldPrint]);
    const saved = JSON.parse(result.item);
    assert.equal(saved.questions[0].answer, 1);
    assert.equal(saved.questions[0].type, "structure");
  });

  it("tidak mereset kalau hanya penjelasan yang berubah", () => {
    const result = editBankItem(raw, edit({}));
    assert.ok("item" in result);
    assert.deepEqual(result.resetPrints, []);
  });

  it("menolak pilihan ganda, kunci di luar rentang, dan penjelasan pendek", () => {
    assert.ok("error" in editBankItem(raw, edit({ options: ["a", "A", "b", "c"] })));
    assert.ok("error" in editBankItem(raw, edit({ answer: 7 })));
    assert.ok("error" in editBankItem(raw, edit({ explain: "pendek" })));
    assert.ok("error" in editBankItem("{rusak", edit({})));
  });

  it("bacaan yang berubah mereset semua soal di bawahnya", () => {
    const withPassage = JSON.stringify({ passage: "Old text.", questions: [question] });
    const result = editBankItem(withPassage, { ...edit({}), passage: "New text." });
    assert.ok("item" in result);
    assert.equal(result.resetPrints.length, 1);
  });
});
