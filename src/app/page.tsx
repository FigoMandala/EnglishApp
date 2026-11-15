import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";
import { SITE_CLOSED } from "@/lib/site-lock";
import { cn } from "@/lib/utils";

import { LandingStory } from "./landing-story";
import s from "./landing.module.css";

export const metadata = { title: "EnglishApp · Persiapan TOEFL ITP, TOEFL & ngobrol sehari-hari" };

const ROWS = [
  { a: "“Salah. Jawaban yang benar: B.” Lalu lanjut soal berikutnya.", b: "Dibedah pakai bahasa Indonesia", c: "Bagian mana yang keliru, kenapa, dan contoh lain sampai paham." },
  { a: "Soal yang salah hilang begitu saja.", b: "Bank Kesalahan", c: "Yang pernah salah muncul lagi sampai kamu benar." },
  { a: "Tutor AI langsung kasih jawabannya.", b: "Lori menuntun, nggak membocorkan", c: "Kamu yang menemukan jawabannya, jadi nempel lebih lama." },
  { a: "Latihan umum yang nggak kenal tesmu.", b: "Simulasi TOEFL ITP sungguhan", c: "Format dan timer asli, audio diputar sekali, ada perkiraan skor 310–677." },
  { a: "Streak putus, kamu merasa bersalah.", b: "Pelindung streak & akhir pekan santai", c: "Liga mingguannya juga adil: lawanmu selevel." },
  { a: "Wajib daftar sebelum boleh mencoba.", b: "Akun dibuat di langkah terakhir", c: "Dan datamu bisa diekspor kapan saja, sesuai UU PDP." },
];

const hand = "font-[family-name:var(--font-hand)] font-bold";
const kicker = cn(hand, s.reveal, "text-[1.875rem] leading-9 text-brick");
const h2 = cn(s.reveal, "font-display text-[2.125rem] font-black leading-[48px] tracking-[-0.03em] min-[901px]:text-[3.125rem] min-[901px]:leading-[72px]");

