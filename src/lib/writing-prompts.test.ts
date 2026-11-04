import assert from "node:assert/strict";
import test from "node:test";

import {
  findPrompt,
  PROMPT_LEVELS,
  promptOfTheDay,
  randomUnusedPrompt,
  unusedPrompts,
  WRITING_PROMPTS,
} from "./writing-prompts";

test("katalog prompt punya id unik dan isi lengkap", () => {
  const ids = new Set(WRITING_PROMPTS.map((prompt) => prompt.id));
  assert.equal(ids.size, WRITING_PROMPTS.length);

  for (const prompt of WRITING_PROMPTS) {
    assert.match(prompt.id, /^[a-z0-9-]+$/, `id tidak valid: ${prompt.id}`);
    assert.ok(prompt.title.endsWith("?") || prompt.title.endsWith("."), `judul tidak utuh: ${prompt.id}`);
    assert.ok(prompt.topic.length > 0);
    assert.ok(prompt.hints.length >= 2, `hint terlalu sedikit: ${prompt.id}`);
    assert.ok(prompt.hints.every((hint) => hint.trim().length > 10));
    assert.ok(prompt.minWords >= 120 && prompt.minWords <= 700);
  }
});

test("setiap level punya cukup banyak prompt", () => {
  for (const level of PROMPT_LEVELS) {
    const count = WRITING_PROMPTS.filter((prompt) => prompt.level === level).length;
    assert.ok(count >= 10, `level ${level} hanya ${count} prompt`);
  }
});

test("target kata naik sesuai level", () => {
  const average = (level: (typeof PROMPT_LEVELS)[number]) => {
    const rows = WRITING_PROMPTS.filter((prompt) => prompt.level === level);
    return rows.reduce((sum, prompt) => sum + prompt.minWords, 0) / rows.length;
  };
  assert.ok(average("basic") < average("intermediate"));
  assert.ok(average("intermediate") < average("advanced"));
});

test("findPrompt mengembalikan prompt yang cocok saja", () => {
  const [first] = WRITING_PROMPTS;
  assert.equal(findPrompt(first.id), first);
  assert.equal(findPrompt("tidak-ada"), undefined);
  assert.equal(findPrompt(null), undefined);
});

test("promptOfTheDay stabil untuk pengguna dan tanggal yang sama", () => {
  const a = promptOfTheDay(7, "2026-11-04");
  const b = promptOfTheDay(7, "2026-11-04");
  assert.equal(a.id, b.id);
  assert.ok(WRITING_PROMPTS.includes(a));
});

test("promptOfTheDay berganti sepanjang bulan", () => {
  const ids = new Set(
    Array.from({ length: 30 }, (_, day) =>
      promptOfTheDay(3, `2026-11-${String(day + 1).padStart(2, "0")}`).id,
    ),
  );
  assert.ok(ids.size >= 10, `hanya ${ids.size} prompt berbeda dalam 30 hari`);
});

test("unusedPrompts membuang judul yang sudah ditulis", () => {
  const used = [WRITING_PROMPTS[0].title, WRITING_PROMPTS[1].title.toUpperCase()];
  const left = unusedPrompts(used);
  assert.equal(left.length, WRITING_PROMPTS.length - 2);
  assert.ok(!left.some((prompt) => prompt.id === WRITING_PROMPTS[0].id));
  assert.ok(!left.some((prompt) => prompt.id === WRITING_PROMPTS[1].id));
});

test("randomUnusedPrompt memilih dari sisa, atau seluruh katalog kalau habis", () => {
  const used = WRITING_PROMPTS.slice(0, 5).map((prompt) => prompt.title);
  const picked = randomUnusedPrompt(used, () => 0);
  assert.ok(!used.includes(picked.title));

  const allUsed = WRITING_PROMPTS.map((prompt) => prompt.title);
  const fallback = randomUnusedPrompt(allUsed, () => 0.5);
  assert.ok(WRITING_PROMPTS.includes(fallback));
});
