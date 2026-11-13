/** Bagian SpeechSynthesisVoice yang dipakai; memudahkan uji tanpa browser. */
export type VoiceInfo = { name: string; lang: string; voiceURI: string };

export const ACCENTS = ["any", "US", "GB", "AU"] as const;
export type Accent = (typeof ACCENTS)[number];

/**
 * Pengaturan suara Listening, diatur admin untuk semua pengguna. Suara berasal
 * dari perangkat tiap pengguna, jadi yang disimpan adalah nama (atau potongan
 * nama, mis. "Aria"); perangkat yang tidak punya suara itu memakai suara terbaik.
 */
export type VoicePrefs = {
  man: string;
  woman: string;
  accent: Accent;
  rate: number;
};

export const DEFAULT_PREFS: VoicePrefs = { man: "", woman: "", accent: "any", rate: 0.95 };
export const RATES = [0.8, 0.9, 0.95, 1, 1.1] as const;
export const ACCENT_LABEL: Record<Accent, string> = {
  any: "Bebas",
  US: "Amerika (US)",
  GB: "Inggris (UK)",
  AU: "Australia (AU)",
};

const MALE = /\bmale\b|david|mark|guy|daniel|james|george|ryan|andrew|brian|christopher|eric|roger|steffan|thomas|william|liam/i;
const FEMALE = /female|zira|aria|jenny|samantha|susan|hazel|libby|sonia|emma|ava|michelle|natasha|clara|olivia|ana\b|karen|moira|tessa/i;

/** Suara "Natural/Neural/Online" dan Google jauh lebih alami daripada suara standar. */
export function voiceQuality(voice: VoiceInfo) {
  let score = 0;
  if (/natural|neural|online|enhanced|premium/i.test(voice.name)) score += 4;
  if (/google/i.test(voice.name)) score += 2;
  if (/^en[-_]US/i.test(voice.lang)) score += 1;
  return score;
}

export function englishVoices<T extends VoiceInfo>(voices: T[]): T[] {
  return voices
    .filter((voice) => /^en([-_]|$)/i.test(voice.lang))
    .sort((a, b) => voiceQuality(b) - voiceQuality(a) || a.name.localeCompare(b.name));
}

function regionOf(voice: VoiceInfo) {
  return voice.lang.split(/[-_]/)[1]?.toUpperCase() ?? "";
}

/** Suara pria dan wanita: nama pilihan admin dulu, lalu suara terbaik dengan aksen yang diminta. */
export function pickVoices<T extends VoiceInfo>(voices: T[], prefs: VoicePrefs) {
  const english = englishVoices(voices);
  const accented = prefs.accent === "any" ? english : english.filter((voice) => regionOf(voice) === prefs.accent);
  const pool = accented.length ? accented : english;
  const byName = (wanted: string) => {
    const needle = wanted.trim().toLowerCase();
    return needle ? english.find((voice) => voice.name.toLowerCase().includes(needle)) : undefined;
  };
  const man = byName(prefs.man) ?? pool.find((voice) => MALE.test(voice.name)) ?? pool[0];
  const woman =
    byName(prefs.woman) ??
    pool.find((voice) => FEMALE.test(voice.name)) ??
    pool.find((voice) => voice !== man) ??
    pool[0];
  return { man, woman };
}