function StartButtons() {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-[18px]">
      {SITE_CLOSED ? (
        <span className={s.btnOff}>
          <Lock className="bob size-5" aria-hidden />
          Segera hadir
        </span>
      ) : (
        <Link href="/mulai/tujuan" className={s.btn}>
          Mulai belajar, gratis
          <ArrowRight className="size-[22px]" strokeWidth={2.8} aria-hidden />
        </Link>
      )}
      <Link href="/login" className={s.scrib}>
        {SITE_CLOSED ? "masuk admin →" : "aku sudah punya akun →"}
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/toefl");

  return (
    <div className="overflow-x-clip bg-[#e3d6bd] px-4 pb-20 pt-7 text-ink sm:px-6">
      {SITE_CLOSED ? (
        <div
          role="status"
          className="rise mx-auto mb-6 flex max-w-[1180px] items-center justify-center gap-2.5 rounded-[14px] bg-mango px-4 py-2.5 text-center text-[0.9375rem] font-extrabold text-mango-on"
        >
          <Lock className="bob size-4 shrink-0" aria-hidden />
          Aplikasi sedang dalam tahap pengembangan. Pendaftaran belum dibuka, hanya admin yang bisa masuk.
        </div>
      ) : null}

      <header className="mx-auto mb-16 flex max-w-[1180px] items-center">
        <Logo href="/" size={42} />
      </header>

      <div className="relative mx-auto max-w-[1180px]">
        <div className={s.under} aria-hidden />

        <main className={s.paper}>
          <nav className={s.tabs} aria-label="Navigasi landing">
            <a className={s.tab} href="#cerita" style={{ right: 300, background: "#a9c3f2", color: "#163b85" }}>
              Ceritanya
            </a>
            <a className={s.tab} href="#beda" style={{ right: 168, background: "#f2c878", color: "#3a2400" }}>
              Bedanya
            </a>
            <Link className={s.tab} href="/login" style={{ right: 40, background: "#1e7a4c", color: "#fff" }}>
              Masuk
            </Link>
          </nav>

          <div className={s.inner}>
            {/* kepala lembar */}
            <div className={cn(s.enter, "flex h-9 flex-wrap items-end gap-x-12 text-base text-ink-subtle")}>
              <span>
                Nama: <span className={cn(hand, "px-2.5 text-[1.625rem] text-sky-deep")}>kamu</span>
              </span>
              <span>
                Tujuan: <span className={cn(hand, "px-2.5 text-[1.625rem] text-sky-deep")}>lulus TOEFL ITP, lancar ngobrol</span>
              </span>
            </div>

            {/* HERO */}
            <section className="relative min-h-[560px] pt-[72px] min-[901px]:min-h-[720px]">
              <h1 className={cn(s.enter, s.d1, "max-w-[760px] text-[2.875rem] font-black leading-[56px] tracking-[-0.035em] min-[901px]:text-[4.75rem] min-[901px]:leading-[108px]")}>
                Bahasa Inggris yang{" "}
                <span className="relative inline-block text-ink-faint">
                  cuma dinilai
                  <span className="sr-only"> (dicoret)</span>
                  <svg aria-hidden viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute -left-[4%] top-[38%] h-[30px] w-[108%] overflow-visible">
                    <path className={cn(s.pen, s.strike)} pathLength={1} d="M0 12 C 20 6, 40 14, 60 8 S 90 10, 100 6" style={{ vectorEffect: "non-scaling-stroke", strokeWidth: 6 }} />
                  </svg>
                </span>{" "}
                <span className={cn(hand, s.write, "inline-block -translate-y-1.5 -rotate-3 pr-2 text-[3.625rem] tracking-normal text-brick min-[901px]:text-[5.75rem]")}>
                  dijelaskan.
                </span>
              </h1>
              <p className={cn(s.enter, s.d3, "mt-9 max-w-[560px] text-xl leading-9 text-ink-muted")}>
                Dibuat untuk pelajar Indonesia yang masih kesulitan dengan bahasa Inggris, dari tugas sampai tes TOEFL ITP. Lori bukan
                sekadar mentor yang menilai: dia membedah lebih dalam apa yang sebenarnya perlu kamu pelajari, <strong>pakai bahasa Indonesia</strong>.
              </p>
              <div className={cn(s.enter, s.d4, "mt-9")}>
                <StartButtons />
              </div>
              <p className={cn(hand, s.enter, s.d5, "mt-9 max-w-[480px] -rotate-[1.5deg] text-[1.625rem] leading-[30px] text-sky-deep")}>
                p.s. app ini lahir karena developernya sendiri nggak bisa bahasa Inggris. serius. wkwk
              </p>

              {/* sticky note */}
              <div className={cn(s.note, s.enter, s.d5, "absolute left-[600px] top-[520px] hidden w-[230px] rotate-3 px-5 pb-[18px] pt-[26px] min-[901px]:block")}>
                <span className={s.tape} aria-hidden style={{ left: 60, top: -14, transform: "rotate(-4deg)" }} />
                <p className={cn(hand, "text-[1.625rem] leading-[30px] text-mango-on")}>
                  simulasi TOEFL ITP ✓<br />
                  dijelaskan pakai bahasa Indonesia ✓<br />
                  gratis, 5 menit sehari ✓
                </p>
              </div>

              {/* Lori + bisikan */}
              <div className={cn(s.loriHero, s.enter, s.d5, "absolute -right-5 top-[120px] flex w-[280px] flex-col items-center")}>
                <p className={cn(hand, "mb-1 ml-10 -rotate-[4deg] text-[1.75rem] leading-[30px] text-sky-deep")}>
                  psst… scroll ke bawah,
                  <br />
                  Lori ceritain
                </p>
                <svg className={s.bob} width="60" height="52" viewBox="0 0 60 52" aria-hidden style={{ marginLeft: -90 }}>
                  <path className={s.ink} d="M8 4 C 30 8, 40 22, 36 44 M 26 36 L 36 46 L 46 36" />
                </svg>
                <svg viewBox="0 0 200 200" width="240" height="240" role="img" aria-label="Lori memegang pena merah">
                  <ellipse cx="100" cy="192" rx="56" ry="7" fill="#1B1F22" opacity=".12" />
                  <g className={s.breathe}>
                    <ellipse cx="52" cy="150" rx="13" ry="24" fill="#B87842" transform="rotate(18 52 150)" />
                    <ellipse cx="100" cy="148" rx="56" ry="44" fill="#C98B52" />
                    <ellipse cx="100" cy="158" rx="34" ry="29" fill="#F6E4C6" />
                    <ellipse cx="78" cy="188" rx="15" ry="7" fill="#B87842" />
                    <ellipse cx="122" cy="188" rx="15" ry="7" fill="#B87842" />
                    <path d="M58 120 Q100 138 142 120 L144 132 Q100 150 56 132 Z" fill="#1E7A4C" />
                    <circle cx="56" cy="44" r="15" fill="#C98B52" />
                    <circle cx="56" cy="44" r="7" fill="#8A5530" />
                    <circle cx="144" cy="44" r="15" fill="#C98B52" />
                    <circle cx="144" cy="44" r="7" fill="#8A5530" />
                    <ellipse cx="100" cy="78" rx="58" ry="52" fill="#C98B52" />
                    <ellipse cx="100" cy="92" rx="46" ry="35" fill="#F6E4C6" />
                    <ellipse cx="76" cy="78" rx="21" ry="25" fill="#6E4024" transform="rotate(-18 76 78)" />
                    <ellipse cx="124" cy="78" rx="21" ry="25" fill="#6E4024" transform="rotate(18 124 78)" />
                    <path d="M95 30 Q100 27 105 30 L104 98 L96 98 Z" fill="#F6E4C6" />
                    <g className={s.blink}>
                      <circle cx="77" cy="80" r="14" fill="#FFFFFF" />
                      <circle cx="123" cy="80" r="14" fill="#FFFFFF" />
                      <circle cx="75" cy="82" r="9" fill="#1B1F22" />
                      <circle cx="121" cy="82" r="9" fill="#1B1F22" />
                      <circle cx="78" cy="78" r="3" fill="#FFFFFF" />
                      <circle cx="124" cy="78" r="3" fill="#FFFFFF" />
                    </g>
                    <ellipse cx="100" cy="103" rx="6" ry="4.5" fill="#3A2416" />
                    <path className={s.line} d="M89 111 Q100 122 111 111" />
                    <circle cx="63" cy="104" r="7" fill="#F08A7A" opacity=".5" />
                    <circle cx="137" cy="104" r="7" fill="#F08A7A" opacity=".5" />
                    <g className={s.wave}>
                      <rect x="150" y="70" width="9" height="52" rx="3" fill="#c2462b" transform="rotate(-30 154 122)" />
                      <rect x="150" y="70" width="9" height="10" rx="3" fill="#8a2e17" transform="rotate(-30 154 122)" />
                      <ellipse cx="154" cy="122" rx="12" ry="24" fill="#B87842" transform="rotate(-38 154 122)" />
                    </g>
                  </g>
                </svg>
              </div>
            </section>

            {/* CERITA */}
            <section id="cerita" className="pt-[72px]">
              <p className={kicker}>Ceritanya begini…</p>
              <h2 className={cn(h2, "max-w-[720px]")}>Satu kalimat salah, dari awal sampai hari tes.</h2>
              <LandingStory />
            </section>

            {/* BEDANYA */}
            <section id="beda" className="relative pt-[108px]">
              <p className={kicker}>Jujur aja, bedanya di mana?</p>
              <h2 className={cn(h2, "max-w-[820px]")}>Aplikasi luar dibuat untuk semua orang. Ini dibuat untuk kamu.</h2>
              <p className={cn(s.reveal, "mb-9 max-w-[640px] text-[1.1875rem] leading-9 text-ink-muted")}>
                Lori mengoreksi kebiasaan aplikasi bahasa Inggris pada umumnya. Coretan merah = yang kami tinggalkan.
              </p>

              <div role="table" aria-label="Perbandingan dengan aplikasi pada umumnya" className="max-w-[940px]">
                <div role="row" className={cn(s.reveal, "grid grid-cols-2 gap-8 border-b-[3px] border-ink pb-2.5")}>
                  <span role="columnheader" className="text-sm font-extrabold uppercase tracking-[.1em] text-ink-faint">
                    Aplikasi pada umumnya
                  </span>
                  <span role="columnheader" className="text-sm font-extrabold uppercase tracking-[.1em] text-primary">
                    Di EnglishApp
                  </span>
                </div>
                {ROWS.map((r) => (
                  <div key={r.b} role="row" className={cn(s.reveal, "relative grid grid-cols-2 items-start gap-8 border-b-2 border-dashed border-hairline py-[18px]")}>
                    <span role="cell" className="text-lg leading-9 text-ink-faint line-through decoration-brick decoration-[3px]">
                      {r.a}
                    </span>
                    <span role="cell" className="flex items-start gap-3">
                      <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden className="mt-0.5 flex-none">
                        <path className={cn(s.pen, s.tick)} pathLength={1} d="M6 20 L 16 31 L 36 6" style={{ stroke: "#1e7a4c", strokeWidth: 5 }} />
                      </svg>
                      <span className="flex flex-col">
                        <strong className="font-display text-[1.375rem] font-extrabold leading-9">{r.b}</strong>
                        <span className="text-[1.0625rem] leading-[30px] text-ink-muted">{r.c}</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Anotasi di alur normal (bukan absolut) supaya tidak menimpa baris tabel di lebar mana pun. */}
              <div aria-hidden className={cn(s.reveal, "mt-3 flex max-w-[940px] items-start justify-end gap-2")}>
                <p className={cn(hand, "mt-3 -rotate-2 text-[1.75rem] leading-[30px] text-sky-deep")}>Lori sengaja nggak kasih contekan</p>
                <svg width="48" height="56" viewBox="0 0 48 56" className="shrink-0">
                  <path className={s.ink} d="M30 52 C 40 36, 38 18, 14 6 M 14 6 L 28 8 M 14 6 L 18 20" />
                </svg>
              </div>

              <p className={cn(s.reveal, "mt-9 max-w-[760px] text-[1.0625rem] leading-9 text-ink-muted")}>
                <span className={cn(hand, "text-[1.625rem] text-sky-deep")}>juga ada:</span> jalur belajar bertahap dengan tes penempatan · Writing Coach
                dengan skor per aspek · role-play interview sampai check-in hotel · listening yang bisa diperlambat · latihan speaking.
              </p>
            </section>

            {/* PENUTUP */}
            <section className="flex flex-wrap items-center gap-10 pb-9 pt-[108px]">
              <div className={cn(s.reveal, "flex min-w-0 flex-[1_1_460px] flex-col gap-6")}>
                <h2 className="font-display text-[2.5rem] font-black leading-[56px] tracking-[-0.035em] min-[901px]:text-[3.5rem] min-[901px]:leading-[72px]">
                  Lembar berikutnya punya kamu.
                </h2>
                <p className="max-w-[520px] text-xl leading-9 text-ink-muted">
                  Jawab beberapa pertanyaan singkat, Lori pilihkan titik mulai yang pas. Akun dibuat di langkah terakhir.
                </p>
                <StartButtons />
              </div>
              <div className={cn(s.reveal, "relative flex size-[260px] flex-none items-center justify-center")} aria-hidden>
                <span className="absolute inset-0 -rotate-[8deg] rounded-full border-[5px] border-brick mix-blend-multiply" />
                <span className="absolute inset-3.5 -rotate-[8deg] rounded-full border-2 border-brick mix-blend-multiply" />
                <p className="-rotate-[8deg] text-center font-display text-lg font-black uppercase leading-[1.3] tracking-[.1em] text-brick">
                  Nilai akhir
                  <span className={cn(hand, "block text-[4rem] normal-case leading-none tracking-normal")}>siap!</span>— Lori
                </p>
              </div>
            </section>

            <p className={cn(hand, "mt-9 text-center text-2xl text-ink-faint")}>hal. 1</p>
          </div>
        </main>
      </div>
    </div>
  );
}
