"use client";

import {
  ArrowRight,
  BookOpen,
  Headphones,
  Loader2,
  MessageSquare,
  MessagesSquare,
  PenLine,
  Presentation,
  RotateCcw,
  SearchCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { CountUp } from "@/components/fx/count-up";
import { Kaka } from "@/components/mascot";
import { PendingOverlay } from "@/components/pending-overlay";
import { FieldError } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { SECTION_MINUTES, scopeQuestionTotal } from "@/lib/eprt-simulation";
import type { SkillKey, ToeflSection } from "@/lib/toefl";
import { cn } from "@/lib/utils";

import { saveToeflTarget, startToeflBlock, type ToeflState } from "./actions";
import { StartSimulationButton } from "./simulasi/simulation-client";
import { SectionCountdown } from "./toefl-widgets";

const initialState: ToeflState = { status: "idle" };

export type ToeflHomeProps = {
  username: string;
  configured: boolean;
  daysToTest: number | null;
  target: { score: number; testDate: string | null } | null;
  estimate: number | null;
  /** Skor skala 31-68 per section dari perkiraan yang sama; listening null bila datanya belum cukup. */
  sections: { listening: number | null; structure: number; reading: number; estimated: boolean } | null;
  trend: number[];
  /** Skor total tiap simulasi penuh yang selesai, urut dari yang terlama. */
  fullScores: { date: string; total: number }[];
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
    parts: { section: ToeflSection; done: boolean }[];
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
    tone: "bg-sky-soft text-sky-deep",
    blocks: [
      { kind: "listening", title: "Short Dialogue", detail: "10 soal · 8 mnt", icon: MessageSquare },
      { kind: "listening-15", title: "Short Dialogue panjang", detail: "15 soal · 12 mnt", icon: MessagesSquare },
      { kind: "listen-long", title: "Long Dialogue", detail: "8 soal · 10 mnt", icon: Users },
      { kind: "listen-lecture", title: "Lecture", detail: "8 soal · 10 mnt", icon: Presentation },
    ],
  },
  {
    title: "Structure",
    icon: PenLine,
    tone: "bg-primary-soft text-primary-deep",
    blocks: [
      { kind: "drill", title: "Sentence Completion", detail: "10 soal · 8 mnt", icon: PenLine },
      { kind: "written", title: "Error Recognition", detail: "10 soal · 8 mnt", icon: SearchCheck },
    ],
  },
  {
    title: "Reading",
    icon: BookOpen,
    tone: "bg-mango-soft text-mango-ink",
    blocks: [{ kind: "reading", title: "Satu teks bacaan", detail: "10 soal · 15 mnt", icon: BookOpen }],
  },
] as const;

const MINI_TESTS = [
  { section: "listening", title: "Listening", note: "audio diputar sekali" },
  { section: "structure", title: "Structure", note: "completion dan error recognition" },
  { section: "reading", title: "Reading", note: "beberapa teks bacaan" },
] as const;

const SECTION_NAME: Record<ToeflSection, string> = { listening: "Listening", structure: "Structure", reading: "Reading" };

const CARD = "rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(40,30,10,0.05),0_8px_28px_rgba(40,30,10,0.06)]";
const H2 = "font-display text-[1.5rem] font-bold tracking-[-0.02em]";
const CAP = "text-[0.8125rem] font-semibold text-ink-subtle";
const BTN =
  "inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[14px] bg-primary px-6 font-display text-[1rem] font-bold text-white shadow-[0_6px_16px_rgba(30,122,76,0.28)] transition-[background-color,transform] duration-150 hover:bg-primary-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
const BTN_SOFT = "bg-surface text-ink shadow-none ring-[1.5px] ring-inset ring-hairline hover:bg-surface-muted";
const LINK_BTN =
  "inline-flex min-h-11 cursor-pointer items-center rounded-[10px] px-2 text-[0.9375rem] font-semibold text-primary-deep transition-colors hover:bg-primary-soft motion-reduce:transition-none";
const TILE =
  "group relative flex h-full min-h-[136px] w-full cursor-pointer flex-col items-start gap-4 rounded-[20px] bg-surface p-5 text-left shadow-[0_1px_2px_rgba(40,30,10,0.05),0_8px_28px_rgba(40,30,10,0.06)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(40,30,10,0.06),0_14px_34px_rgba(40,30,10,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const FIELD =
  "h-[52px] w-full rounded-[12px] border-[1.5px] border-hairline bg-surface px-4 font-round text-[1.125rem] font-extrabold text-ink outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-primary-soft";

const MIN_SCORE = 310;
const MAX_SCORE = 677;
const SECTION_LOW = 31;
const SECTION_HIGH = 68;

const sectionPct = (score: number) => ((score - SECTION_LOW) / (SECTION_HIGH - SECTION_LOW)) * 100;

