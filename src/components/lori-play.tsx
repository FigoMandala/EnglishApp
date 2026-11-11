"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Lori, type LoriMood } from "@/components/mascot";
import { cn } from "@/lib/utils";

const WALK_PX = 100;
const WALK_MS = 2600;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Gerakan klik: salto, lompat, muter (3D flip), atau melambai. h = tinggi lompatan dalam px. */
const TRICKS: { mood: LoriMood; ms: number; frames?: (h: number) => Keyframe[] }[] = [
  {
    mood: "cheer",
    ms: 1000,
    frames: (h) => [
      { transform: "translateY(0) rotate(0) scale(1,1)", offset: 0, easing: "ease-out" },
      { transform: "translateY(0) rotate(0) scale(1.12,.84)", offset: 0.14, easing: "ease-in-out" },
      { transform: `translateY(${-h}px) rotate(-180deg) scale(.97,1.04)`, offset: 0.5, easing: "ease-in" },
      { transform: "translateY(0) rotate(-360deg) scale(1.12,.84)", offset: 0.86, easing: "ease-out" },
      { transform: "translateY(0) rotate(-360deg) scale(1,1)", offset: 1 },
    ],
  },
  {
    mood: "cheer",
    ms: 700,
    frames: (h) => [
      { transform: "translateY(0) scale(1,1)", offset: 0, easing: "ease-out" },
      { transform: "translateY(0) scale(1.12,.84)", offset: 0.15, easing: "ease-in-out" },
      { transform: `translateY(${-h * 0.8}px) scale(.94,1.1)`, offset: 0.45, easing: "ease-in" },
      { transform: "translateY(0) scale(1.1,.88)", offset: 0.75, easing: "ease-out" },
      { transform: "translateY(0) scale(1,1)", offset: 1 },
    ],
  },
  {
    mood: "cheer",
    ms: 900,
    frames: (h) => [
      { transform: "perspective(500px) rotateY(0) translateY(0)", offset: 0, easing: "ease-in-out" },
      { transform: `perspective(500px) rotateY(180deg) translateY(${-h * 0.4}px)`, offset: 0.5, easing: "ease-in-out" },
      { transform: "perspective(500px) rotateY(360deg) translateY(0)", offset: 1 },
    ],
  },
  { mood: "wave", ms: 1800 },
];

/**
 * Lori (SVG maskot brand) yang interaktif: klik/tap/Enter → salto, lompat, muter, atau melambai;
 * sesekali jalan bolak-balik sendiri (klik saat jalan = berhenti, beraksi, lalu pulang).
 * Murni Web Animations API, tanpa dependensi. prefers-reduced-motion: tidak jalan sendiri,
 * klik hanya mengganti ekspresi.
 */
export function LoriPlay({
  size = 190,
  label = "Lori, maskot — klik untuk melihat aksinya",
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  const [mood, setMood] = useState<LoriMood>("idle");
  const [touched, setTouched] = useState(false);
  const mover = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);
  const walking = useRef(false);
  const timers = useRef<number[]>([]);
  const stepAnim = useRef<Animation | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  /** Gerakan selesai: bersihkan timer, geser pelan ke posisi awal (kalau sempat bergeser), kembali idle. */
  const finish = useCallback(() => {
    timers.current.length = 0;
    walking.current = false;
    busy.current = false;
    setMood("idle");
    const m = mover.current;
    if (m) {
      m.style.transition = "transform 900ms ease-out";
      m.style.transform = "translateX(0px)";
    }
  }, []);

  const trick = useCallback(() => {
    setTouched(true);
    if (busy.current) {
      if (!walking.current) return; // sedang salto/lompat: abaikan klik beruntun
      // sedang jalan: berhenti di tempat, lalu beraksi
      timers.current.forEach(window.clearTimeout);
      timers.current.length = 0;
      stepAnim.current?.cancel();
      walking.current = false;
      const m = mover.current;
      if (m) {
        const now = getComputedStyle(m).transform; // bekukan di posisi sekarang
        m.style.transition = "none";
        m.style.transform = now === "none" ? "translateX(0px)" : now;
      }
    }
    busy.current = true;
    const t = TRICKS[Math.floor(Math.random() * TRICKS.length)];
    setMood(t.mood);
    const frames = t.frames?.(size * 0.5);
    if (frames && !reduced()) body.current?.animate(frames, { duration: t.ms });
    later(finish, reduced() ? 900 : t.ms + 50);
  }, [finish, later, size]);

  const walk = useCallback(() => {
    const m = mover.current;
    const b = body.current;
    if (busy.current || !m || !b || reduced()) return;
    busy.current = true;
    walking.current = true;
    const leg = (toX: number) => {
      m.style.transition = `transform ${WALK_MS}ms linear`;
      m.style.transform = `translateX(${toX}px)`;
      setMood("wave");
      // goyang langkah: naik-turun + miring kiri-kanan
      stepAnim.current = b.animate(
        [
          { transform: "translateY(0) rotate(-3deg)" },
          { transform: `translateY(${-size * 0.04}px) rotate(3deg)` },
          { transform: "translateY(0) rotate(-3deg)" },
        ],
        { duration: 520, iterations: Infinity, easing: "ease-in-out" },
      );
    };
    const rest = () => {
      stepAnim.current?.cancel();
      setMood("idle");
    };
    leg(WALK_PX);
    later(() => {
      rest();
      later(() => {
        leg(0);
        later(() => {
          rest();
          finish();
        }, WALK_MS);
      }, 1500);
    }, WALK_MS);
  }, [finish, later, size]);

  // Jalan sendiri tiap 9–15 detik (tidak saat tab tersembunyi).
  useEffect(() => {
    let id = 0;
    const loop = () => {
      id = window.setTimeout(() => {
        if (!document.hidden) walk();
        loop();
      }, 9000 + Math.random() * 6000);
    };
    loop();
    return () => window.clearTimeout(id);
  }, [walk]);

  useEffect(() => {
    const pending = timers.current; // array yang sama selama komponen hidup (hanya dikosongkan, tak diganti)
    const step = stepAnim;
    return () => {
      pending.forEach(window.clearTimeout);
      step.current?.cancel();
    };
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={trick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          trick();
        }
      }}
      className={cn(
        "relative z-10 shrink-0 cursor-pointer select-none rounded-3xl outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-primary-line",
        className,
      )}
      style={{ width: size, height: size * 1.2 }}
    >
      <div ref={mover} className="absolute inset-x-0 bottom-0">
        <div ref={body} style={{ transformOrigin: "50% 60%" }}>
          <Lori mood={mood} size={size} />
        </div>
      </div>
      {!touched && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 inline-flex items-center gap-1 rounded-full bg-charcoal px-2 py-0.5 text-[0.625rem] font-extrabold tracking-wide text-white/90"
        >
          Klik aku!
        </span>
      )}
    </div>
  );
}
