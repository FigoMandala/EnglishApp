"use client";

import { useEffect, useRef, useState } from "react";

import { SpeakButton } from "@/components/speak-button";
import { cn } from "@/lib/utils";

import s from "./landing.module.css";

const STEPS = [
  {
    title: "Kamu menulis kalimat ini.",
    body: "Wajar banget. Di bahasa Indonesia “saya setuju” memang terasa butuh “saya adalah”. Kebanyakan aplikasi cuma membalas satu kata: salah.",
  },
  {
    title: "Lori membedahnya, pakai bahasa Indonesia.",
    body: "Bagian mana yang keliru, kenapa, dan contoh lain sampai kamu paham. Bukan kunci jawaban, bukan terjemahan mesin.",
  },
  {
    title: "Kesalahannya disimpan, bukan dibuang.",
    body: "Masuk Bank Kesalahan dan muncul lagi sampai kamu benar.",
  },
  {
    title: "Kata barunya jadi kartu.",
    body: "Kartu SRS dengan audio dan contoh kalimat. 4 tingkat ingatan menentukan kapan kartu kembali, tepat sebelum kamu lupa.",
  },
  {
    title: "Lalu hari tes datang.",
    body: "Simulasi TOEFL ITP dengan format dan timer asli: Listening, Structure & Written Expression, Reading. Di akhir ada perkiraan skor dan topik yang paling bocor.",
  },
];
const NUMBERS = ["①", "②", "③", "④", "⑤"];

const paperCard = "relative w-full max-w-[500px] rounded-[6px] bg-white shadow-[0_2px_0_#e2dacb,0_20px_40px_-24px_rgba(58,36,0,.5)]";
const hand = "font-[family-name:var(--font-hand)] font-bold";