function pctTone(pct: number | null) {
  if (pct === null) return { bar: "bg-hairline-strong", text: "text-ink-subtle" };
  if (pct < 55) return { bar: "bg-brick-bright", text: "text-brick-deep" };
  if (pct < 70) return { bar: "bg-mango", text: "text-mango-ink" };
  return { bar: "bg-primary", text: "text-primary-deep" };
}

/** Panah dan Home/End memindahkan pilihan di radiogroup atau tablist, fokus ikut pindah. */
function roveKeys(event: React.KeyboardEvent<HTMLElement>, count: number, index: number, select: (index: number) => void) {
  const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const group = event.currentTarget.closest('[role="radiogroup"],[role="tablist"]');
  const next = (index + step + count) % count;
  select(next);
  requestAnimationFrame(() => group?.querySelectorAll<HTMLElement>('[role="radio"],[role="tab"]')[next]?.focus());
}

type Topic = ToeflHomeProps["topics"][number];
type Tab = "latihan" | "simulasi" | "riwayat";
const TABS: { id: Tab; label: string }[] = [
  { id: "latihan", label: "Latihan" },
  { id: "simulasi", label: "Simulasi" },
  { id: "riwayat", label: "Riwayat & target" },
];

function Meter({ value, min, max, target, label, className, fill }: { value: number; min: number; max: number; target?: number | null; label: string; className: string; fill: string }) {
  const at = (n: number) => `${Math.min(100, Math.max(0, ((n - min) / (max - min)) * 100))}%`;
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} className={cn("relative rounded-full bg-canvas-deep", className)}>
      <div className={cn("grow-x h-full rounded-full", fill)} style={{ width: at(value) }} />
      {target != null ? <span aria-hidden className="absolute -top-1 h-[calc(100%+8px)] w-[3px] rounded-sm bg-brick" style={{ left: at(target) }} /> : null}
    </div>
  );
}

function TrendChart({ values, labels, target, subject }: { values: number[]; labels: string[]; target: number | null; subject: string }) {
  const W = 600;
  const H = 210;
  const lo = Math.min(...values, target ?? Infinity) - 12;
  const hi = Math.max(...values, target ?? 0) + 12;
  const x = (i: number) => (values.length === 1 ? W / 2 : 60 + (i * (W - 120)) / (values.length - 1));
  const y = (v: number) => 44 + ((hi - v) / (hi - lo)) * 116;
  const pos = (px: number, py: number) => ({ left: `${(px / W) * 100}%`, top: `${(py / H) * 100}%` });
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  const showDate = (i: number) => values.length <= 3 || i === 0 || i === last;
  return (
    <div
      role="img"
      aria-label={`${subject}: ${values.map((v, i) => `${v}${labels[i] ? ` pada ${labels[i]}` : ""}`).join(", ")}${target ? `. Target ${target}.` : "."}`}
      className="relative aspect-[600/210] w-full"
    >
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="reveal absolute inset-0 size-full">
        {target ? <line x1={20} x2={580} y1={y(target)} y2={y(target)} stroke="var(--color-brick)" strokeWidth={1.5} strokeDasharray="6 6" /> : null}
        {values.length > 1 ? <polyline points={points} fill="none" stroke="var(--color-primary)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 8 : 6} fill={i === last ? "var(--color-primary)" : "#fff"} stroke={i === last ? "#fff" : "var(--color-primary)"} strokeWidth={3} />
        ))}
      </svg>
      {target ? (
        <span className="absolute -translate-x-full -translate-y-full pb-1 text-[0.8125rem] font-bold text-brick-deep" style={pos(580, y(target))}>
          target {target}
        </span>
      ) : null}
      {values.map((v, i) => (
        <span key={i} className="tnum absolute -translate-x-1/2 -translate-y-full pb-2.5 font-mono text-[0.8125rem] font-bold text-ink" style={pos(x(i), y(v))}>
          {v}
        </span>
      ))}
      {labels.map((label, i) =>
        showDate(i) ? (
          <span key={i} className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[0.75rem] text-ink-subtle" style={{ left: pos(x(i), 0).left }}>
            {label}
          </span>
        ) : null,
      )}
    </div>
  );
}