export function parsePrefs(raw: string | null | undefined): VoicePrefs {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<VoicePrefs>) : {};
    return {
      man: typeof value.man === "string" ? value.man.slice(0, 120) : "",
      woman: typeof value.woman === "string" ? value.woman.slice(0, 120) : "",
      accent: ACCENTS.includes(value.accent as Accent) ? (value.accent as Accent) : "any",
      rate: RATES.includes(value.rate as (typeof RATES)[number]) ? (value.rate as number) : DEFAULT_PREFS.rate,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Nama singkat untuk daftar pilihan, mis. "Aria (US) · alami". */
export function voiceLabel(voice: VoiceInfo) {
  const name = voice.name
    .replace(/^Microsoft\s+/i, "")
    .replace(/\s+Online \(Natural\)/i, "")
    .replace(/\s*-\s*English.*$/i, "");
  const region = regionOf(voice);
  return `${name}${region ? ` (${region})` : ""}${voiceQuality(voice) >= 4 ? " · alami" : ""}`;
}

type Line = { speaker: string; text: string };

let run = 0;
let current: HTMLAudioElement | null = null;
/** Settler untuk playback yang sedang berjalan; dipanggil stopSpeaking saat interupsi. */
const interrupters = new Set<() => void>();

/** Hentikan suara AI maupun suara browser. */
export function stopSpeaking() {
  run += 1;
  for (const interrupt of interrupters) interrupt();
  interrupters.clear();
  current?.pause();
  current = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Suara per pembicara: pria Charon, lainnya Kore. */
export const ttsVoice = (speaker: string) => (speaker === "man" ? "Charon" : "Kore");

/** Ambil audio satu baris dari /api/tts sebagai blob URL. */
async function fetchAi(line: Line) {
  const voice = ttsVoice(line.speaker);
  const response = await fetch(`/api/tts?voice=${voice}&text=${encodeURIComponent(line.text)}`);
  if (!response.ok) throw new Error("tts");
  return URL.createObjectURL(await response.blob());
}

let amp: AudioNode | null = null;

/** <audio> mentok di volume 1; lewat penguat + limiter suara bisa dikeraskan tanpa pecah. */
async function boost(audio: HTMLAudioElement) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!amp) {
      const ctx = new AC();
      const gain = ctx.createGain();
      gain.gain.value = 3;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      gain.connect(limiter).connect(ctx.destination);
      amp = gain;
    }
    const ctx = amp.context as AudioContext;
    if (ctx.state === "suspended") await ctx.resume();
    // Konteks tetap tertahan (kebijakan autoplay): biarkan <audio> memutar langsung.
    if (ctx.state !== "running") return;
    ctx.createMediaElementSource(audio).connect(amp);
  } catch {
    /* tanpa penguat: tetap diputar normal */
  }
}

async function playUrl(url: string, rate: number) {
  const audio = new Audio(url);
  audio.playbackRate = rate;
  await boost(audio);
  current = audio;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      audio.onended = null;
      audio.onpause = null;
      audio.onerror = null;
      interrupters.delete(interrupt);
      if (error) reject(error);
      else resolve();
    };
    // Interupsi (stopSpeaking / run baru) harus tetap menyelesaikan promise
    // supaya pemanggil bisa lanjut dan melepas blob URL-nya.
    const interrupt = () => settle();
    interrupters.add(interrupt);
    audio.onended = () => settle();
    audio.onpause = () => settle();
    audio.onerror = () => settle(new Error("tts"));
    audio.play().then(
      () => undefined,
      (error: unknown) => settle(error instanceof Error ? error : new Error("tts")),
    );
  });
}

/**
 * Bacakan baris dialog dengan suara AI (/api/tts). Semua baris diunduh paralel
 * dulu (onReady dipanggil begitu siap diputar), lalu diputar berurutan. Kalau
 * gagal atau TTS belum dikonfigurasi, dibacakan suara browser. Hanya di klien.
 */
export async function speakLines(lines: Line[], prefs: VoicePrefs, onEnd?: () => void, onReady?: () => void) {
  stopSpeaking();
  const id = run;
  let urls: string[];
  try {
    urls = await Promise.all(lines.map(fetchAi));
  } catch {
    onReady?.();
    if (id === run && "speechSynthesis" in window) browserSpeak(lines, prefs, onEnd);
    return;
  }
  onReady?.();
  if (id !== run) return urls.forEach((url) => URL.revokeObjectURL(url));
  let failed = false;
  for (const url of urls) {
    if (id !== run) break;
    try {
      await playUrl(url, prefs.rate);
    } catch {
      failed = true;
      break;
    }
  }
  urls.forEach((url) => URL.revokeObjectURL(url));
  if (id !== run) return;
  // Audio AI tidak bisa diputar (diblokir browser, format, dll.): jangan diam, bacakan dengan suara browser.
  if (failed && "speechSynthesis" in window) return browserSpeak(lines, prefs, onEnd);
  onEnd?.();
}

/** Bacakan baris-baris dialog dengan suara browser (cadangan). */
function browserSpeak(lines: Line[], prefs: VoicePrefs, onEnd?: () => void) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const { man, woman } = pickVoices(synth.getVoices(), prefs);

  for (const [position, line] of lines.entries()) {
    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.lang = "en-US";
    utterance.rate = prefs.rate;
    const isWoman = line.speaker === "woman" || line.speaker === "narrator";
    const voice = isWoman ? woman : man;
    if (voice) utterance.voice = voice;
    // Perangkat dengan satu suara: bedakan pria/wanita lewat nada.
    if (isWoman && (!woman || woman === man)) utterance.pitch = 1.4;
    if (position === lines.length - 1 && onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    synth.speak(utterance);
  }
}
