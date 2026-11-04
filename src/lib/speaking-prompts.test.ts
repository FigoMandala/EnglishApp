import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SPEAKING_PROMPTS, speakingPromptsAt } from "./speaking-prompts";
import { PROMPT_LEVELS } from "./writing-prompts";

describe("katalog prompt speaking", () => {
  it("punya id unik dan isi lengkap", () => {
    const ids = new Set(SPEAKING_PROMPTS.map((prompt) => prompt.id));
    assert.equal(ids.size, SPEAKING_PROMPTS.length);
    for (const prompt of SPEAKING_PROMPTS) {
      assert.ok(prompt.title.trim().length > 0, `${prompt.id} tanpa judul`);
      assert.ok(prompt.topic.trim().length > 0, `${prompt.id} tanpa topik`);
      assert.ok(prompt.brief.trim().length > 0, `${prompt.id} tanpa arahan`);
      assert.ok(prompt.sentences.length >= 5, `${prompt.id} kurang dari 5 kalimat`);
    }
  });

  it("menyediakan minimal 4 topik untuk tiap level", () => {
    for (const level of PROMPT_LEVELS) {
      assert.ok(speakingPromptsAt(level).length >= 4, `level ${level} kurang topik`);
    }
  });

  it("tiap kalimat punya bahasa Inggris, terjemahan, dan kata fokus", () => {
    for (const prompt of SPEAKING_PROMPTS) {
      for (const sentence of prompt.sentences) {
        assert.match(sentence.en, /^[A-Z]/, `kalimat tidak diawali huruf besar: ${sentence.en}`);
        assert.match(sentence.en, /[.!?]$/, `kalimat tanpa tanda akhir: ${sentence.en}`);
        assert.ok(sentence.id.trim().length > 0, `terjemahan kosong: ${sentence.en}`);
        assert.ok(sentence.focus.trim().length > 0, `fokus kosong: ${sentence.en}`);
      }
    }
  });

  it("tidak menduplikasi kalimat antar topik", () => {
    const all = SPEAKING_PROMPTS.flatMap((prompt) => prompt.sentences.map((sentence) => sentence.en.toLowerCase()));
    assert.equal(new Set(all).size, all.length);
  });

  it("speakingPromptsAt hanya mengembalikan level yang diminta", () => {
    for (const prompt of speakingPromptsAt("advanced")) {
      assert.equal(prompt.level, "advanced");
    }
    assert.equal(
      speakingPromptsAt("basic").length + speakingPromptsAt("intermediate").length + speakingPromptsAt("advanced").length,
      SPEAKING_PROMPTS.length,
    );
  });
});