export function ToeflHome(props: ToeflHomeProps) {
  const [state, formAction, pending] = useActionState(startToeflBlock, initialState);
  const [targetState, targetAction, targetPending] = useActionState(saveToeflTarget, initialState);
  const startedRef = useRef<string | null>(null);
  // Param ?f=drill|written (mis. dari kartu "Perlu latihan" hasil simulasi)
  // menentukan pilihan awal bentuk soal Structure.
  const formatParam = useSearchParams().get("f");
  const [format, setFormat] = useState<"drill" | "written">(formatParam === "written" ? "written" : "drill");
  const [pickedSkill, setPickedSkill] = useState<SkillKey | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { activeSim, target, sections } = props;
  const [tab, setTab] = useState<Tab>(activeSim ? "simulasi" : "latihan");
  function openTarget() {
    setTab("riwayat");
    requestAnimationFrame(() => document.getElementById("target")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  // Tautan "/toefl#target" (sidebar, hero) harus membuka tab Riwayat & target, juga bila halaman ini sudah terbuka.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#target") openTarget();
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('a[href="/toefl#target"]')) openTarget();
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);
  const progress = activeSim ? Math.round((activeSim.doneQuestions / activeSim.totalQuestions) * 100) : 0;

  function blockButton(
    kind: string,
    title: string,
    detail: string,
    Icon: LucideIcon,
    tone: string,
    warning = false,
  ) {
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
        <button type="submit" disabled={disabled} className={TILE}>
          <span className="flex w-full items-start justify-between">
            <span className={cn("grid size-11 place-items-center rounded-[12px]", tone)}>
              <Icon className="size-[22px]" strokeWidth={2.2} aria-hidden />
            </span>
            {busy ? (
              <Loader2 className="size-5 animate-spin text-ink-subtle" aria-hidden />
            ) : (
              <ArrowRight
                className="size-5 -translate-x-1 text-ink-subtle opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
                aria-hidden
              />
            )}
          </span>
          <span className="mt-auto flex flex-col gap-1">
            <strong className="font-display text-[1.0625rem] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</strong>
            <span
              className={cn(
                "text-[0.8125rem] font-medium text-ink-subtle",
                warning && "self-start rounded-full bg-mango-soft px-2.5 py-0.5 font-bold text-mango-ink",
              )}
            >
              {detail}
            </span>
          </span>
        </button>
      </form>
    );
  }

  const rate = (topic: Topic) => (topic.answered >= 3 ? topic.pct : null);
  const allTopics = [
    ...props.topics.filter((topic) => topic.section === "structure"),
    ...props.topics.filter((topic) => topic.section === "reading"),
  ];
  // Paling lemah di atas; topik yang belum cukup datanya ("baru") di bawah.
  const sortedTopics = [...allTopics].sort((a, b) => (rate(a) ?? 101) - (rate(b) ?? 101));
  const weakestTopic = sortedTopics.find((topic) => rate(topic) !== null);
  const picked = allTopics.find((topic) => topic.skill === pickedSkill) ?? weakestTopic ?? allTopics[0];
  const shownTopics = showAll || sortedTopics.indexOf(picked) >= 6 ? sortedTopics : sortedTopics.slice(0, 6);
  const weakestKind = weakestTopic?.section === "structure" ? format : "reading";
  const weakestKey = weakestTopic ? `${weakestKind}:${weakestTopic.skill}` : "";
  const pickedKind = picked?.section === "structure" ? format : "reading";
  const pickedKey = picked ? `${pickedKind}:${picked.skill}` : "";
  const pickedBusy = pending && startedRef.current === pickedKey;
  const pickedPct = picked ? rate(picked) : null;
  const gap = target && props.estimate !== null ? target.score - props.estimate : null;
  const firstTrend = props.trend[0];
  const delta = props.estimate !== null && firstTrend !== undefined && props.trend.length > 1 ? props.estimate - firstTrend : null;
  const targetSection = target ? Math.min(SECTION_HIGH, Math.max(SECTION_LOW, Math.round(target.score / 10))) : null;
  const sectionRows = sections
    ? ([["listening", sections.listening], ["structure", sections.structure], ["reading", sections.reading]] as const)
    : [];
  const scored = sectionRows.flatMap(([, score]) => (score === null ? [] : [score]));
  const lowest = scored.length > 1 && Math.min(...scored) !== Math.max(...scored) ? Math.min(...scored) : null;

  const heroAction = activeSim ? (
    <Link href={`/toefl/simulasi?id=${activeSim.id}`} className={BTN}>
      {activeSim.scope ? "Lanjutkan mini-test" : "Lanjutkan simulasi"}
      <ArrowRight className="size-5" aria-hidden />
    </Link>
  ) : weakestTopic ? (
    <form
      action={formAction}
      onSubmit={() => {
        startedRef.current = weakestKey;
      }}
    >
      <input type="hidden" name="kind" value={weakestKind} />
      <input type="hidden" name="skill" value={weakestTopic.skill} />
      <input type="hidden" name="track" value="eptr" />
      <button type="submit" disabled={pending || !props.configured} className={BTN}>
        {pending && startedRef.current === weakestKey ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Latih 10 soal
        <ArrowRight className="size-5" aria-hidden />
      </button>
    </form>
  ) : (
    <button type="button" onClick={() => setTab("simulasi")} className={BTN}>
      Mulai simulasi penuh
      <ArrowRight className="size-5" aria-hidden />
    </button>
  );

  const timeline = activeSim
    ? [...new Set(activeSim.parts.map((part) => part.section))].map((section) => {
        const mine = activeSim.parts.filter((part) => part.section === section);
        const done = mine.every((part) => part.done);
        const current = !done && section === activeSim.parts.find((part) => !part.done)?.section;
        const minutes = SECTION_MINUTES[section];
        const used = current && activeSim.msLeft != null ? Math.min(1, Math.max(0, 1 - activeSim.msLeft / (minutes * 60_000))) : 0;
        return { section, minutes, done, current, used };
      })
    : [];

  return (
    <div className="flex flex-col gap-10 pb-10 sm:gap-12">
      {pending ? <PendingOverlay /> : null}

      {/* Hero */}
      <section aria-labelledby="sim-title" className="rise flex flex-wrap items-center gap-x-14 gap-y-10 pt-4 sm:pt-8">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          {props.daysToTest !== null && props.daysToTest >= 0 ? (
            <span className={CAP}>
              {props.daysToTest} hari lagi menuju tes{target?.testDate ? ` · ${formatDate(target.testDate)}` : ""}
            </span>
          ) : (
            <button
              type="button"
              onClick={openTarget}
              className="-ml-2 min-h-11 cursor-pointer self-start rounded-[10px] px-2 text-left text-[0.8125rem] font-semibold text-primary-deep hover:bg-primary-soft"
            >
              {props.daysToTest !== null ? "Tanggal tes sudah lewat, perbarui" : "Atur tanggal tes"}
            </button>
          )}
          <h1 id="sim-title" className="font-display text-[clamp(2rem,4.6vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.03em]">
            {weakestTopic ? (
              <>
                Mulai dari{" "}
                <mark className="rounded-lg bg-mango-mark px-1.5 text-ink [box-decoration-break:clone]">{weakestTopic.label}</mark>, baru {weakestTopic.pct}% benar.
              </>
            ) : props.weakest ? (
              `Kejar ${props.weakest.label}: baru ${props.weakest.pct}% benar.`
            ) : props.estimate !== null ? (
              `Perkiraan skormu ${props.estimate}.`
            ) : (
              `Halo ${props.username}. Mulai dari satu simulasi untuk tahu posisimu.`
            )}
          </h1>
          <p className="max-w-[30rem] text-[1.0625rem] leading-relaxed text-ink-muted">
            {weakestTopic
              ? `Dari ${weakestTopic.answered} soal topik ini, ${Math.round((weakestTopic.answered * (weakestTopic.pct ?? 0)) / 100)} yang benar. Sepuluh soal berikutnya makan sekitar ${weakestTopic.section === "reading" ? 15 : 8} menit.`
              : "Listening 50, Structure 40, Reading 50, dengan timer tiap section. Skor dan pembahasan muncul di akhir."}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            {heroAction}
            {!activeSim && weakestTopic ? (
              <button type="button" onClick={() => setTab("simulasi")} className={LINK_BTN}>
                Mulai simulasi penuh
              </button>
            ) : null}
          </div>
        </div>

        <div className={cn(CARD, "flex min-w-0 flex-[1_1_380px] flex-col gap-7 p-6 sm:p-8")}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className={CAP}>Perkiraan skor</span>
              <div className="font-round text-[4.5rem] font-extrabold leading-none tracking-[-0.04em]">
                {props.estimate !== null ? <CountUp to={props.estimate} /> : "–"}
              </div>
            </div>
            {delta !== null && delta !== 0 ? (
              <span className={cn("rounded-full px-3 py-1.5 text-[0.875rem] font-bold", delta > 0 ? "bg-primary-soft text-primary-deep" : "bg-brick-soft text-brick-deep")}>
                {delta > 0 ? "naik" : "turun"} {Math.abs(delta)} poin
              </span>
            ) : null}
          </div>

          {props.estimate !== null ? (
            <div>
              <Meter value={props.estimate} min={MIN_SCORE} max={MAX_SCORE} target={target?.score} label="Perkiraan skor total" className="h-2.5" fill="bg-primary" />
              <div className="mt-2.5 flex justify-between gap-2 text-[0.8125rem] text-ink-subtle">
                <span>{MIN_SCORE}</span>
                {target ? (
                  <span className="text-center font-bold text-brick-deep">
                    {gap !== null && gap > 0 ? `target ${target.score}, kurang ${gap}` : `target ${target.score}, tercapai`}
                  </span>
                ) : (
                  <span>atur target di tab Riwayat</span>
                )}
                <span>{MAX_SCORE}</span>
              </div>
            </div>
          ) : (
            <p className="text-[0.9375rem] text-ink-subtle">Muncul setelah sekitar 10 soal Structure dan Reading.</p>
          )}

          {sections ? (
            <div className="flex flex-col gap-4">
              {sectionRows.map(([key, score]) => (
                <div key={key} className="grid grid-cols-[5.25rem_minmax(0,1fr)_1.75rem] items-center gap-3.5">
                  <span className="text-[0.9375rem] font-semibold">{SECTION_NAME[key]}</span>
                  {score === null ? (
                    <span className="col-span-2 text-[0.8125rem] text-ink-subtle">belum ada data</span>
                  ) : (
                    <>
                      <div role="progressbar" aria-label={`${SECTION_NAME[key]} ${score} dari ${SECTION_HIGH}${targetSection ? `, target ${targetSection}` : ""}`} aria-valuenow={score} aria-valuemin={SECTION_LOW} aria-valuemax={SECTION_HIGH} className="relative h-2 rounded-full bg-canvas-deep">
                        <div className={cn("grow-x h-full rounded-full", lowest !== null && score === lowest ? "bg-mango" : "bg-primary")} style={{ width: `${sectionPct(score)}%` }} />
                        {targetSection ? <span aria-hidden className="absolute -top-[3px] h-3.5 w-0.5 bg-brick" style={{ left: `${sectionPct(targetSection)}%` }} /> : null}
                      </div>
                      <span className={cn("tnum text-right font-mono text-[0.875rem] font-bold", lowest !== null && score === lowest && "text-brick-deep")}>{score}</span>
                    </>
                  )}
                </div>
              ))}
              <span className={CAP}>
                Skala {SECTION_LOW}-{SECTION_HIGH} per section.
                {targetSection ? ` Garis merah menandai ${targetSection}, setara target ${target?.score}.` : ""}
                {sections.listening === null ? " Total memakai asumsi Listening." : ""}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {state.status === "error" ? (
        <p role="alert" className="rounded-[14px] bg-brick-soft px-4 py-3 text-[0.9375rem] font-bold text-brick-deep">
          {state.message}
        </p>
      ) : null}

      <div role="tablist" aria-label="Bagian halaman TOEFL ITP" className="grid w-full max-w-[34rem] grid-cols-3 gap-1 rounded-[14px] bg-canvas-deep p-1">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => roveKeys(event, TABS.length, index, (next) => setTab(TABS[next].id))}
            className={cn(
              "min-h-11 cursor-pointer rounded-[11px] px-2 text-[0.9375rem] font-semibold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
              tab === item.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(40,30,10,0.14)]" : "text-ink-subtle hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "latihan" ? (
        <div role="tabpanel" id="panel-latihan" aria-labelledby="tab-latihan" className="flex flex-col gap-12 sm:gap-14">
          {/* Latihan per topik */}
          <section aria-labelledby="topic-title" className="flex flex-wrap items-start gap-8">
            <div className={cn(CARD, "min-w-0 flex-[1_1_560px] p-4 sm:p-7")}>
              <div className="px-3 pb-4 sm:px-4">
                <h2 id="topic-title" className={H2}>
                  Topik, dari yang paling lemah
                </h2>
                <p className={cn(CAP, "mt-1 font-medium")}>Di bawah 60% berarti prioritas.</p>
              </div>
              {picked ? (
                <div role="radiogroup" aria-label="Pilih topik latihan" className="flex flex-col gap-0.5">
                  {shownTopics.map((topic, index) => {
                    const pct = rate(topic);
                    const tone = pctTone(pct);
                    const selected = topic.skill === picked.skill;
                    return (
                      <button
                        key={topic.skill}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setPickedSkill(topic.skill)}
                        onKeyDown={(event) => roveKeys(event, shownTopics.length, index, (next) => setPickedSkill(shownTopics[next].skill))}
                        className={cn(
                          "grid min-h-[68px] w-full cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors sm:grid-cols-[2.25rem_minmax(0,1fr)_6.875rem_3rem] sm:gap-4 sm:px-4 motion-reduce:transition-none",
                          selected ? "bg-primary-soft/60" : "hover:bg-surface-muted",
                        )}
                      >
                        <span className={cn("flex size-9 items-center justify-center rounded-[10px] font-mono text-[0.8125rem] font-bold transition-colors motion-reduce:transition-none", selected ? "bg-primary text-white" : "bg-canvas text-ink-muted")}>
                          {index < 6 ? String.fromCharCode(65 + index) : index + 1}
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-[1rem] font-bold">{topic.label}</strong>
                          <span className="block text-[0.8125rem] text-ink-subtle">
                            {topic.section === "structure" ? "Structure" : "Reading"} · {topic.hint}
                          </span>
                        </span>
                        <span aria-hidden className="hidden h-1.5 overflow-hidden rounded-full bg-canvas-deep sm:block">
                          {pct !== null ? <span key={topic.skill} className={cn("grow-x block h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} /> : null}
                        </span>
                        <span className={cn("tnum text-right font-mono text-[0.9375rem] font-bold", tone.text)}>{pct !== null ? `${pct}%` : <small className="font-sans text-[0.75rem] font-semibold">baru</small>}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {sortedTopics.length > 6 && shownTopics.length < sortedTopics.length ? (
                <button type="button" onClick={() => setShowAll(true)} className={cn(LINK_BTN, "mt-2 ml-2")}>
                  Tampilkan semua topik ({sortedTopics.length})
                </button>
              ) : null}
            </div>

            {picked ? (
              <aside aria-label="Soal berikutnya" className="flex min-w-0 max-w-[25rem] flex-[1_1_300px] flex-col gap-4 rounded-[20px] bg-primary-soft p-6 sm:p-7 lg:sticky lg:top-4">
                <span className="text-[0.8125rem] font-semibold text-primary-deep">Soal berikutnya</span>
                <strong className="font-display text-[1.75rem] font-bold leading-[1.12] tracking-[-0.02em]">{picked.label}</strong>
                <span className="text-[0.9375rem] leading-normal text-ink-muted">
                  {picked.section === "structure" ? "Structure" : "Reading"} ·{" "}
                  {pickedPct !== null ? `akurasi kamu ${pickedPct}%` : `belum cukup data (${picked.answered} soal dijawab)`} · 10 soal, sekitar{" "}
                  {picked.section === "reading" ? 15 : 8} menit
                </span>

                {picked.section === "structure" ? (
                  <div role="radiogroup" aria-label="Bentuk soal Structure" className="flex flex-wrap gap-1 self-start rounded-[14px] bg-primary-line/50 p-1">
                    {(
                      [
                        ["drill", "Sentence Completion"],
                        ["written", "Error Recognition"],
                      ] as const
                    ).map(([value, label], index) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={format === value}
                        tabIndex={format === value ? 0 : -1}
                        onClick={() => setFormat(value)}
                        onKeyDown={(event) => roveKeys(event, 2, index, (next) => setFormat(next === 0 ? "drill" : "written"))}
                        className={cn(
                          "min-h-11 cursor-pointer rounded-[11px] px-3.5 text-[0.875rem] font-semibold transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none",
                          format === value ? "bg-surface text-ink shadow-[0_1px_3px_rgba(40,30,10,0.14)]" : "text-ink-muted hover:text-ink",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <form
                  action={formAction}
                  onSubmit={() => {
                    startedRef.current = pickedKey;
                  }}
                >
                  <input type="hidden" name="kind" value={pickedKind} />
                  <input type="hidden" name="skill" value={picked.skill} />
                  <input type="hidden" name="track" value="eptr" />
                  <button type="submit" disabled={pending || !props.configured} className={cn(BTN, "w-full")}>
                    {pickedBusy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                    Mulai latihan
                    <ArrowRight className="size-5" aria-hidden />
                  </button>
                </form>
                {picked.section === "reading" ? <p className="text-[0.8125rem] text-ink-muted">Reading per tipe soal membuat teks baru, tunggu sekitar 30 detik.</p> : null}
              </aside>
            ) : null}
          </section>

          {/* Latihan per bagian */}
          <section aria-labelledby="practice-title" className="flex flex-col gap-5">
            <h2 id="practice-title" className={H2}>
              Latihan per bagian
            </h2>
            <div className="flex flex-col gap-9">
              {GROUPS.map((group) => {
                const GroupIcon = group.icon;
                const count = group.blocks.length + (group.title === "Reading" ? 1 : 0);
                return (
                  <div key={group.title} role="group" aria-label={group.title} className="flex flex-col gap-3.5">
                    <p className="flex items-center gap-2.5">
                      <span className={cn("grid size-8 place-items-center rounded-[10px]", group.tone)}>
                        <GroupIcon className="size-[18px]" strokeWidth={2.2} aria-hidden />
                      </span>
                      <span className="font-display text-[1.125rem] font-bold tracking-[-0.01em]">{group.title}</span>
                      <span className={CAP}>{count} latihan</span>
                    </p>
                    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr))]">
                      {group.blocks.map((block) => blockButton(block.kind, block.title, block.detail, block.icon, group.tone))}
                      {group.title === "Reading"
                        ? blockButton(
                            "review",
                            "Ulang kesalahan",
                            props.reviewsDue > 0 ? `${props.reviewsDue} jatuh tempo` : "belum ada",
                            RotateCcw,
                            "bg-brick-soft text-brick-deep",
                            props.reviewsDue > 0,
                          )
                        : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "simulasi" ? (
        <div role="tabpanel" id="panel-simulasi" aria-labelledby="tab-simulasi" className="flex flex-col gap-12 sm:gap-14">
          {activeSim ? (
            <section aria-labelledby="active-title" className={cn(CARD, "flex flex-col gap-7 p-6 sm:p-8")}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className={CAP}>
                    Sedang berjalan · bagian {Math.min(activeSim.doneParts + 1, activeSim.totalParts)} dari {activeSim.totalParts}
                  </span>
                  <h2 id="active-title" className="font-display text-[1.75rem] font-bold leading-[1.1] tracking-[-0.02em]">
                    {activeSim.scope ? `Mini-test ${SECTION_NAME[activeSim.scope]} belum selesai` : "Simulasi penuh belum selesai"}
                  </h2>
                  {activeSim.msLeft != null ? (
                    <div className="mt-1.5">
                      <SectionCountdown msLeft={activeSim.msLeft} />
                    </div>
                  ) : null}
                </div>
                <Link href={`/toefl/simulasi?id=${activeSim.id}`} className={BTN}>
                  {activeSim.scope ? "Lanjutkan mini-test" : "Lanjutkan simulasi"}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>

              <div
                role="img"
                aria-label={timeline
                  .map((item) => `${SECTION_NAME[item.section]} ${item.minutes} menit, ${item.done ? "selesai" : item.current ? "sedang berjalan" : "belum dimulai"}`)
                  .join(". ")}
                className="flex gap-1.5"
              >
                {timeline.map((item) => (
                  <div key={item.section} className="min-w-0" style={{ flex: item.minutes }}>
                    <div className="h-3.5 overflow-hidden rounded-full bg-canvas-deep">
                      <div
                        className={cn("grow-x h-full", item.done ? "bg-primary" : "bg-mango")}
                        style={{ width: item.done ? "100%" : `${item.used * 100}%` }}
                      />
                    </div>
                    <div className="mt-2.5 flex flex-wrap justify-between gap-x-2 text-[0.875rem]">
                      <strong>{SECTION_NAME[item.section]}</strong>
                      <span className="text-[0.8125rem] text-ink-subtle">
                        {item.minutes} mnt{item.done ? " · selesai" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <div role="progressbar" aria-label="Progres simulasi" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-canvas-deep">
                  <div className="grow-x h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[0.9375rem] text-ink-subtle">
                  {activeSim.nextTitle ? `Berikutnya ${activeSim.nextTitle}. ` : ""}
                  {activeSim.doneQuestions} dari {activeSim.totalQuestions} soal sudah dikerjakan. Timer jalan terus walau browser ditutup.
                </p>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="mini-title" className="flex flex-wrap items-start gap-x-14 gap-y-8">
            <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-3.5 pt-2">
              <h2 id="mini-title" className={H2}>
                Mulai tes baru
              </h2>
              <p className="text-[1.0625rem] leading-relaxed text-ink-muted">
                Format dan timer sama dengan tes asli: {scopeQuestionTotal(null)} soal, 115 menit. Skor dan pembahasan keluar di akhir.
              </p>
              <div className="pt-1.5">
                <StartSimulationButton
                  disabled={!props.configured}
                  label={activeSim ? "Simulasi baru" : "Mulai simulasi"}
                  className={cn("min-h-[52px] rounded-[14px] px-6", activeSim ? BTN_SOFT : "shadow-[0_6px_16px_rgba(30,122,76,0.28)] active:translate-y-px")}
                />
              </div>
            </div>
            <div className={cn(CARD, "min-w-0 flex-[1.4_1_25rem] p-3 sm:p-5")}>
              <p className={cn(CAP, "mx-3.5 mb-2 mt-1.5")}>Atau satu section saja</p>
              <ul className="flex flex-col">
                {MINI_TESTS.map((test) => (
                  <li
                    key={test.section}
                    className={cn(
                      "relative flex min-h-[68px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[12px] px-3.5 py-3 transition-colors motion-reduce:transition-none",
                      props.configured && "cursor-pointer hover:bg-surface-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <strong className="block text-[1rem]">{test.title}</strong>
                      <small className="text-[0.8125rem] text-ink-subtle">
                        {test.note} · {scopeQuestionTotal(test.section)} soal · {SECTION_MINUTES[test.section]} mnt
                      </small>
                    </span>
                    <StartSimulationButton section={test.section} disabled={!props.configured} label="Mulai" className={cn("min-h-11 rounded-[12px] px-4 text-[0.9375rem] after:absolute after:inset-0 after:rounded-[12px] after:content-[''] active:translate-y-0! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", BTN_SOFT)} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
          {!props.configured ? <p className="text-[0.9375rem] font-bold text-brick-deep">Pembuatan soal belum aktif. Hubungi admin.</p> : null}
        </div>
      ) : null}

      {tab === "riwayat" ? (
        <div role="tabpanel" id="panel-riwayat" aria-labelledby="tab-riwayat" className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-8">
            <section aria-labelledby="trend-title" className={cn(CARD, "p-5 sm:p-7")}>
              <h2 id="trend-title" className={cn(H2, "mb-4")}>
                Skor tiap simulasi penuh
              </h2>
              {props.fullScores.length >= 2 ? (
                <TrendChart
                  values={props.fullScores.map((item) => item.total)}
                  labels={props.fullScores.map((item) => formatDate(item.date))}
                  target={target?.score ?? null}
                  subject="Skor simulasi penuh"
                />
              ) : (
                <p className="rounded-[14px] border-2 border-dashed border-hairline px-4 py-8 text-center text-[0.9375rem] text-ink-subtle">
                  {props.fullScores.length === 1
                    ? "Baru satu simulasi penuh yang selesai. Selesaikan satu lagi untuk melihat grafik skor."
                    : "Grafik muncul setelah dua simulasi penuh selesai. Mini-test tidak dihitung."}
                </p>
              )}
            </section>

            <section aria-labelledby="history-title" className={cn(CARD, "p-3 sm:p-7")}>
              <h2 id="history-title" className={cn(H2, "mb-3 ml-3 sm:ml-3")}>
                Riwayat simulasi
              </h2>
              {props.simulations.length ? (
                <ol className="flex flex-col gap-0.5">
                  {props.simulations.map((sim) => (
                    <li key={sim.id}>
                      <Link
                        href={`/toefl/simulasi?id=${sim.id}`}
                        className="grid min-h-[68px] grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-3 py-3 transition-colors hover:bg-surface-muted sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 motion-reduce:transition-none"
                      >
                        <span className="font-display text-[2rem] font-bold leading-none tracking-[-0.03em]">{sim.completed ? sim.total : "…"}</span>
                        <span className="min-w-0">
                          <strong className="block text-[1rem]">{sim.scope ? `Mini-test ${sim.sections ?? ""}`.trim() : "Simulasi penuh"}</strong>
                          <span className={cn(CAP, "font-medium")}>
                            {formatDate(sim.createdAt)} ·{" "}
                            {sim.completed ? (sim.scope ? "skor section (31–68)" : sim.sections) : `${sim.started} dari ${sim.partTotal} bagian dibuka`}
                          </span>
                        </span>
                        <span className="text-[0.9375rem] font-semibold text-primary-deep">{sim.completed ? "Pembahasan" : "Lanjutkan"}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex items-center gap-4 rounded-[14px] p-3">
                  <Kaka mood="sleep" size={88} />
                  <span>
                    <strong className="block font-display text-[1.125rem]">Belum ada simulasi</strong>
                    <span className="text-[0.875rem] text-ink-subtle">Kaka masih tidur. Bangunkan dengan satu mini-test.</span>
                  </span>
                </div>
              )}
            </section>

            <section aria-labelledby="practice-history" className={cn(CARD, "p-3 sm:p-7")}>
              <h2 id="practice-history" className={cn(H2, "mb-3 ml-3")}>
                Latihan terakhir
              </h2>
              {props.practice.length === 0 ? (
                <p className="mx-3 text-[0.9375rem] text-ink-subtle">Belum ada. Mulai dari salah satu latihan di tab Latihan.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {props.practice.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <Link href={`/toefl?s=${item.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-surface-muted motion-reduce:transition-none">
                        <span className="min-w-0 truncate text-[0.9375rem]">{item.label}</span>
                        <span className={cn("shrink-0 font-mono text-[0.875rem] font-bold", item.completed ? "text-primary-deep" : "text-mango-ink")}>
                          {item.completed ? (item.score ?? "selesai") : "lanjutkan"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section id="target" aria-labelledby="target-title" className={cn(CARD, "flex w-full flex-col gap-5 p-6 sm:p-7 lg:w-[22rem] lg:shrink-0")}>
            <div>
              <h2 id="target-title" className={H2}>
                Target tesmu
              </h2>
              <p className="mt-1.5 text-[0.9375rem] leading-normal text-ink-subtle">Menentukan level soal dan hitung mundur.</p>
            </div>
            <form action={targetAction} className="flex flex-col gap-5">
              <input type="hidden" name="track" value="eptr" />
              <div className="flex flex-col gap-2">
                <label htmlFor="score" className={CAP}>
                  Skor target ({MIN_SCORE}–{MAX_SCORE})
                </label>
                <input id="score" name="score" type="number" min={MIN_SCORE} max={MAX_SCORE} defaultValue={target?.score ?? 500} className={cn(FIELD, "tnum")} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="testDate" className={CAP}>
                  Tanggal tes
                </label>
                <input id="testDate" name="testDate" type="date" defaultValue={target?.testDate ?? ""} className={cn(FIELD, "font-sans text-[1rem]")} />
              </div>
              <button type="submit" disabled={targetPending} className={BTN}>
                {targetPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Simpan target
              </button>
            </form>
            <FieldError>{targetState.status === "error" ? targetState.message : undefined}</FieldError>
            <div className="mt-1 grid grid-cols-2 gap-3 border-t border-hairline-soft pt-5">
              <span>
                <span className="block font-display text-[2rem] font-bold leading-none">{props.streak}</span>
                <span className={cn(CAP, "font-medium")}>hari beruntun</span>
              </span>
              <span>
                <span className={cn("block font-display text-[2rem] font-bold leading-none", props.reviewsDue > 0 && "text-mango-ink")}>{props.reviewsDue}</span>
                <span className={cn(CAP, "font-medium")}>soal ulang jatuh tempo</span>
              </span>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
