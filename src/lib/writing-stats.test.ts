import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findPromptByTitle, WRITING_PROMPTS } from "./writing-prompts";
import { summarizeTopics } from "./writing-stats";

const basicPrompt = WRITING_PROMPTS.find((prompt) => prompt.level === "basic")!;
const basicPrompt2 = WRITING_PROMPTS.filter((prompt) => prompt.level === "basic")[1];
const intermediatePrompt = WRITING_PROMPTS.find((prompt) => prompt.level === "intermediate")!;

describe("findPromptByTitle", () => {
  it("cocok walau spasi atau huruf besar-kecil berbeda", () => {
    assert.equal(findPromptByTitle(`  ${basicPrompt.title.toUpperCase()}  `)?.id, basicPrompt.id);
    assert.equal(findPromptByTitle(basicPrompt.title.replace(/ /g, "   "))?.id, basicPrompt.id);
  });

  it("mengembalikan undefined untuk topik bebas atau kosong", () => {
    assert.equal(findPromptByTitle("My own topic about cats"), undefined);
    assert.equal(findPromptByTitle("   "), undefined);
  });
});

describe("summarizeTopics", () => {
  it("menghitung topik bebas sebagai custom, bukan dibuang", () => {
    const stats = summarizeTopics([
      { prompt: "My own topic about cats", total: 70 },
      { prompt: "", total: 0 },
    ]);
    assert.equal(stats.matched, 0);
    assert.equal(stats.custom, 2);
    assert.equal(stats.promptsTried, 0);
    assert.deepEqual(stats.top, []);
  });

  it("mengagregasi jumlah, skor terbaik, dan tanggal terakhir per prompt", () => {
    const stats = summarizeTopics([
      { prompt: basicPrompt.title, total: 60, createdAt: "2026-11-01" },
      { prompt: basicPrompt.title, total: 82, createdAt: "2026-11-03" },
      { prompt: intermediatePrompt.title, total: 90, createdAt: "2026-11-02" },
    ]);
    assert.equal(stats.matched, 3);
    assert.equal(stats.promptsTried, 2);
    assert.equal(stats.top[0].prompt.id, basicPrompt.id);
    assert.equal(stats.top[0].count, 2);
    assert.equal(stats.top[0].best, 82);
    assert.equal(stats.top[0].last, "2026-11-03");
    assert.equal(stats.top[1].prompt.id, intermediatePrompt.id);
  });

  it("memakai skor esai, bukan skor terbaik, untuk rata-rata level", () => {
    const prompt = basicPrompt2 ?? basicPrompt;
    const stats = summarizeTopics([
      { prompt: prompt.title, total: 70 },
      { prompt: prompt.title, total: 90 },
    ]);
    const basic = stats.levels.find((level) => level.level === "basic")!;
    assert.equal(basic.essays, 2);
    assert.equal(basic.avg, 80);
    assert.equal(basic.best, 90);
    assert.equal(basic.promptsTried, 1);
    assert.equal(basic.promptsTotal, WRITING_PROMPTS.filter((item) => item.level === "basic").length);
    const advanced = stats.levels.find((level) => level.level === "advanced")!;
    assert.equal(advanced.essays, 0);
    assert.equal(advanced.avg, null);
  });

  it("mengabaikan esai tanpa skor dari rata-rata tapi tetap menghitung pemakaian", () => {
    const stats = summarizeTopics([{ prompt: basicPrompt.title, total: 0 }]);
    const basic = stats.levels.find((level) => level.level === "basic")!;
    assert.equal(basic.essays, 1);
    assert.equal(basic.avg, null);
    assert.equal(basic.best, null);
    assert.equal(stats.promptsTried, 1);
  });

  it("melaporkan total katalog", () => {
    const stats = summarizeTopics([]);
    assert.equal(stats.promptsTotal, WRITING_PROMPTS.length);
    assert.equal(stats.matched, 0);
    assert.equal(stats.custom, 0);
  });
});
