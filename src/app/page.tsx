import { ArrowRight, GraduationCap, Lightbulb, MessageCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Kaka, Lori } from "@/components/mascot";
import { getCurrentUser } from "@/lib/session";

const FLOATING = [
  { text: "have been", cls: "left-[4%] top-[12%] border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)]", r: "-6deg", d: "0s" },
  { text: "however", cls: "right-[2%] top-[8%] border-[#f2c878] bg-mango-soft text-mango-ink shadow-[0_4px_0_#f2c878]", r: "5deg", d: "-1.5s" },
  { text: "since 2019", cls: "bottom-[22%] left-0 border-[#9fd0b3] bg-primary-soft text-primary-deep shadow-[0_4px_0_#9fd0b3]", r: "4deg", d: "-3s" },
  { text: "would rather", cls: "bottom-[30%] right-[4%] border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)]", r: "-4deg", d: "-2.2s" },
];

const FEATURES = [
  { Icon: Lightbulb, tone: "bg-primary-soft text-primary-deep", title: "Tiap salah ada penjelasannya", body: "Lori bedah kalimatnya, bagian per bagian." },
  { Icon: GraduationCap, tone: "bg-mango-soft text-mango-ink", title: "Format EPrT asli", body: "Listening, Structure, Reading, lengkap timer." },
  { Icon: MessageCircle, tone: "bg-sky-soft text-sky-deep", title: "Tutor AI yang sabar", body: "Ngobrol kapan aja, dikoreksi pelan-pelan." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/belajar");

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-14">
        <Link href="/" className="font-display text-[1.5rem] font-extrabold tracking-[-0.02em]">
          EnglishApp
        </Link>
        <Link href="/login" className="flex min-h-11 items-center rounded-[12px] px-4 font-extrabold text-ink-subtle hover:bg-surface-muted">
          Masuk
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-wrap items-center gap-12 px-6 pb-10 pt-4 sm:px-14">
        <section className="flex min-w-0 flex-1 basis-[480px] flex-col gap-7">
          <p className="rise inline-flex items-center gap-2 self-start rounded-full border-2 border-hairline bg-surface px-3.5 py-2 text-[0.875rem] font-bold text-primary-deep">
            <span className="relative size-2.5">
              <span className="ping absolute inset-0 rounded-full bg-primary" />
              <span className="absolute inset-0 rounded-full bg-primary" />
            </span>
            Persiapan EPrT, TOEFL &amp; ngobrol sehari-hari
          </p>
          <h1 className="rise font-display text-[2.75rem] font-black leading-[0.98] tracking-[-0.035em] [--i:1] sm:text-[4.25rem]">
            Bahasa Inggris yang <span className="text-primary">dijelaskan</span>, bukan cuma dinilai.
          </h1>
          <p className="rise max-w-[540px] text-[1.25rem] leading-relaxed text-ink-subtle [--i:2]">
            Salah jawab? Lori nggak cuma bilang “salah”. Dia tunjukin bagian kalimat mana yang keliru, kenapa, dan kasih contoh lain sampai kamu paham.
          </p>
          <div className="rise flex flex-wrap gap-3.5 [--i:3]">
            <Link
              href="/mulai/tujuan"
              className="ledge flex min-h-[60px] items-center gap-2.5 rounded-[18px] bg-primary px-[30px] font-display text-[1.25rem] font-extrabold tracking-[0.01em] text-white"
            >
              Mulai belajar, gratis
              <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden />
            </Link>
            <Link
              href="/login"
              className="flex min-h-[60px] items-center rounded-[18px] border-2 border-hairline bg-surface px-[26px] font-display text-[1.125rem] font-extrabold shadow-[0_5px_0_var(--color-hairline)] transition-[transform,box-shadow] active:translate-y-[5px] active:shadow-none"
            >
              Aku sudah punya akun
            </Link>
          </div>
          <p className="rise text-[0.875rem] text-ink-subtle [--i:4]">Atur tujuan dan level dulu. Akun dibuat di langkah terakhir, progres tetap tersimpan.</p>
        </section>

        <section aria-label="Lori dan Kaka menyapa" className="relative h-[560px] min-w-0 flex-1 basis-[480px]">
          <div aria-hidden className="absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas-deep" />
          <div aria-hidden className="absolute left-1/2 top-1/2 size-[370px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-dashed border-hairline-strong" />
          {FLOATING.map((f) => (
            <span
              key={f.text}
              className={`float absolute rounded-[14px] border-2 px-4 py-2.5 font-display text-[1.25rem] font-extrabold ${f.cls}`}
              style={{ "--r": f.r, animationDelay: f.d } as React.CSSProperties}
            >
              {f.text}
            </span>
          ))}
          <div className="pop absolute left-1/2 top-[3%] origin-bottom-left [animation-delay:500ms]">
            <div className="ml-7 max-w-[260px] rounded-[20px_20px_20px_6px] border-2 border-hairline bg-surface px-5 py-4 shadow-[0_4px_0_var(--color-hairline)]">
              <p className="text-[1.0625rem] font-extrabold">Hai! Aku Lori.</p>
              <p className="mt-1 text-[0.9375rem] text-ink-subtle">Aku temenin kamu belajar tiap hari. Yang di pojok itu Kaka, pelatih EPrT-mu.</p>
            </div>
          </div>
          <div className="absolute bottom-6 left-1/2 -ml-[200px]">
            <Lori mood="wave" size={340} label="Lori, maskot kukang berselendang hijau, melambaikan tangan" />
          </div>
          <div className="absolute bottom-0 right-[2%] h-[170px] w-[170px] overflow-hidden">
            <div className="peek">
              <Kaka mood="coach" size={170} label="Kaka, burung enggang berkacamata, mengintip" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-hairline bg-surface-muted">
        <ul className="mx-auto grid max-w-[1360px] gap-6 px-6 py-6 sm:px-14 md:grid-cols-3">
          {FEATURES.map(({ Icon, tone, title, body }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] ${tone}`}>
                <Icon className="size-[22px]" aria-hidden />
              </span>
              <span>
                <strong className="block text-[1rem]">{title}</strong>
                <span className="text-[0.875rem] text-ink-subtle">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
