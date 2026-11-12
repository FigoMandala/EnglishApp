"use client";

import { ArrowRight, BookOpen, Check, ChevronDown, Clock, Headphones, Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Kaka } from "@/components/mascot";
import { CountUp } from "@/components/fx/count-up";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { SECTION_MINUTES, scopeQuestionTotal } from "@/lib/eprt-simulation";
import type { SkillKey, ToeflSection } from "@/lib/toefl";
import { cn } from "@/lib/utils";

import { saveToeflTarget, startToeflBlock, type ToeflState } from "../toefl/actions";
import { PendingOverlay } from "@/components/pending-overlay";

import { SectionCountdown } from "./eprt-widgets";
import { StartSimulationButton } from "./simulasi/simulation-client";

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

function Sparkline({ values, target }: { values: number[]; target: number | null }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values) - 10;
  const hi = Math.max(...values, target ?? 0) + 4;
  const y = (value: number) => 60 - ((value - lo) / (hi - lo)) * 56;
  const points = values.map((value, index) => `${((index / (values.length - 1)) * 240).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg
      viewBox="0 0 240 64"
      preserveAspectRatio="none"
      className="reveal h-11 w-full"
      role="img"
      aria-label={`Tren perkiraan skor: ${values.join(", ")}${target ? `, target ${target}` : ""}`}
    >
      {target ? (
        <line x1="0" x2="240" y1={y(target)} y2={y(target)} stroke="var(--color-mango)" strokeWidth={2} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
      ) : null}
      <polyline points={points} fill="none" stroke="var(--color-mint)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx="240" cy={y(last)} r="5" fill="var(--color-mint)" />
    </svg>
  );
}

function pctTone(pct: number | null) {
  if (pct === null) return { bar: "bg-hairline", text: "text-ink-subtle" };
  if (pct < 55) return { bar: "bg-brick", text: "text-brick-deep" };
  if (pct < 70) return { bar: "bg-mango", text: "text-mango-ink" };
  return { bar: "bg-primary", text: "text-primary-deep" };
}

type Topic = EprtHomeProps["topics"][number];

/** Dropdown topik: pemicu menampilkan topik terpilih; daftar dikelompokkan per bagian dan bisa dipakai dengan keyboard. */
function TopicDropdown({ groups, value, onChange }: { groups: { title: string; topics: Topic[] }[]; value: Topic; onChange: (topic: Topic) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const flat = groups.flatMap((group) => group.topics);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") setOpen(false);
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) return setOpen(true);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const index = flat.findIndex((topic) => topic.skill === value.skill);
    onChange(flat[(index + step + flat.length) % flat.length]);
  }

  const rate = (topic: Topic) => (topic.answered >= 3 ? topic.pct : null);

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-label="Topik latihan"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="topic-listbox"
        aria-activedescendant={open ? `topic-opt-${value.skill}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 rounded-[16px] border-2 bg-surface px-4 text-left transition-colors",
          open ? "border-primary" : "border-hairline hover:border-hairline-strong",
        )}
      >
        <span className="min-w-0">
          <strong className="block truncate text-[1rem]">{value.label}</strong>
          <span className="block truncate text-[0.8125rem] text-ink-subtle">
            {value.section === "structure" ? "Structure" : "Reading"} · {value.hint}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-ink-subtle transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <ul
          id="topic-listbox"
          role="listbox"
          aria-label="Pilih topik latihan"
          className="pop absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-[360px] origin-top overflow-y-auto rounded-[16px] border-2 border-hairline bg-surface p-1.5 shadow-[0_8px_0_var(--color-hairline)]"
        >
          {groups.map((group) =>
            group.topics.length ? (
              <li key={group.title} role="presentation">
                <p className="px-3 pb-1 pt-2.5 text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-ink-subtle">{group.title}</p>
                <ul role="presentation">
                  {group.topics.map((topic) => {
                    const pct = rate(topic);
                    const tone = pctTone(pct);
                    const selected = topic.skill === value.skill;
                    return (
                      <li
                        key={topic.skill}
                        id={`topic-opt-${topic.skill}`}
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onChange(topic);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3 py-2 transition-colors duration-150 motion-reduce:transition-none",
                          selected ? "bg-primary-soft" : "hover:bg-surface-muted",
                        )}
                      >
                        <span className="min-w-0">
                          <strong className="block truncate text-[0.9375rem]">{topic.label}</strong>
                          <span className="block truncate text-[0.75rem] text-ink-subtle">{topic.hint}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {pct !== null && pct < 60 ? (
                            <span className="rounded-full bg-brick-soft px-2 py-0.5 text-[0.6875rem] font-extrabold text-brick-deep">Prioritas</span>
                          ) : null}
                          <span className={cn("w-14 text-right text-[0.8125rem] font-extrabold", tone.text)}>{pct !== null ? `${pct}%` : "baru"}</span>
                          {selected ? <Check aria-hidden className="size-4 text-primary" /> : <span className="size-4" />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
    </div>
  );
}

const MINI_TESTS = [
  { section: "listening", title: "Listening", Icon: Headphones, tone: "bg-sky-soft text-sky", note: "audio sekali putar" },
  { section: "structure", title: "Structure", Icon: PenLine, tone: "bg-primary-soft text-primary", note: "completion & error" },
  { section: "reading", title: "Reading", Icon: BookOpen, tone: "bg-mango-soft text-mango-ink", note: "beberapa teks bacaan" },
] as const;

export function EprtHome(props: EprtHomeProps) {
  const [state, formAction, pending] = useActionState(startToeflBlock, initialState);
  const [targetState, targetAction, targetPending] = useActionState(saveToeflTarget, initialState);
  const startedRef = useRef<string | null>(null);
  // Param ?f=drill|written (mis. dari kartu "Perlu latihan" hasil simulasi)
  // menentukan pilihan awal segmented control bentuk soal Structure.
  const formatParam = useSearchParams().get("f");
  const [format, setFormat] = useState<"drill" | "written">(
    formatParam === "written" ? "written" : "drill",
  );
  const [pickedSkill, setPickedSkill] = useState<SkillKey | null>(null);
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
            "flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border-2 px-4 text-left text-[0.9375rem] font-extrabold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
            tone === "warning"
              ? "border-mango-line bg-mango-soft text-mango-ink"
              : "border-hairline bg-surface-muted text-ink hover:border-primary-line hover:bg-surface",
          )}
        >
          {title}
          <span className={cn("flex items-center gap-2 text-[0.8125rem] font-bold", tone === "plain" && "text-ink-subtle")}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {detail}
          </span>
        </button>
      </form>
    );
  }

  const structureTopics = props.topics.filter((topic) => topic.section === "structure");
  const readingTopics = props.topics
    .filter((topic) => topic.section === "reading")
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  const allTopics = [...structureTopics, ...readingTopics];
  // Bawaan: topik paling lemah (akurasi terendah dari >= 3 soal); kalau belum ada, topik pertama.
  const weakestTopic = allTopics
    .filter((topic) => topic.answered >= 3 && topic.pct !== null)
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))[0];
  const picked = allTopics.find((topic) => topic.skill === pickedSkill) ?? weakestTopic ?? allTopics[0];
  const pickedKind = picked?.section === "structure" ? format : "reading";
  const pickedKey = picked ? `${pickedKind}:${picked.skill}` : "";
  const pickedBusy = pending && startedRef.current === pickedKey;
  const pickedPct = picked && picked.answered >= 3 ? picked.pct : null;
  const gap = target && props.estimate !== null ? target.score - props.estimate : null;
  const firstTrend = props.trend[0];
  const delta = props.estimate !== null && firstTrend !== undefined && props.trend.length > 1 ? props.estimate - firstTrend : null;

  return (
    <div className="flex flex-col gap-6">
      {pending ? <PendingOverlay /> : null}

      {/* Hero Kaka */}
      <section aria-labelledby="sim-title" className="rise flex flex-wrap items-center gap-8 rounded-[32px] bg-charcoal p-6 text-charcoal-ink sm:p-8">
        <div className="flex min-w-0 flex-[1_1_380px] items-end gap-5">
          <Kaka
            mood={(props.daysToTest !== null && props.daysToTest <= 7) || props.weakest ? "warn" : "coach"}
            size={150}
            label="Kaka, pelatih EPrT-mu"
            className="hidden shrink-0 sm:block"
          />
          <div className="flex flex-col gap-2 pb-2">
            <span className="eyebrow text-mango-line">Kaka, pelatih EPrT-mu</span>
            <h1 id="sim-title" className="font-display text-[1.75rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[1.875rem]">
              {props.weakest
                ? `Kejar ${props.weakest.label}: baru ${props.weakest.pct}% benar.`
                : props.estimate !== null
                  ? `Perkiraan skormu ${props.estimate}. Terus asah.`
                  : `Halo ${props.username}. Mulai dari satu simulasi untuk tahu posisimu.`}
            </h1>
            <p className="text-charcoal-muted">
              {props.weakest
                ? `Dari ${props.weakest.answered} soal yang kamu jawab, di sinilah kebocoran terbesar. Latihan per topik di bawah bisa menolong.`
                : "Listening 50, Structure 40, Reading 50 dengan timer tiap section. Skor dan pembahasan muncul di akhir."}
            </p>
          </div>
        </div>
        <div className="grid min-w-0 flex-[1_1_320px] grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-[20px] bg-charcoal-raised p-[18px]">
            <span className="text-[0.75rem] font-extrabold tracking-[0.06em] text-charcoal-muted">HITUNG MUNDUR</span>
            {props.daysToTest !== null && props.daysToTest >= 0 ? (
              <>
                <span className="font-round text-[2.75rem] font-extrabold leading-none text-mango"><CountUp to={props.daysToTest} ms={600} /></span>
                <span className="text-[0.8125rem] text-charcoal-muted">
                  hari lagi{target?.testDate ? ` · ${formatDate(target.testDate)}` : ""}
                </span>
              </>
            ) : (
              <a href="#target" className="mt-2 text-[0.9375rem] font-extrabold text-mango-line hover:underline">
                {props.daysToTest !== null ? "Tanggal tes sudah lewat · perbarui" : "Atur tanggal tes"}
              </a>
            )}
          </div>
          <div className="flex flex-col gap-1 rounded-[20px] bg-charcoal-raised p-[18px]">
            <span className="text-[0.75rem] font-extrabold tracking-[0.06em] text-charcoal-muted">PERKIRAAN SKOR</span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-round text-[2.75rem] font-extrabold leading-none">{props.estimate !== null ? <CountUp to={props.estimate} /> : "–"}</span>
              {delta !== null && delta !== 0 ? (
                <span className={cn("text-[0.875rem] font-extrabold", delta > 0 ? "text-mint" : "text-brick-line")}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                </span>
              ) : null}
            </span>
            <Sparkline values={props.trend} target={target?.score ?? null} />
            <span className="text-[0.8125rem] text-charcoal-muted">
              {props.estimate === null
                ? "muncul setelah ±10 soal Structure & Reading"
                : target
                  ? gap !== null && gap > 0
                    ? `target ${target.score} · kurang ${gap} poin`
                    : `target ${target.score} · tercapai`
                  : "atur target di bawah"}
            </span>
          </div>
        </div>
      </section>

      {/* Simulasi berjalan */}
      {activeSim ? (
        <section
          aria-label="Simulasi yang sedang berjalan"
          className="rise flex flex-wrap items-center gap-5 rounded-[24px] border-2 border-mango-line bg-surface px-6 py-5 shadow-[0_4px_0_var(--color-mango-line)] [--i:1]"
        >
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            <span className="eyebrow text-mango-ink">
              Sedang berjalan · bagian {Math.min(activeSim.doneParts + 1, activeSim.totalParts)} dari {activeSim.totalParts}
            </span>
            <strong className="font-display text-[1.25rem]">
              {activeSim.scope
                ? `Mini-test ${activeSim.scope[0].toUpperCase()}${activeSim.scope.slice(1)} belum selesai`
                : "Simulasi penuh kamu belum selesai"}
            </strong>
            <span className="text-[0.875rem] text-ink-subtle">
              {activeSim.nextTitle ? `Berikutnya ${activeSim.nextTitle}. ` : ""}
              {activeSim.doneQuestions} dari {activeSim.totalQuestions} soal sudah dikerjakan. Timer section tetap berjalan walau
              browser ditutup.
            </span>
            <div
              role="progressbar"
              aria-label="Progres simulasi"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 h-2.5 overflow-hidden rounded-full bg-canvas-deep"
            >
              <div className="grow-x h-full rounded-full bg-mango" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            {activeSim.msLeft != null ? <SectionCountdown msLeft={activeSim.msLeft} /> : null}
            <Link
              href={`/eptr/simulasi?id=${activeSim.id}`}
              className="flex h-[54px] items-center gap-2 rounded-[16px] bg-charcoal px-6 font-display text-[1rem] font-extrabold tracking-[0.03em] text-charcoal-ink shadow-[0_5px_0_#000] transition-transform active:translate-y-[5px] active:shadow-none"
            >
              {activeSim.scope ? "LANJUTKAN MINI-TEST" : "LANJUTKAN SIMULASI"}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}

      {/* Mulai tes baru */}
      <section aria-labelledby="mini-title" className="rise flex flex-col gap-3.5 [--i:2]">
        <h2 id="mini-title" className="font-display text-[1.375rem] font-extrabold">
          Mulai tes baru
        </h2>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div className="flex flex-col gap-2.5 rounded-[24px] bg-charcoal p-[22px] text-charcoal-ink shadow-[0_4px_0_#000]">
            <span className="eyebrow text-mango-line">Simulasi penuh · 115 mnt</span>
            <strong className="font-display text-[1.25rem] leading-tight">Listening 50, Structure 40, Reading 50</strong>
            <span className="text-[0.875rem] text-charcoal-muted">Timer per section. Skor &amp; pembahasan di akhir.</span>
            <div className="mt-auto flex flex-col gap-2 pt-1">
              <StartSimulationButton
                disabled={!props.configured}
                label={activeSim ? "Simulasi baru" : "Mulai simulasi"}
                className="h-12 rounded-[14px] bg-mango px-5 text-[0.9375rem] font-extrabold text-mango-on shadow-[0_5px_0_var(--color-mango-deep)] hover:bg-mango"
              />
            </div>
          </div>
          {MINI_TESTS.map((test) => (
            <div key={test.section} className="flex flex-col gap-2.5 rounded-[24px] border-2 border-hairline bg-surface p-[22px] shadow-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary-line motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span className="flex items-center gap-2.5">
                <span className={cn("grid size-11 place-items-center rounded-[12px]", test.tone)}>
                  <test.Icon className="size-[22px]" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="eyebrow text-ink-subtle">Mini-test</span>
              </span>
              <strong className="font-display text-[1.25rem]">{test.title}</strong>
              <span className="flex items-center gap-1.5 text-[0.875rem] text-ink-subtle">
                <Clock className="size-3.5" aria-hidden />
                {scopeQuestionTotal(test.section)} soal · {SECTION_MINUTES[test.section]} mnt · {test.note}
              </span>
              <StartSimulationButton
                section={test.section}
                disabled={!props.configured}
                label="Mulai"
                className="mt-auto h-11 rounded-[14px] px-5 text-[0.9375rem]"
              />
            </div>
          ))}
        </div>
        {!props.configured ? (
          <p className="text-[0.9375rem] font-bold text-brick-deep">Pembuatan soal belum aktif. Hubungi admin.</p>
        ) : null}
      </section>

      {state.status === "error" ? (
        <p role="alert" className="rounded-[14px] bg-brick-soft px-4 py-3 text-[0.9375rem] font-bold text-brick-deep">
          {state.message}
        </p>
      ) : null}

      {/* Latihan per topik */}
      <section aria-labelledby="topic-title" className="rise flex flex-col gap-3.5 [--i:3]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="topic-title" className="font-display text-[1.375rem] font-extrabold">
              Latihan per topik
            </h2>
            <p className="text-[0.875rem] text-ink-subtle">10 soal · fokus satu topik · di bawah 60% ditandai prioritas</p>
          </div>
          <div role="radiogroup" aria-label="Bentuk soal Structure" className="relative flex gap-1 rounded-control bg-canvas-deep p-1">
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc(50%-6px)] rounded-[10px] bg-surface shadow-[0_2px_0_var(--color-hairline-strong)] transition-transform duration-200 ease-out"
              style={{ transform: `translateX(calc(${format === "written" ? 1 : 0} * (100% + 4px)))` }}
            />
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
                  "h-10 flex-1 cursor-pointer rounded-[10px] px-3.5 text-[0.875rem]",
                  format === value ? "relative z-10 font-extrabold text-ink transition-colors duration-200" : "relative z-10 font-bold text-ink-muted transition-colors duration-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {picked ? (
          <div className="flex flex-col gap-4 rounded-[24px] border-2 border-hairline bg-surface p-5">
            <div className="flex flex-col gap-1.5">
              <Label>Pilih topik</Label>
              <TopicDropdown
                groups={[
                  { title: "Structure", topics: structureTopics },
                  { title: "Reading", topics: readingTopics },
                ]}
                value={picked}
                onChange={(topic) => setPickedSkill(topic.skill)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-[200px] flex-1">
                <p className="mb-1.5 text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-ink-subtle">Akurasi kamu</p>
                {pickedPct !== null ? (
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas-deep">
                      <span key={picked.skill} className={cn("grow-x block h-full", pctTone(pickedPct).bar)} style={{ width: `${pickedPct}%` }} />
                    </span>
                    <strong className={cn("w-10 text-[0.875rem]", pctTone(pickedPct).text)}>{pickedPct}%</strong>
                  </span>
                ) : (
                  <span className="text-[0.875rem] text-ink-subtle">belum cukup data ({picked.answered} soal dijawab)</span>
                )}
              </div>
              <form
                action={formAction}
                onSubmit={() => {
                  startedRef.current = pickedKey;
                }}
              >
                <input type="hidden" name="kind" value={pickedKind} />
                <input type="hidden" name="skill" value={picked.skill} />
                <input type="hidden" name="track" value="eptr" />
                <button
                  type="submit"
                  disabled={pending || !props.configured}
                  className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[14px] bg-primary px-6 text-[1rem] font-extrabold text-white shadow-[0_4px_0_var(--color-primary-deep)] transition-transform active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pickedBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Latih 10 soal
                </button>
              </form>
            </div>
            {picked.section === "reading" ? (
              <p className="text-[0.8125rem] text-ink-subtle">Reading per tipe soal membuat teks baru, tunggu sekitar 30 detik.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Latihan per bagian */}
      <section aria-labelledby="practice-title" className="rise flex flex-col gap-3.5 [--i:4]">
        <h2 id="practice-title" className="font-display text-[1.375rem] font-extrabold">
          Latihan per bagian
        </h2>
        <div className="grid gap-3.5 md:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2.5 rounded-plate border-2 border-hairline bg-surface p-5">
              <p className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
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

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
          {/* Riwayat */}
          <section aria-labelledby="history-title" className="flex flex-col gap-3.5">
            <h2 id="history-title" className="font-display text-[1.375rem] font-extrabold">
              Riwayat simulasi
            </h2>
            {props.simulations.length ? (
              <ol className="overflow-hidden rounded-[24px] border-2 border-hairline bg-surface">
                {props.simulations.map((sim, i) => (
                  <li key={sim.id} className={cn(i > 0 && "border-t-2 border-hairline-soft")}>
                    <Link href={`/eptr/simulasi?id=${sim.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted">
                      <span className="w-14 text-center font-round text-[1.625rem] font-extrabold leading-none">
                        {sim.completed ? sim.total : "…"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block">{sim.scope ? `Mini-test ${sim.sections ?? ""}`.trim() : "Simulasi penuh"}</strong>
                        <span className="text-[0.8125rem] text-ink-subtle">
                          {formatDate(sim.createdAt)} ·{" "}
                          {sim.completed ? (sim.scope ? "skor section (31–68)" : sim.sections) : `${sim.started} dari ${sim.partTotal} bagian dibuka`}
                        </span>
                      </span>
                      <span className="text-[0.875rem] font-extrabold text-primary-deep">{sim.completed ? "Pembahasan" : "Lanjutkan"}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex items-center gap-4 rounded-[20px] border-2 border-dashed border-hairline-strong p-6">
                <Kaka mood="sleep" size={88} />
                <span>
                  <strong className="block font-display text-[1.125rem]">Belum ada simulasi</strong>
                  <span className="text-[0.875rem] text-ink-subtle">Kaka masih tidur. Bangunkan dengan satu mini-test.</span>
                </span>
              </div>
            )}
          </section>

          <section aria-labelledby="practice-history" className="flex flex-col gap-3.5">
            <h2 id="practice-history" className="font-display text-[1.375rem] font-extrabold">
              Latihan terakhir
            </h2>
            {props.practice.length === 0 ? (
              <p className="text-[0.9375rem] text-ink-subtle">Belum ada. Mulai dari salah satu latihan di atas.</p>
            ) : (
              <ul className="overflow-hidden rounded-[24px] border-2 border-hairline bg-surface">
                {props.practice.slice(0, 6).map((item, i) => (
                  <li key={item.id} className={cn(i > 0 && "border-t-2 border-hairline-soft")}>
                    <Link href={`/eptr?s=${item.id}`} className="flex min-h-12 items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
                      <span className="min-w-0 truncate text-[0.9375rem]">{item.label}</span>
                      <span className={cn("shrink-0 text-[0.875rem] font-extrabold", item.completed ? "text-primary-deep" : "text-mango-ink")}>
                        {item.completed ? (item.score ?? "selesai") : "lanjutkan"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section
          id="target"
          aria-labelledby="target-title"
          className="flex w-full flex-col gap-3.5 rounded-[24px] border-2 border-hairline bg-surface p-[22px] lg:w-[340px] lg:shrink-0"
        >
          <div>
            <h2 id="target-title" className="font-display text-[1.25rem] font-extrabold">
              Target tesmu
            </h2>
            <p className="text-[0.875rem] text-ink-subtle">Dipakai untuk level soal dan hitung mundur.</p>
          </div>
          <form action={targetAction} className="flex flex-col gap-3.5">
            <input type="hidden" name="track" value="eptr" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="score">Skor target (310–677)</Label>
              <Input id="score" name="score" type="number" min={310} max={677} defaultValue={target?.score ?? 500} className="tnum font-round text-[1.25rem] font-extrabold" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="testDate">Tanggal tes</Label>
              <Input id="testDate" name="testDate" type="date" defaultValue={target?.testDate ?? ""} className="font-bold" />
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={targetPending}>
              {targetPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Simpan target
            </Button>
          </form>
          <FieldError>{targetState.status === "error" ? targetState.message : undefined}</FieldError>
          <div className="grid grid-cols-2 gap-2.5 border-t-2 border-hairline-soft pt-3.5 text-[0.8125rem]">
            <span>
              <span className="block font-round text-[1.375rem] font-extrabold leading-tight">{props.streak}</span>
              <span className="text-ink-subtle">hari streak</span>
            </span>
            <span>
              <span className={cn("block font-round text-[1.375rem] font-extrabold leading-tight", props.reviewsDue > 0 && "text-mango-deep")}>
                {props.reviewsDue}
              </span>
              <span className="text-ink-subtle">soal ulang jatuh tempo</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
