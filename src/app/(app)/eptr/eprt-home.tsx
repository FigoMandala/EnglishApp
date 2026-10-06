"use client";

import { ArrowRight, BookOpen, Clock, Headphones, Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { ExamStack } from "@/components/exam-3d";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { SECTION_MINUTES, scopeQuestionTotal } from "@/lib/eprt-simulation";
import type { SkillKey, ToeflSection } from "@/lib/toefl";
import { cn } from "@/lib/utils";

import { saveToeflTarget, startToeflBlock, type ToeflState } from "../toefl/actions";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-ink-subtle">EPrT · English Proficiency Test</p>
          <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[3rem]">
            {props.daysToTest !== null && props.daysToTest >= 0
              ? `Halo ${props.username}, ${props.daysToTest === 0 ? "hari ini tesnya" : `${props.daysToTest} hari lagi menuju tes`}.`
              : `Halo ${props.username}.`}
          </h1>
        </div>
        <a href="#target" className="py-2 text-base font-bold text-accent hover:text-accent-ink">
          Ubah target &amp; tanggal tes
        </a>
      </div>

      <section
        aria-labelledby="sim-title"
        className="hero-action grid gap-8 px-6 py-8 sm:px-12 sm:py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
      >
        <div className="relative z-[1] flex flex-col justify-center gap-5">
          <span className="eyebrow self-start rounded-full bg-white/10 px-3 py-1.5 text-[#bfe3cf]">
            {activeSim
              ? `Sedang berjalan · bagian ${Math.min(activeSim.doneParts + 1, activeSim.totalParts)} dari ${activeSim.totalParts}`
              : "Simulasi penuh"}
          </span>
          <h2 id="sim-title" className="font-display text-[2rem] font-extrabold leading-[1.05] sm:text-[2.5rem]">
            {activeSim?.scope
              ? `Mini-test ${activeSim.scope[0].toUpperCase()}${activeSim.scope.slice(1)} ${activeSim.totalQuestions} soal`
              : "Simulasi penuh 140 soal"}
          </h2>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-[#cfe8d8]">
            {activeSim?.nextTitle
              ? `Berikutnya ${activeSim.nextTitle}. Timer section mulai saat bagian pertamanya dibuka.`
              : "Listening 50, Structure 40, Reading 50 dengan timer tiap section. Skor dan pembahasan muncul di akhir."}
          </p>
          {activeSim ? (
            <div className="flex max-w-xl flex-col gap-2">
              <div className="flex justify-between text-[0.9375rem] text-[#cfe8d8]">
                <span>Progres</span>
                <span className="tnum font-mono">
                  {activeSim.doneQuestions} / {activeSim.totalQuestions} soal
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progres simulasi"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2.5 overflow-hidden rounded-full bg-white/15"
              >
                <div className="h-full rounded-full bg-mint" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3">
            {activeSim ? (
              <Link
                href={`/eptr/simulasi?id=${activeSim.id}`}
                className="flex h-[3.25rem] items-center gap-2.5 rounded-control bg-white px-7 text-[1.0625rem] font-bold text-primary-deep shadow-card transition-transform hover:-translate-y-0.5"
              >
                {activeSim.scope ? "Lanjutkan mini-test" : "Lanjutkan simulasi"}
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            ) : null}
            <StartSimulationButton
              disabled={!props.configured}
              label={activeSim ? "Mulai simulasi penuh baru" : "Mulai simulasi"}
              className={cn(
                "h-[3.25rem] rounded-control px-6 text-[1.0625rem]",
                activeSim
                  ? "bg-white/10 text-white shadow-none ring-2 ring-inset ring-white/25 hover:bg-white/20"
                  : "bg-white text-primary-deep hover:bg-white",
              )}
            />
            <StartFastButton
              disabled={!props.configured}
              label="Siapkan dulu 140 soal"
              className="h-[3.25rem] bg-white/10 px-6 text-[1.0625rem] text-white ring-2 ring-inset ring-white/25 hover:bg-white/20"
            />
          </div>
          {!props.configured ? (
            <p className="text-[0.9375rem] text-[#cfe8d8]">Pembuatan soal belum aktif. Hubungi admin.</p>
          ) : (
            <p className="max-w-[34rem] text-[0.8125rem] leading-relaxed text-[#cfe8d8]">
              <strong className="text-white">Mulai simulasi</strong>: soal dibuat per bagian sambil kamu mengerjakan.{" "}
              <strong className="text-white">Siapkan dulu</strong>: tunggu semua soal jadi, lalu kerjakan tanpa jeda.
            </p>
          )}
        </div>
        <ExamStack size="md" labels={false} className="relative z-[1] hidden h-[320px] lg:flex" />
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
          {pending ? (
            <p role="status" className="text-[0.9375rem] text-ink-subtle">
              Menyiapkan soal, biasanya kurang dari 30 detik.
            </p>
          ) : state.status === "error" ? (
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
            {pending ? (
              <p role="status" className="text-[0.9375rem] text-ink-subtle">
                Menyiapkan soal, biasanya kurang dari 30 detik.
              </p>
            ) : state.status === "error" ? (
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
