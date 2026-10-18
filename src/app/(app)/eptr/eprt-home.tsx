"use client";

import { ArrowRight, BookOpen, Clock, Headphones, Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { Kaka } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { SECTION_MINUTES, scopeQuestionTotal } from "@/lib/eprt-simulation";
import type { SkillKey, ToeflSection } from "@/lib/toefl";
import { cn } from "@/lib/utils";

import { saveToeflTarget, startToeflBlock, type ToeflState } from "../toefl/actions";
import { PendingOverlay, SectionCountdown } from "./eprt-widgets";
import { StartFastButton, StartSimulationButton } from "./simulasi/simulation-client";

const initialState: ToeflState = { status: "idle" };

export type EprtHomeProps = {
  username: string;
  configured: boolean;
  daysToTest: number | null;
  target: { score: number; testDate: string | null } | null;
  estimate: number | null;
  trend: number[];
  week: { date: string; active: boolean }[];
  streak: number;
  reviewsDue: number;
  weakest: { label: string; pct: number; answered: number } | null;
  activeSim: {
    id: number;
    scope: ToeflSection | null;
    doneParts: number;
    totalParts: number;
    nextTitle: string | null;
    msLeft: number | null;
    doneQuestions: number;
    totalQuestions: number;
  } | null;
  simulations: {
    id: number;
    createdAt: string;
    scope: ToeflSection | null;
    partTotal: number;
    completed: boolean;
    total: number | null;
    sections: string | null;
    started: number;
  }[];
  /** Skill Structure dan Reading beserta akurasi pengguna, untuk latihan per topik. */
  topics: {
    skill: SkillKey;
    section: "structure" | "reading";
    label: string;
    hint: string;
    answered: number;
    pct: number | null;
  }[];
  practice: { id: number; label: string; score: number | null; completed: boolean }[];
};

const GROUPS = [
  {
    title: "Listening",
    icon: Headphones,
    blocks: [
      { kind: "listening", title: "Short Dialogue", detail: "10 soal · ±8 mnt" },
      { kind: "listening-15", title: "Short Dialogue panjang", detail: "15 soal · ±12 mnt" },
      { kind: "listen-long", title: "Long Dialogue", detail: "8 soal · ±10 mnt" },
      { kind: "listen-lecture", title: "Lecture", detail: "8 soal · ±10 mnt" },
    ],
  },
  {
    title: "Structure",
    icon: PenLine,
    blocks: [
      { kind: "drill", title: "Sentence Completion", detail: "10 soal · ±8 mnt" },
      { kind: "written", title: "Error Recognition", detail: "10 soal · ±8 mnt" },
    ],
  },
  {
    title: "Reading",
    icon: BookOpen,
    blocks: [{ kind: "reading", title: "Satu teks bacaan", detail: "10 soal · ±15 mnt" }],
  },
] as const;

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values) - 10;
  const max = Math.max(...values) + 10;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 200;
      const y = 32 - ((value - min) / (max - min)) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 200 36"
      preserveAspectRatio="none"
      className="h-9 w-full"
      role="img"
      aria-label={`Tren perkiraan skor: ${values.join(", ")}`}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="text-accent" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function EprtHome(props: EprtHomeProps) {
  const [state, formAction, pending] = useActionState(startToeflBlock, initialState);
  const [targetState, targetAction, targetPending] = useActionState(saveToeflTarget, initialState);
  const startedRef = useRef<string | null>(null);
  const [format, setFormat] = useState<"drill" | "written">("drill");
  const { activeSim, target } = props;
  const progress = activeSim ? Math.round((activeSim.doneQuestions / activeSim.totalQuestions) * 100) : 0;

  function blockButton(kind: string, title: string, detail: string, tone: "plain" | "warning" = "plain") {
    const busy = pending && startedRef.current === kind;
    const disabled = pending || (kind === "review" ? props.reviewsDue === 0 : !props.configured);
    return (
      <form
        key={kind}
        action={formAction}
        onSubmit={() => {
          startedRef.current = kind;
        }}
      >
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="track" value="eptr" />
        <button
          type="submit"
          disabled={disabled}
          className={cn(
            "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-control px-4 text-left text-base font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
            tone === "warning"
              ? "bg-warning-soft text-warning-ink hover:bg-warning-soft/70"
              : "border-2 border-hairline bg-surface-muted text-ink hover:border-primary hover:bg-surface",
          )}
        >
          {title}
          <span className={cn("flex items-center gap-2 text-[0.875rem] font-medium", tone === "plain" && "text-ink-subtle")}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {detail}
          </span>
        </button>
      </form>
    );
  }

  function topicButton(topic: EprtHomeProps["topics"][number], kind: "drill" | "written" | "reading") {
    const key = `${kind}:${topic.skill}`;
    const busy = pending && startedRef.current === key;
    const weak = topic.pct !== null && topic.answered >= 3 && topic.pct < 60;
    return (
      <form
        key={key}
        action={formAction}
        onSubmit={() => {
          startedRef.current = key;
        }}
      >
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="skill" value={topic.skill} />
        <input type="hidden" name="track" value="eptr" />
        <button
          type="submit"
          disabled={pending || !props.configured}
          title={topic.hint}
          className={cn(
            "flex min-h-12 w-full items-center justify-between gap-3 rounded-control px-4 text-left text-[0.9375rem] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
            weak
              ? "bg-warning-soft text-warning-ink hover:bg-warning-soft/70"
              : "border-2 border-hairline bg-surface-muted text-ink hover:border-primary hover:bg-surface",
          )}
        >
          <span className="min-w-0 truncate">{topic.label}</span>
          <span className="flex shrink-0 items-center gap-2 text-[0.8125rem] font-medium">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {topic.pct !== null ? `${topic.pct}% · ${topic.answered} soal` : "belum dicoba"}
          </span>
        </button>
      </form>
    );
  }

  const structureTopics = props.topics.filter((topic) => topic.section === "structure");
  const readingTopics = props.topics.filter((topic) => topic.section === "reading");
  const MINI_TESTS = [
    { section: "listening", title: "Listening", detail: "50 soal · 35 menit" },
    { section: "structure", title: "Structure", detail: "40 soal · 25 menit" },
    { section: "reading", title: "Reading", detail: "50 soal · 55 menit" },
  ] as const;

  return (
    <div className="flex flex-col gap-10">
      {pending ? <PendingOverlay /> : null}
      <section
        aria-labelledby="sim-title"
        className="rise relative flex flex-wrap items-center gap-7 overflow-hidden rounded-[28px] bg-[#22242a] p-6 text-canvas shadow-[0_6px_0_#111215] sm:p-7"
      >
        <div className="relative hidden shrink-0 items-end sm:flex">
          <Kaka mood={props.daysToTest !== null && props.daysToTest <= 7 ? "warn" : "coach"} size={190} label="Kaka, pelatih EPrT-mu" />
        </div>

        <div className="relative min-w-[280px] flex-1">
          <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#f2c878]">
            {activeSim ? `SEDANG BERJALAN · BAGIAN ${Math.min(activeSim.doneParts + 1, activeSim.totalParts)} DARI ${activeSim.totalParts}` : "KAKA, PELATIH EPrT-MU"}
          </p>
          <h1 id="sim-title" className="mt-1.5 font-display text-[1.75rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.125rem]">
            {activeSim
              ? activeSim.scope
                ? `Mini-test ${activeSim.scope[0].toUpperCase()}${activeSim.scope.slice(1)} belum selesai.`
                : "Simulasi penuh kamu belum selesai."
              : props.weakest
                ? `Kejar ${props.weakest.label}: baru ${props.weakest.pct}% benar.`
                : props.estimate !== null
                  ? `Perkiraan skormu ${props.estimate}. Terus asah.`
                  : `Halo ${props.username}. Mulai dari satu simulasi untuk tahu posisimu.`}
          </h1>
          <p className="mt-2.5 text-[1rem] text-[#d3ccbe]">
            {activeSim?.nextTitle
              ? `Berikutnya ${activeSim.nextTitle}. ${activeSim.doneQuestions} dari ${activeSim.totalQuestions} soal sudah dikerjakan.`
              : props.weakest
                ? `Dari ${props.weakest.answered} soal yang kamu jawab, di sinilah kebocoran terbesar. Latihan per topik di bawah bisa menolong.`
                : "Listening 50, Structure 40, Reading 50 dengan timer tiap section. Skor dan pembahasan muncul di akhir."}
          </p>

          {activeSim?.msLeft != null ? <SectionCountdown msLeft={activeSim.msLeft} /> : null}

          {activeSim ? (
            <div className="mt-3 flex max-w-xl flex-col gap-1.5">
              <div
                role="progressbar"
                aria-label="Progres simulasi"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2.5 overflow-hidden rounded-full bg-white/15"
              >
                <div className="h-full rounded-full bg-mango" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-start gap-3">
            {activeSim ? (
              <Link
                href={`/eptr/simulasi?id=${activeSim.id}`}
                className="ledge flex min-h-14 items-center gap-2.5 rounded-[16px] bg-mango px-6 font-display text-[1.0625rem] font-black text-[#3a2400] [--ledge:var(--color-mango-deep)]"
              >
                {activeSim.scope ? "LANJUTKAN MINI-TEST" : "LANJUTKAN SIMULASI"}
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            ) : null}
            <StartSimulationButton
              disabled={!props.configured}
              label={activeSim ? "Simulasi penuh baru" : "SIMULASI PENUH · 115 MNT"}
              className={cn(
                "h-14 rounded-[16px] px-6 text-[1.0625rem] font-black",
                activeSim
                  ? "border-2 border-[#4a4e58] bg-[#2e3138] text-canvas [--ledge:#15161a]"
                  : "bg-mango text-[#3a2400] [--ledge:var(--color-mango-deep)]",
              )}
            />
            <StartFastButton
              disabled={!props.configured}
              label="Siapkan dulu 140 soal"
              className="h-14 rounded-[16px] border-2 border-[#4a4e58] bg-[#2e3138] px-5 text-[1rem] text-canvas [--ledge:#15161a] hover:bg-[#3a3d46]"
            />
          </div>
          {!props.configured ? (
            <p className="mt-3 text-[0.9375rem] text-[#d3ccbe]">Pembuatan soal belum aktif. Hubungi admin.</p>
          ) : (
            <p className="mt-3 max-w-[34rem] text-[0.8125rem] leading-relaxed text-[#d3ccbe]">
              <strong className="text-white">Simulasi</strong>: soal dibuat per bagian sambil kamu mengerjakan.{" "}
              <strong className="text-white">Siapkan dulu</strong>: tunggu semua soal jadi, lalu kerjakan tanpa jeda.
            </p>
          )}
        </div>

        <div className="relative flex basis-[280px] flex-col gap-3.5">
          <div
            className="flex items-center gap-2"
            aria-label={props.daysToTest !== null ? `${props.daysToTest} hari lagi menuju tes` : "Tanggal tes belum diatur"}
          >
            {props.daysToTest !== null && props.daysToTest >= 0 ? (
              <>
                {String(props.daysToTest)
                  .padStart(2, "0")
                  .split("")
                  .map((digit, i) => (
                    <span
                      key={i}
                      className="pop grid h-[76px] w-[62px] place-items-center rounded-[12px] bg-canvas font-display text-[3rem] font-black text-ink shadow-[0_4px_0_#8f8574]"
                      style={{ "--i": i * 2 } as React.CSSProperties}
                    >
                      {digit}
                    </span>
                  ))}
                <span className="ml-1.5">
                  <strong className="block font-display text-[1.25rem]">hari lagi</strong>
                  <span className="text-[0.875rem] text-[#d3ccbe]">{target?.testDate ? formatDate(target.testDate) : ""}</span>
                </span>
              </>
            ) : (
              <a href="#target" className="rounded-[12px] border-2 border-[#4a4e58] bg-[#2e3138] px-4 py-3 text-[0.9375rem] font-extrabold text-[#f2c878]">
                Atur tanggal tes
              </a>
            )}
          </div>
          <div className="rounded-[18px] bg-[#2e3138] px-4 py-3.5">
            <p className="text-[0.8125rem] font-bold text-[#d3ccbe]">Perkiraan skor</p>
            <p className="font-display text-[2.375rem] font-black leading-none">{props.estimate ?? "–"}</p>
            <p className="mt-1 text-[0.8125rem] text-[#d3ccbe]">
              {props.estimate === null
                ? "muncul setelah ±10 soal Structure & Reading"
                : target
                  ? target.score - props.estimate > 0
                    ? `target ${target.score} · kurang ${target.score - props.estimate} poin`
                    : `target ${target.score} · tercapai`
                  : "atur target di bawah"}
            </p>
          </div>
          <a href="#target" className="text-[0.875rem] font-extrabold text-[#f2c878] hover:underline">
            Ubah target &amp; tanggal tes →
          </a>
        </div>
      </section>

      <section aria-label="Ringkasan" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5 rounded-plate border-2 border-hairline bg-surface p-4 shadow-card sm:p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Perkiraan skor</span>
          <span className="tnum font-round text-[2.25rem] font-extrabold leading-none text-primary">
            {props.estimate ?? "–"}
          </span>
          <Sparkline values={props.trend} />
          <span className="text-[0.8125rem] text-ink-subtle">
            {props.estimate === null
              ? "kerjakan minimal 10 soal Structure dan Reading"
              : target
                ? target.score - props.estimate > 0
                  ? `kurang ${target.score - props.estimate} poin dari target ${target.score}`
                  : `target ${target.score} tercapai`
                : "atur target skor di bawah"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-plate border-2 border-hairline bg-surface p-4 shadow-card sm:p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Streak belajar</span>
          <span className="tnum font-round text-[2.25rem] font-extrabold leading-none">{props.streak} hari</span>
          <div
            role="img"
            aria-label={`Aktif ${props.week.filter((day) => day.active).length} dari 7 hari terakhir`}
            className="mt-1 grid grid-cols-7 gap-1.5"
          >
            {props.week.map((day, index) => (
              <span
                key={day.date}
                className={cn(
                  "h-7 rounded-lg",
                  day.active ? "bg-primary" : "bg-canvas-deep",
                  index === 6 && "outline-2 outline-offset-2 outline-ink",
                )}
              />
            ))}
          </div>
          <span className="text-[0.8125rem] text-ink-subtle">7 hari terakhir, paling kanan hari ini</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-plate border-2 border-hairline bg-surface p-4 shadow-card sm:p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Ulang kesalahan</span>
          <span className={cn("tnum font-round text-[2.25rem] font-extrabold leading-none", props.reviewsDue > 0 && "text-warning")}>
            {props.reviewsDue}
          </span>
          <span className="text-[0.8125rem] text-ink-subtle">soal jatuh tempo hari ini</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-plate border-2 border-hairline bg-surface p-4 shadow-card sm:p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Skill terlemah</span>
          <span className="pt-1 font-display text-[1.5rem] font-extrabold leading-tight">
            {props.weakest?.label ?? "-"}
          </span>
          <span className="text-[0.8125rem] text-ink-subtle">
            {props.weakest
              ? `benar ${props.weakest.pct}% dari ${props.weakest.answered} soal`
              : "muncul setelah beberapa latihan"}
          </span>
        </div>
      </section>

      <section aria-labelledby="practice-title" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="practice-title" className="font-display text-[1.75rem] font-extrabold">
            Latihan per bagian
          </h2>
          {state.status === "error" ? (
            <p role="alert" className="text-[0.9375rem] font-semibold text-negative">
              {state.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-5 shadow-card">
              <p className="flex items-center gap-2.5 font-display text-[1.25rem] font-extrabold">
                <group.icon className="size-5 text-primary" aria-hidden />
                {group.title}
              </p>
              {group.blocks.map((block) => blockButton(block.kind, block.title, block.detail))}
              {group.title === "Reading"
                ? blockButton(
                    "review",
                    "Ulang kesalahan",
                    props.reviewsDue > 0 ? `${props.reviewsDue} jatuh tempo` : "belum ada",
                    props.reviewsDue > 0 ? "warning" : "plain",
                  )
                : null}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="topic-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="topic-title" className="font-display text-[1.75rem] font-extrabold">
              Latihan per topik
            </h2>
            <p className="max-w-xl text-[0.9375rem] text-ink-subtle">
              10 soal yang fokus ke satu topik. Topik dengan akurasi di bawah 60% ditandai kuning.
            </p>
            {state.status === "error" ? (
              <p role="alert" className="text-[0.9375rem] font-semibold text-negative">
                {state.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-plate border-2 border-hairline bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 font-display text-[1.25rem] font-extrabold">
              <PenLine className="size-5 text-primary" aria-hidden />
              Grammar (Structure)
            </p>
            <div role="radiogroup" aria-label="Bentuk soal" className="flex gap-1 rounded-control bg-surface-muted p-1">
              {(
                [
                  ["drill", "Sentence Completion"],
                  ["written", "Error Recognition"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={format === value}
                  onClick={() => setFormat(value)}
                  className={cn(
                    "min-h-10 rounded-[10px] px-3.5 text-[0.875rem] font-bold transition-colors",
                    format === value ? "bg-surface text-primary shadow-card" : "text-ink-subtle hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {structureTopics.map((topic) => topicButton(topic, format))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-plate border-2 border-hairline bg-surface p-5 shadow-card">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2.5 font-display text-[1.25rem] font-extrabold">
              <BookOpen className="size-5 text-primary" aria-hidden />
              Reading per tipe soal
            </p>
            <p className="text-[0.875rem] text-ink-subtle">
              Satu teks baru dengan sebagian besar soal bertipe pilihanmu. Teks dibuat baru, jadi tunggu sekitar 30 detik.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readingTopics.map((topic) => topicButton(topic, "reading"))}
          </div>
        </div>
      </section>

      <section aria-labelledby="mini-title" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="mini-title" className="font-display text-[1.75rem] font-extrabold">
            Mini-test per section
          </h2>
          <p className="max-w-xl text-[0.9375rem] text-ink-subtle">
            Satu section penuh dengan jumlah soal dan timer seperti tes asli, tanpa harus mengerjakan 140 soal. Hasilnya
            skor section, dan audio Listening hanya diputar sekali.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {MINI_TESTS.map((test) => (
            <div
              key={test.section}
              className="flex flex-col justify-between gap-5 rounded-plate border-2 border-hairline bg-surface p-5 shadow-card"
            >
              <div className="flex flex-col gap-1.5">
                <p className="font-display text-[1.25rem] font-extrabold">{test.title}</p>
                <p className="flex items-center gap-2 text-[0.9375rem] text-ink-subtle">
                  <Clock className="size-4" aria-hidden />
                  {scopeQuestionTotal(test.section)} soal · {SECTION_MINUTES[test.section]} menit
                </p>
              </div>
              <StartSimulationButton
                section={test.section}
                disabled={!props.configured}
                label={`Mulai ${test.title}`}
                className="h-12 self-start rounded-control px-5 text-base"
              />
            </div>
          ))}
        </div>
      </section>

      {props.simulations.length ? (
        <section aria-labelledby="history-title" className="flex flex-col gap-4">
          <h2 id="history-title" className="font-display text-[1.75rem] font-extrabold">
            Riwayat simulasi
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.simulations.map((sim) => (
              <Link
                key={sim.id}
                href={`/eptr/simulasi?id=${sim.id}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[16px] bg-surface px-5 py-4 shadow-card transition-colors hover:border-primary",
                  sim.completed ? "border-2 border-hairline" : "border-2 border-dashed border-hairline-strong",
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-bold">
                    {sim.scope ? "Mini-test" : "Simulasi"} {formatDate(sim.createdAt)}
                  </span>
                  <span className="text-[0.875rem] text-ink-subtle">
                    {sim.completed ? sim.sections : `${sim.started} dari ${sim.partTotal} bagian dibuka`}
                  </span>
                </span>
                {sim.completed ? (
                  <span className="tnum font-round text-[1.75rem] font-extrabold text-primary">{sim.total}</span>
                ) : (
                  <span className="text-[0.9375rem] font-bold text-primary">Lanjutkan</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section id="target" aria-labelledby="target-title" className="flex flex-col gap-4 rounded-plate border-2 border-hairline bg-surface p-6 shadow-card">
          <div className="flex flex-col gap-1">
            <h2 id="target-title" className="font-display text-[1.375rem] font-extrabold">
              Target &amp; tanggal tes
            </h2>
            <p className="text-[0.9375rem] text-ink-subtle">Dipakai untuk menentukan level soal dan hitung mundur.</p>
          </div>
          <form action={targetAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="track" value="eptr" />
            <div className="flex flex-col gap-2">
              <Label htmlFor="score">Skor target (310-677)</Label>
              <Input id="score" name="score" type="number" min={310} max={677} defaultValue={target?.score ?? 500} className="tnum" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="testDate">Tanggal tes</Label>
              <Input id="testDate" name="testDate" type="date" defaultValue={target?.testDate ?? ""} />
            </div>
            <Button type="submit" variant="secondary" disabled={targetPending}>
              {targetPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Simpan
            </Button>
          </form>
          <FieldError>{targetState.status === "error" ? targetState.message : undefined}</FieldError>
        </section>

        <section aria-labelledby="practice-history" className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-6 shadow-card">
          <h2 id="practice-history" className="font-display text-[1.375rem] font-extrabold">
            Latihan terakhir
          </h2>
          {props.practice.length === 0 ? (
            <p className="text-[0.9375rem] text-ink-subtle">Belum ada. Mulai dari salah satu latihan di atas.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {props.practice.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/eptr?s=${item.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-control px-3 hover:bg-surface-muted"
                  >
                    <span className="min-w-0 truncate text-[0.9375rem]">{item.label}</span>
                    <span className={cn("shrink-0 text-[0.875rem] font-bold", item.completed ? "text-primary" : "text-warning-ink")}>
                      {item.completed ? (item.score ?? "selesai") : "lanjutkan"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </div>
  );
}
