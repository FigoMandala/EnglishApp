"use client";

/**
 * Efek suara kecil lewat WebAudio (tanpa file, jadi CSP tidak perlu media-src).
 * Pilihan hidup/mati disimpan per perangkat di localStorage.
 */

const KEY = "ea-sfx";

export function sfxEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSfxEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* mode privat: abaikan */
  }
}

let ctx: AudioContext | null = null;
let master: AudioNode | null = null;

/** [frekuensi Hz, mulai (detik), durasi (detik)] */
type Note = [number, number, number];

/** Satu nada = dasar + overtone (gaya marimba/lonceng): serangan cepat, peluruhan alami. */
function voice(c: AudioContext, out: AudioNode, freq: number, at: number, dur: number, vol: number, partials: [number, number][]) {
  for (const [mult, amt] of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol * amt, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur / mult ** 0.5);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

const BELL: [number, number][] = [[1, 1], [2, 0.35], [3, 0.12]];
const SOFT: [number, number][] = [[1, 1], [2, 0.15]];

function play(notes: Note[], partials = BELL, volume = 0.6) {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    // Penguat + limiter: keras tanpa clipping.
    const amp = ctx.createGain();
    amp.gain.value = 4;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2;
    lim.knee.value = 6;
    lim.ratio.value = 12;
    amp.connect(lim).connect(ctx.destination);
    master = amp;
  }
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime;
  for (const [freq, at, dur] of notes) voice(ctx, master!, freq, t0 + at, dur, volume, partials);
}

export const sfx = {
  tap: () => play([[880, 0, 0.07]], SOFT, 0.35),
  correct: () => play([[784, 0, 0.25], [1175, 0.09, 0.45]]),
  wrong: () => play([[196, 0, 0.3], [165, 0.12, 0.4]], SOFT, 0.7),
  levelUp: () => play([[523, 0, 0.3], [659, 0.1, 0.3], [784, 0.2, 0.3], [1047, 0.3, 0.7], [1319, 0.42, 0.8]], BELL, 0.5),
};
