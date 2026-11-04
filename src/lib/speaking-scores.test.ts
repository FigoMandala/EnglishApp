import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SPEAKING_PROMPTS } from "./speaking-prompts";
import { averageBest, normalizeSpeakingBest, recordSpeakingScore, triedTopicCount } from "./speaking-scores";

const IDS = SPEAKING_PROMPTS.map((prompt) => prompt.id);

describe("skor terbaik speaking", () => {
  it("menyimpan skor baru untuk topik yang belum pernah dicoba", () => {
    assert.deepEqual(recordSpeakingScore({}, "morning-routine", 72), { "morning-routine": 72 });
  });

  it("hanya menimpa kalau skornya lebih tinggi", () => {
    const first = recordSpeakingScore({}, "morning-routine", 80);
    assert.equal(recordSpeakingScore(first, "morning-routine", 60), first);
    assert.deepEqual(recordSpeakingScore(first, "morning-routine", 91), { "morning-routine": 91 });
  });

  it("membulatkan dan menjepit skor ke 0–100", () => {
    assert.deepEqual(recordSpeakingScore({}, "free-time", 84.6), { "free-time": 85 });
    assert.deepEqual(recordSpeakingScore({}, "free-time", 140), { "free-time": 100 });
    assert.deepEqual(recordSpeakingScore({}, "free-time", -3), { "free-time": 0 });
  });

  it("mengabaikan id kosong dan skor tidak valid", () => {
    assert.deepEqual(recordSpeakingScore({}, "  ", 50), {});
    assert.deepEqual(recordSpeakingScore({}, "free-time", Number.NaN), {});
    assert.deepEqual(recordSpeakingScore({}, "free-time", Number.POSITIVE_INFINITY), {});
  });

  it("tidak mengubah objek asal", () => {
    const best = { "free-time": 50 };
    recordSpeakingScore(best, "free-time", 70);
    assert.deepEqual(best, { "free-time": 50 });
  });

  it("menghitung topik yang sudah dicoba dan rata-rata terbaik", () => {
    const best = { "free-time": 60, "morning-routine": 90, "tidak-ada": 100 };
    assert.equal(triedTopicCount(best, IDS), 2);
    assert.equal(averageBest(best, IDS), 75);
    assert.equal(averageBest({}, IDS), null);
  });

  it("membersihkan data rusak dari pengaturan", () => {
    assert.deepEqual(normalizeSpeakingBest(null, IDS), {});
    assert.deepEqual(normalizeSpeakingBest("bukan objek", IDS), {});
    assert.deepEqual(normalizeSpeakingBest([1, 2], IDS), {});
    assert.deepEqual(
      normalizeSpeakingBest({ "free-time": "80", "morning-routine": 77.4, hilang: 90, "study-habits": 400 }, IDS),
      { "morning-routine": 77, "study-habits": 100 },
    );
  });
});
