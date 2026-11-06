import {

  ArrowRight,
  Check,
  Flame,
  Headphones,
  MessageCircle,
  PenLine,
  Route,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Kaka, Lori } from "@/components/mascot";
import { Lori3D } from "@/components/lori-3d";
import { Logo } from "@/components/logo";
import { Anatomy } from "@/components/ui/anatomy";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "EnglishApp · Persiapan EPrT, TOEFL & ngobrol sehari-hari" };

const STEPS = [
  {
    title: "Satu pelajaran pendek",
    body: "Materi grammar dipecah jadi langkah kecil: aturan, contoh, lalu “coba sendiri”. 3–7 menit.",
    tone: "bg-primary text-white shadow-[0_4px_0_var(--color-primary-deep)]",
  },
  {
    title: "Latih dengan umpan balik",
    body: "Setiap salah langsung dibedah. Kesalahan masuk Bank Kesalahan dan muncul lagi sampai kamu benar.",
    tone: "bg-sky text-white shadow-[0_4px_0_var(--color-sky-deep)]",
  },
  {
    title: "Ulang tepat waktu",
    body: "Kartu kosakata SRS muncul tepat sebelum kamu lupa. Streak dan Liga menjaga ritme.",
    tone: "bg-mango text-mango-on shadow-[0_4px_0_var(--color-mango-deep)]",
  },
];

const FEATURES = [
  {
    Icon: Route,
    tone: "bg-primary-soft text-primary",
    title: "Jalur belajar bertahap",
    body: "Dari artikel & to be sampai pengandaian dan inversi. Tes penempatan melompati yang sudah kamu kuasai.",
  },
  {
    Icon: null,
    tone: "bg-mango-soft text-mango-ink",
    title: "Kosakata SRS",
    body: "Kartu dengan audio dan contoh kalimat. 4 tingkat ingatan menentukan kapan kartu kembali.",
  },
  {
    Icon: MessageCircle,
    tone: "bg-sky-soft text-sky",
    title: "Tutor AI & skenario",
    body: "Ngobrol dengan Lori kapan saja. Role-play interview, presentasi, sampai check-in hotel.",
  },
  {
    Icon: PenLine,
    tone: "bg-primary-soft text-primary",
    title: "Writing Coach",
    body: "Tulis esai, dapat skor per aspek dan sorotan koreksi langsung di kalimatmu.",
  },
  {
    Icon: Headphones,
    tone: "bg-sky-soft text-sky",
    title: "Dengar & ucapkan",
    body: "Latihan listening bisa diperlambat. Latihan speaking menandai kata yang belum terdengar jelas.",
  },
  {
    Icon: Flame,
    tone: "bg-mango-soft text-mango-ink",
    title: "Streak & Liga",
    body: "Pelindung streak untuk hari berat, akhir pekan santai, dan liga mingguan yang adil berdasarkan level.",
  },
];

