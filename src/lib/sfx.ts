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

/** [frekuensi Hz, mulai (detik), durasi (detik)] */
type Note = [number, number, number];

function play(notes: Note[], type: OscillatorType = "sine", volume = 0.5) {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime;
  for (const [freq, at, dur] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.02);
  }
}

export const sfx = {
  tap: () => play([[520, 0, 0.06]], "triangle", 0.3),
  correct: () => play([[660, 0, 0.12], [880, 0.1, 0.2]]),
  wrong: () => play([[220, 0, 0.18], [165, 0.14, 0.26]], "sawtooth", 0.22),
  levelUp: () => play([[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]], "triangle", 0.45),
};
