import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_PREFS, englishVoices, parsePrefs, pickVoices, voiceLabel, type VoiceInfo } from "./voices";

const v = (name: string, lang = "en-US"): VoiceInfo => ({ name, lang, voiceURI: name });

const VOICES = [
  v("Microsoft David - English (United States)"),
  v("Microsoft Zira - English (United States)"),
  v("Microsoft Guy Online (Natural) - English (United States)"),
  v("Microsoft Aria Online (Natural) - English (United States)"),
  v("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB"),
  v("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB"),
  v("Google Bahasa Indonesia", "id-ID"),
];

describe("englishVoices", () => {
  it("hanya bahasa Inggris, suara alami paling atas", () => {
    const list = englishVoices(VOICES);
    assert.equal(list.length, 6);
    assert.match(list[0].name, /Online \(Natural\)/);
  });
});

describe("pickVoices", () => {
  it("otomatis memilih suara alami pria dan wanita", () => {
    const { man, woman } = pickVoices(VOICES, DEFAULT_PREFS);
    assert.match(man.name, /Guy Online/);
    assert.match(woman.name, /Aria Online/);
  });

  it("nama pilihan admin cocok dengan potongan nama", () => {
    const { woman } = pickVoices(VOICES, { ...DEFAULT_PREFS, woman: "sonia" });
    assert.match(woman.name, /Sonia/);
  });

  it("aksen UK memilih suara UK saat nama tidak diatur", () => {
    const { man, woman } = pickVoices(VOICES, { ...DEFAULT_PREFS, accent: "GB" });
    assert.match(man.name, /Ryan/);
    assert.match(woman.name, /Sonia/);
  });

  it("nama yang tidak ada di perangkat jatuh ke suara terbaik", () => {
    const { man } = pickVoices(VOICES, { ...DEFAULT_PREFS, man: "tidak-ada" });
    assert.match(man.name, /Guy Online/);
  });

  it("perangkat dengan satu suara tetap bisa bicara", () => {
    const { man, woman } = pickVoices([v("Samantha")], { ...DEFAULT_PREFS, accent: "AU" });
    assert.equal(man.name, "Samantha");
    assert.equal(woman.name, "Samantha");
  });
});

describe("parsePrefs dan voiceLabel", () => {
  it("nilai rusak kembali ke default, nilai asing dibatasi", () => {
    assert.deepEqual(parsePrefs("rusak"), DEFAULT_PREFS);
    assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
    const parsed = parsePrefs(JSON.stringify({ rate: 5, accent: "XX", man: "Guy" }));
    assert.equal(parsed.rate, DEFAULT_PREFS.rate);
    assert.equal(parsed.accent, "any");
    assert.equal(parsed.man, "Guy");
  });

  it("label ringkas dengan tanda suara alami", () => {
    assert.equal(voiceLabel(VOICES[3]), "Aria (US) · alami");
    assert.equal(voiceLabel(VOICES[0]), "David (US)");
  });
});