/** Kalimat salah yang dicoret dan dibetulkan, mengikuti langkah yang sedang di tengah layar. */
export function LandingStory() {
  const [step, setStep] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const items = listRef.current?.querySelectorAll("[data-step]");
    if (!items || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(Number(e.target.getAttribute("data-step")));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function go(i: number) {
    listRef.current?.querySelector(`[data-step="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setStep(i);
  }

  const panel = (i: number) => ({
    className: cn(s.panel, i === step && s.on),
    "aria-hidden": i !== step,
    // Panel yang tak aktif tidak boleh bisa difokus (tombol suara di kartu SRS).
    inert: i !== step,
    style: {
      opacity: i === step ? 1 : 0,
      transform: i === step ? "translateY(0) scale(1)" : `translateY(${i < step ? -24 : 24}px) scale(.97)`,
    },
  });

  return (
    <div className={cn(s.story, "mt-9 flex gap-12")}>
      <div className={cn(s.stage, "sticky top-[72px] h-[560px] min-w-0 flex-[1_1_540px] self-start")}>
        <div className="relative size-full">
          {/* 0: kalimat salah */}
          <div {...panel(0)}>
            <div className={cn(paperCard, "-rotate-[1.2deg] px-9 py-11")}>
              <span className={s.tape} aria-hidden style={{ left: "40%", top: -14, transform: "rotate(3deg)" }} />
              <p className="text-[2.375rem] font-extrabold leading-[1.3]">
                I <span className={s.wavy}>am</span> agree with you.
              </p>
              <p className={cn(hand, "mt-[22px] -rotate-2 text-[1.75rem] text-brick")}>hmm… kedengarannya benar, kan?</p>
            </div>
          </div>

          {/* 1: dibedah */}
          <div {...panel(1)}>
            <div className={cn(paperCard, "-rotate-[1.2deg] px-9 pb-8 pt-[60px]")}>
              <p className="text-[2.375rem] font-extrabold leading-[1.3]">
                I{" "}
                <span className="relative inline-block">
                  am
                  <svg aria-hidden viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute -left-[12%] top-[40%] h-5 w-[124%] overflow-visible">
                    <path className={cn(s.pen, s.pStrike)} pathLength={1} d="M0 14 C 30 4, 60 16, 100 6" style={{ vectorEffect: "non-scaling-stroke" }} />
                  </svg>
                  <span className={cn(hand, s.pWrite, "absolute -left-2 -top-[46px] -rotate-[4deg] whitespace-nowrap text-[2.375rem] text-brick")}>hapus!</span>
                </span>{" "}
                agree with you.
              </p>
              <div className={cn(s.note, s.pNote, "mt-7 rotate-[1.5deg] px-[18px] py-4")}>
                <p className={cn(hand, "text-[1.5625rem] leading-[30px] text-mango-on")}>
                  “saya setuju” → I agree.
                  <br />
                  <u>agree</u> sudah kata kerja,
                  <br />
                  jadi nggak perlu am/is/are. — Lori
                </p>
              </div>
            </div>
          </div>

          {/* 2: bank kesalahan */}
          <div {...panel(2)}>
            <div className={cn(paperCard, "rotate-[.8deg] px-9 py-11")}>
              <p className="text-4xl font-extrabold leading-[1.3]">
                I <span className="text-primary">agree</span> with you.
              </p>
              <div className="absolute -top-[26px] right-6 -rotate-[9deg]">
                <span className={cn(s.stamp, s.pStamp, "bg-[rgba(253,250,243,.6)] text-xl")}>Bank Kesalahan</span>
              </div>
              <p className="mb-2.5 mt-[26px] text-[0.9375rem] font-extrabold uppercase tracking-[.08em] text-ink-subtle">Muncul lagi</p>
              <div className="flex flex-wrap gap-2">
                <span className={cn(s.pChip, s.c1, "rounded-full bg-brick-soft px-3.5 py-2 font-extrabold text-brick-deep")}>besok</span>
                <span className={cn(s.pChip, s.c2, "rounded-full bg-mango-soft px-3.5 py-2 font-extrabold text-mango-ink")}>3 hari lagi</span>
                <span className={cn(s.pChip, s.c3, "rounded-full bg-primary-soft px-3.5 py-2 font-extrabold text-primary-deep")}>sampai kamu benar</span>
              </div>
            </div>
          </div>

          {/* 3: kartu SRS */}
          <div {...panel(3)}>
            <div className={cn(s.pFlip, "relative flex w-full max-w-[420px] flex-col gap-3.5 rounded-[22px] border-2 border-hairline bg-white p-8 shadow-[0_6px_0_var(--color-hairline)]")}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold uppercase tracking-[.08em] text-ink-subtle">Kartu kosakata</span>
                <SpeakButton text="agree with" label="Dengarkan pengucapan “agree with”" />
              </div>
              <p className="font-display text-[2.875rem] font-black tracking-[-0.02em]">agree with</p>
              <p className="-mt-2 text-[1.0625rem] text-ink-subtle">/əˈɡriː wɪð/ · setuju dengan</p>
              <p className="rounded-[12px] bg-surface-muted px-3.5 py-3 text-lg leading-normal">
                I <strong>agree with</strong> your idea.
              </p>
              <div className="grid grid-cols-4 gap-2 text-center text-[0.9375rem] font-extrabold">
                <span className="rounded-[12px] bg-brick-soft py-2.5 text-brick-deep">Lupa</span>
                <span className="rounded-[12px] bg-mango-soft py-2.5 text-mango-ink">Sulit</span>
                <span className="rounded-[12px] bg-sky-soft py-2.5 text-sky-deep">Bisa</span>
                <span className="rounded-[12px] bg-primary-soft py-2.5 text-primary-deep">Mudah</span>
              </div>
            </div>
          </div>

          {/* 4: hari tes */}
          <div {...panel(4)}>
            <div className={cn(paperCard, "-rotate-[.6deg] px-9 py-8")}>
              <div className="flex justify-between border-b-2 border-hairline-soft pb-3.5 text-sm font-extrabold uppercase tracking-[.06em] text-ink-subtle">
                <span>TOEFL ITP · Structure 12</span>
                <span className="tabular-nums">⏱ 18:42</span>
              </div>
              <p className="mb-4 mt-5 text-2xl font-extrabold leading-[1.4]">Most members ______ with the new proposal.</p>
              <div className="flex flex-col gap-2.5 text-[1.1875rem] font-semibold">
                <span>(A) are agree</span>
                <span>(B) is agreeing</span>
                <span className="relative self-start">
                  (C) agree
                  <svg aria-hidden viewBox="0 0 160 50" preserveAspectRatio="none" className="absolute -left-3.5 -top-2.5 h-[calc(100%+20px)] w-[calc(100%+28px)] overflow-visible">
                    <path className={cn(s.pen, s.pCircle)} pathLength={1} d="M20 8 C 70 -4, 150 4, 152 24 C 154 44, 60 50, 16 40 C -6 34, 2 10, 34 6" />
                  </svg>
                </span>
                <span>(D) agreeing</span>
              </div>
              <svg aria-hidden width="70" height="60" viewBox="0 0 70 60" className="absolute bottom-10 right-[30px]">
                <path className={cn(s.pen, s.pTick)} pathLength={1} d="M6 32 L 24 52 L 64 6" style={{ strokeWidth: 7 }} />
              </svg>
              <p className={cn(hand, s.pNote, "mt-3.5 text-[1.6875rem] text-brick")}>dulu salah, sekarang refleks!</p>
            </div>
          </div>

          {/* titik progres */}
          <div className="absolute inset-x-0 -bottom-2 flex justify-center gap-0.5">
            {STEPS.map((_, i) => (
              <button key={i} type="button" className={s.dot} onClick={() => go(i)} aria-label={`Langkah ${i + 1}`} aria-current={i === step ? "step" : undefined}>
                <span
                  className="block h-2.5 rounded-full transition-[width,background-color] duration-300 [transition-timing-function:var(--ease-spring)]"
                  style={{ width: i === step ? 28 : 10, background: i === step ? "#c2462b" : "#d6c8ae" }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <ol ref={listRef} className="m-0 min-w-0 flex-[1_1_400px] list-none p-0">
        {STEPS.map((item, i) => (
          <li
            key={item.title}
            data-step={i}
            className="flex min-h-[560px] flex-col justify-center gap-3 transition-opacity duration-[400ms]"
            style={{ opacity: i === step ? 1 : 0.35 }}
          >
            <span className={cn(hand, "text-[2.125rem] text-brick")} aria-hidden>
              {NUMBERS[i]}
            </span>
            <h3 className="font-display text-[2.125rem] font-black leading-[1.15] tracking-normal">{item.title}</h3>
            <p className="text-[1.1875rem] leading-9 text-ink-muted">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