const ledge =
  "transition-transform active:translate-y-[5px] active:shadow-none font-display font-extrabold";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/belajar");

  return (
    <div className="min-h-dvh overflow-x-hidden bg-canvas text-ink">
      <header className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-6 px-4 py-6 sm:px-10">
        <Logo href="/" size={44} />
        <nav aria-label="Navigasi landing" className="ml-auto hidden gap-1 md:flex">
          {[
            ["#fitur", "Fitur"],
            ["#eprt", "Persiapan EPrT"],
            ["#cara", "Cara kerja"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-[12px] px-3.5 py-2.5 font-bold text-ink-muted hover:bg-surface">
              {label}
            </a>
          ))}
        </nav>
        <Link
          href="/login"
          className={`ml-auto flex min-h-11 items-center rounded-[14px] border-2 border-hairline bg-surface px-[18px] shadow-card md:ml-0 ${ledge}`}
        >
          Masuk
        </Link>
      </header>

      <section className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-14 px-4 pb-[72px] pt-8 sm:px-10">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-[26px]">
          <p className="rise inline-flex items-center gap-2 self-start rounded-full border-2 border-hairline bg-surface px-3.5 py-2 text-[0.875rem] font-extrabold text-primary-deep">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_0_4px_var(--color-primary-soft)]" />
            Persiapan EPrT, TOEFL &amp; ngobrol sehari-hari
          </p>
          <h1 className="rise font-display text-[2.75rem] font-black leading-[0.98] tracking-[-0.035em] [--i:1] sm:text-[4.25rem]">
            Bahasa Inggris yang{" "}
            <span className="bg-[linear-gradient(transparent_62%,var(--color-mango-mark)_62%)] px-1 text-primary">dijelaskan</span>,
            bukan cuma dinilai.
          </h1>
          <p className="rise max-w-[560px] text-[1.25rem] leading-[1.55] text-ink-muted [--i:2]">
            Salah jawab? Lori nggak cuma bilang “salah”. Dia bedah kalimatnya: bagian mana yang keliru, kenapa, dan contoh lain
            sampai kamu paham.
          </p>
          <div className="rise flex flex-wrap gap-3.5 [--i:3]">
            <Link
              href="/mulai/tujuan"
              className={`flex min-h-[60px] items-center gap-2.5 rounded-[18px] bg-primary px-[30px] text-[1.25rem] text-white shadow-[0_5px_0_var(--color-primary-deep)] ${ledge}`}
            >
              Mulai belajar, gratis
              <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden />
            </Link>
            <Link
              href="/login"
              className={`flex min-h-[60px] items-center rounded-[18px] border-2 border-hairline bg-surface px-[26px] text-[1.125rem] shadow-[0_5px_0_var(--color-hairline)] ${ledge}`}
            >
              Aku sudah punya akun
            </Link>
          </div>
          <ul className="rise flex flex-wrap gap-5 text-[0.875rem] font-bold text-ink-muted [--i:4]">
            {["Gratis", "Akun dibuat di langkah terakhir", "5 menit sehari cukup"].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-primary" strokeWidth={3} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0 flex-[1_1_520px] pb-5 pt-10">
          <div aria-hidden className="absolute inset-y-0 left-[8%] right-[8%] rounded-full bg-canvas-deep" />
          <div className="relative mx-auto flex max-w-[520px] -rotate-[1.2deg] flex-col gap-[18px] rounded-[28px] border-2 border-hairline bg-surface p-7 shadow-[0_6px_0_var(--color-hairline)]">
            <div className="flex items-center gap-3">
              <span className="eyebrow text-ink-subtle">Structure · Soal 7</span>
              <span className="ml-auto rounded-full bg-brick-soft px-2.5 py-0.5 text-[0.75rem] font-extrabold text-brick-deep">Hampir!</span>
            </div>
            <p className="text-[1.3125rem] font-semibold leading-normal">The letter ______ by the manager yesterday.</p>
            <div className="flex flex-wrap gap-2.5">
              <span className="rounded-[14px] border-2 border-brick bg-brick-soft px-3.5 py-2.5 font-bold text-brick-deep line-through">
                has written
              </span>
              <span className="inline-flex items-center gap-2 rounded-[14px] border-2 border-primary bg-primary-soft px-3.5 py-2.5 font-bold text-primary-deep">
                <Check className="size-4" strokeWidth={3} aria-hidden />
                was written
              </span>
            </div>
            <div className="rounded-[18px] border-2 border-dashed border-hairline-strong bg-surface-muted p-4">
              <Anatomy
                size="lg"
                parts={[
                  { text: "The letter", label: "subjek", tone: "subject" },
                  { text: "was written", label: "pasif", tone: "verb" },
                  { text: "by the manager", label: "pelaku", tone: "muted" },
                  { text: "yesterday", label: "waktu", tone: "time" },
                ]}
              />
            </div>
          </div>
          <div className="relative mx-auto -mt-[18px] flex max-w-[520px] items-end gap-1 pl-3">
            <Lori3D size={150} label="Lori menjelaskan — putar untuk melihat 3D" />
            <div className="mb-16 max-w-[300px] rounded-[20px_20px_20px_6px] border-2 border-hairline bg-surface px-4 py-3.5 text-[0.9375rem] leading-normal shadow-[0_3px_0_var(--color-hairline)]">
              <strong className="block text-primary-deep">Lori</strong>
              Suratnya nggak menulis sendiri, kan? Yang dikenai aksi → pasif: <strong>was + V3</strong>.
            </div>
          </div>
          <span
            aria-hidden
            className="float absolute right-[4%] top-1.5 rounded-[14px] border-2 border-mango-line bg-mango-soft px-3.5 py-2 font-display text-[1.125rem] font-extrabold text-mango-ink shadow-[0_4px_0_var(--color-mango-line)]"
            style={{ "--r": "5deg" } as React.CSSProperties}
          >
            however
          </span>
          <span
            aria-hidden
            className="float absolute bottom-7 right-0 rounded-[14px] border-2 border-primary-line bg-primary-soft px-3.5 py-2 font-display text-[1.125rem] font-extrabold text-primary-deep shadow-[0_4px_0_var(--color-primary-line)]"
            style={{ "--r": "-4deg", animationDelay: "-2s" } as React.CSSProperties}
          >
            since 2019
          </span>
        </div>
      </section>

      <section id="cara" className="border-y-2 border-hairline bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-[72px] sm:px-10">
          <div className="flex max-w-[720px] flex-col gap-2.5">
            <p className="eyebrow text-ink-subtle">Cara kerja</p>
            <h2 className="font-display text-[2.25rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]">
              Tiga langkah, tiap hari
            </h2>
          </div>
          <ol className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3.5 rounded-[24px] border-2 border-hairline bg-surface-muted p-7">
                <span className={`flex size-12 items-center justify-center rounded-[14px] font-round text-[1.5rem] font-extrabold ${step.tone}`}>
                  {i + 1}
                </span>
                <h3 className="font-display text-[1.375rem] font-extrabold">{step.title}</h3>
                <p className="text-ink-subtle">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="fitur" className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-20 sm:px-10">
        <div className="flex max-w-[640px] flex-col gap-2.5">
          <p className="eyebrow text-ink-subtle">Semua dalam satu app</p>
          <h2 className="font-display text-[2.25rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]">
            Dari kata pertama sampai hari tes
          </h2>
        </div>
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
          {FEATURES.map(({ Icon, tone, title, body }) => (
            <div key={title} className="flex flex-col gap-3 rounded-[24px] border-2 border-hairline bg-surface p-7 shadow-card">
              <span className={`flex size-12 items-center justify-center rounded-[14px] ${tone}`}>
                {Icon ? <Icon className="size-6" aria-hidden /> : <span className="font-display text-[1.125rem] font-black">Aa</span>}
              </span>
              <h3 className="font-display text-[1.375rem] font-extrabold">{title}</h3>
              <p className="text-ink-subtle">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="eprt" className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-10">
        <div className="flex flex-wrap items-center gap-12 rounded-[32px] bg-charcoal p-8 text-charcoal-ink sm:p-14">
          <div className="flex flex-[1_1_460px] flex-col gap-5">
            <p className="eyebrow text-mango-line">Mode ujian bersama Kaka</p>
            <h2 className="font-display text-[2.25rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]">
              Simulasi EPrT dengan format &amp; timer asli
            </h2>
            <p className="text-[1.125rem] text-charcoal-muted">
              Listening, Structure, Reading. Audio diputar sekali seperti tes asli. Di akhir: perkiraan skor, skor per bagian, dan
              topik yang paling bocor.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["3", "bagian ujian"],
                ["±20", "selisih perkiraan"],
                ["310–677", "skala skor"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[18px] bg-charcoal-raised p-4">
                  <span className="block font-round text-[1.5rem] font-extrabold leading-none text-mango sm:text-[2rem]">{value}</span>
                  <span className="text-[0.8125rem] text-charcoal-muted">{label}</span>
                </div>
              ))}
            </div>
            <Link
              href="/mulai/tujuan"
              className={`flex min-h-14 items-center gap-2.5 self-start rounded-[16px] bg-mango px-[26px] text-[1.125rem] text-mango-on shadow-[0_5px_0_var(--color-mango-deep)] ${ledge}`}
            >
              Mulai persiapan EPrT
            </Link>
          </div>
          {/* Di 360px baris mascot+bubble tidak muat: biarkan bubble turun baris
              dan Kaka menyusut (max-w-full) supaya tidak terpotong tepi layar. */}
          <div className="flex min-w-0 flex-[1_1_360px] flex-wrap items-end justify-center gap-x-1">
            <Kaka mood="coach" size={230} label="Kaka, pelatih EPrT" className="h-auto max-w-full" />
            <div className="mb-36 ml-1 min-w-0 max-w-[220px] rounded-[20px_20px_20px_6px] bg-canvas px-4 py-3.5 text-[0.9375rem] text-ink sm:-ml-5">
              <strong className="block text-brick-deep">Kaka</strong>
              Aku agak galak soal waktu. Tapi skor Structure-mu bakal berterima kasih.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 pb-20 sm:px-10">
        <div className="flex flex-wrap items-center gap-8 rounded-[32px] bg-primary px-8 py-12 text-white shadow-[0_6px_0_var(--color-primary-deep)] sm:px-14">
          <Lori mood="cheer" size={140} className="shrink-0" />
          <div className="flex flex-[1_1_380px] flex-col gap-2">
            <h2 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]">
              Mulai dari titik yang pas buatmu
            </h2>
            <p className="text-[1.125rem] text-primary-soft">Pilih tujuan, level, dan target harian. Ada tes penempatan kalau ragu.</p>
          </div>
          <Link
            href="/mulai/tujuan"
            className={`flex min-h-[60px] items-center gap-2.5 rounded-[18px] bg-white px-[30px] text-[1.25rem] text-primary-deep shadow-[0_5px_0_var(--color-primary-deep)] ${ledge}`}
          >
            Mulai sekarang
          </Link>
        </div>
      </section>

      <footer className="border-t-2 border-hairline bg-surface-muted">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-7 text-[0.875rem] text-ink-subtle sm:px-10">
          <span className="flex items-center gap-2">
            <Logo href="/" size={28} />
            · Belajar bahasa Inggris yang dijelaskan
          </span>
        </div>
      </footer>
    </div>
  );
}
