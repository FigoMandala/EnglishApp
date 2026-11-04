import { ArrowLeft, ArrowUp, Check, ChevronRight, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CountUp } from "@/components/fx/count-up";
import { Kaka } from "@/components/mascot";
import { SkillChip } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadSimulation,
  simulationHistory,
  startSectionTimer,
  type SimulationView,
} from "@/lib/api/eprt-simulation";
import { loadSession } from "@/lib/api/toefl-turn";
import { getEptrTarget } from "@/db/queries/activity";
import { formatDate } from "@/lib/dates";
import { scopeQuestionTotal, SECTION_MINUTES } from "@/lib/eprt-simulation";
import { requireUser } from "@/lib/session";
import { SKILLS } from "@/lib/toefl";
import { cn } from "@/lib/utils";
import { getVoiceConfig } from "@/lib/voice-config";

import { ToeflRunner } from "../../toefl/toefl-runner";
import { OpenPartButton, PrefetchPart } from "./simulation-client";
import { SimulationReview } from "./simulation-review";

export const maxDuration = 300;

export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; p?: string; r?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) redirect("/eptr");

  const sim = await loadSimulation(user.id, id);
  if (!sim) notFound();
  const home = `/eptr/simulasi?id=${sim.id}`;

  if (params.p !== undefined) {
    const position = sim.parts.findIndex((item) => item.index === Number(params.p));
    const part = sim.parts[position];
    // "done" tetap boleh: selesai menyimpan bagian me-refresh halaman ini.
    if (!part || (part.status !== "active" && part.status !== "done") || !part.sessionId) {
      redirect(home);
    }
    const session = await loadSession(user.id, part.sessionId);
    if (!session) redirect(home);
    const next = sim.parts[position + 1];
    const timeLeftMs =
      part.status === "active" ? await startSectionTimer(user.id, sim.id, part.section) : undefined;

    return (
      <>
        <ToeflRunner
          session={{ ...session, label: `Bagian ${position + 1} dari ${sim.parts.length} · ${part.title}` }}
          basePath={home}
          exam
          timeLeftMs={timeLeftMs}
          voice={await getVoiceConfig()}
        />
        {next && !next.sessionId ? <PrefetchPart id={sim.id} index={next.index} /> : null}
      </>
    );
  }

  if (params.r !== undefined && sim.completedAt) {
    const part = sim.parts.find((item) => item.index === Number(params.r));
    const session = part?.sessionId ? await loadSession(user.id, part.sessionId) : null;
    if (!part || !session) redirect(home);
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Pembahasan simulasi"
          title={part.title}
          actions={
            <Link href={home} className={buttonVariants({ variant: "secondary" })}>
              <ArrowLeft className="size-4" aria-hidden />
              Kembali ke hasil
            </Link>
          }
        />
        <SimulationReview session={session} />
      </div>
    );
  }

  if (sim.score) {
    const [history, target] = await Promise.all([simulationHistory(user.id), getEptrTarget(user.id)]);
    // Bandingkan dengan tes sejenis sebelumnya: simulasi penuh dengan total, mini-test dengan skor section.
    const previous = history.find(
      (item) => item.id < sim.id && item.completed && item.scope === sim.scope && item.score,
    );
    const previousScore = previous?.score ? (sim.scope ? previous.score[sim.scope] : previous.score.total) : null;
    return <Result sim={sim} home={home} previous={previousScore} target={target?.score ?? null} />;
  }

  return <Overview sim={sim} />;
}

const SECTIONS = [
  { key: "listening", label: "Listening" },
  { key: "structure", label: "Structure" },
  { key: "reading", label: "Reading" },
] as const;

const SECTION_LABEL = { listening: "Listening", structure: "Structure", reading: "Reading" } as const;

function BackLink() {
  return (
    <Link
      href="/eptr"
      className="flex items-center gap-1.5 self-start py-2 text-base font-bold text-accent hover:text-accent-ink"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Kembali ke EPrT
    </Link>
  );
}

function Overview({ sim }: { sim: SimulationView }) {
  const doneQuestions = sim.parts.reduce(
    (sum, part) => sum + (part.status === "done" ? part.count : part.answered),
    0,
  );
  const upcoming = sim.parts.find((part) => part.status === "ready");
  const sections = SECTIONS.filter((section) => !sim.scope || section.key === sim.scope);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <BackLink />
          <h1 className="font-display text-[2rem] font-extrabold tracking-[-0.025em] sm:text-[3rem]">
            {sim.scope ? `Mini-test ${sections[0].label}` : "Simulasi penuh"} · {formatDate(sim.createdAt)}
          </h1>
          <p className="max-w-2xl text-[1.0625rem] text-ink-subtle">
            Kerjakan berurutan. Timer {sim.scope ? "section" : "tiap section"} mulai saat bagian pertamanya dibuka dan
            tetap berjalan walau halaman ditutup.
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="tnum font-display text-[2.5rem] font-extrabold leading-none">
            {doneQuestions}
            <span className="text-ink-faint">/{scopeQuestionTotal(sim.scope)}</span>
          </span>
          <span className="text-[0.9375rem] text-ink-subtle">soal selesai</span>
        </div>
      </div>

      <div className={cn("grid items-start gap-5", sim.scope ? "max-w-2xl" : "lg:grid-cols-3")}>
        {sections.map((section) => {
          const parts = sim.parts.filter((part) => part.section === section.key);
          const done = parts.every((part) => part.status === "done");
          const current = !done && parts.some((part) => part.status === "active" || part.status === "ready");
          const remaining = sim.remaining[section.key];
          return (
            <section
              key={section.key}
              aria-labelledby={`sec-${section.key}`}
              className={cn(
                "flex flex-col gap-4 rounded-[24px] p-6",
                current
                  ? "bg-night text-night-ink shadow-[0_24px_40px_-24px_rgba(23,25,28,0.6)]"
                  : "border border-hairline bg-surface",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 id={`sec-${section.key}`} className="font-display text-2xl font-extrabold">
                  {section.label}
                </h2>
                {done ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[0.875rem] font-bold text-accent-ink">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    Selesai
                  </span>
                ) : (
                  <span
                    className={cn(
                      "tnum flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[0.875rem] font-semibold",
                      current ? "bg-night-raised" : "bg-surface-muted text-ink-subtle",
                    )}
                  >
                    <Clock className="size-3.5" aria-hidden />
                    {remaining !== null
                      ? `sisa ${Math.max(0, Math.ceil(remaining / 60_000))} menit`
                      : `${SECTION_MINUTES[section.key]} menit`}
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {parts.map((part) => {
                  const open = part.status === "active" || part.status === "ready";
                  return (
                    <li
                      key={part.index}
                      className={cn(
                        "flex min-h-14 flex-wrap items-center gap-3 rounded-[14px] px-4 py-2",
                        part.status === "done" && (current ? "bg-night-raised" : "bg-surface-muted"),
                        open && "bg-night-raised",
                        part.status === "locked" &&
                          (current
                            ? "border border-dashed border-ink-subtle text-night-muted"
                            : "border border-dashed border-hairline-strong text-ink-subtle"),
                      )}
                    >
                      {part.status === "done" ? (
                        <Check
                          className={cn("size-5 shrink-0", part.expired ? "text-warning" : "text-accent")}
                          strokeWidth={2.5}
                          aria-label="selesai"
                        />
                      ) : part.status === "locked" ? (
                        <Lock className="size-4 shrink-0" aria-label="terkunci" />
                      ) : (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-mint font-mono text-[0.875rem] font-semibold text-ink">
                          {sim.parts.indexOf(part) + 1}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-base font-semibold">{part.title.replace(/^\w+: /, "")}</span>
                        <span className={cn("text-[0.875rem]", current || open ? "text-night-muted" : "text-ink-subtle")}>
                          {part.expired
                            ? "waktu habis"
                            : part.status === "active" && part.answered
                              ? `${part.answered}/${part.count} dijawab`
                              : `${part.count} soal`}
                        </span>
                      </span>
                      {open ? (
                        <OpenPartButton
                          id={sim.id}
                          index={part.index}
                          label={part.status === "active" ? "Lanjutkan" : "Mulai"}
                          className="h-12 bg-night-ink px-5 text-ink hover:bg-white"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {current && remaining === null ? (
                <p className="text-[0.875rem] text-night-muted">Timer mulai saat kamu menekan Mulai.</p>
              ) : null}
            </section>
          );
        })}
      </div>

      {upcoming ? <PrefetchPart id={sim.id} index={upcoming.index} /> : null}
    </div>
  );
}

function Result({
  sim,
  home,
  previous,
  target,
}: {
  sim: SimulationView;
  home: string;
  previous: number | null;
  target: number | null;
}) {
  const score = sim.score!;
  const weak = sim.skills
    .filter((stat) => stat.pct !== null && stat.pct < 80)
    .map((stat) => ({ ...stat, wrong: stat.answered - Math.round(((stat.pct ?? 0) * stat.answered) / 100) }))
    .filter((stat) => stat.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 3);
  // Mini-test: yang ditampilkan skor section (31-68), bukan total 310-677.
  const shown = sim.scope ? score[sim.scope] : score.total;
  const diff = previous === null ? null : shown - previous;
  const bars = SECTIONS.filter((section) => !sim.scope || section.key === sim.scope);
  // Skor total = rata-rata section × 10, jadi target per section ≈ target / 10.
  const sectionTarget = target ? Math.round(target / 10) : null;
  const lowest = [...bars].sort((a, b) => score[a.key] - score[b.key])[0];
  const totalQuestions = scopeQuestionTotal(sim.scope);
  const minutes = bars.reduce((sum, section) => sum + SECTION_MINUTES[section.key], 0);
  const totalWrong = bars.reduce((sum, s) => sum + (score.answered[s.key] - score.correct[s.key]), 0);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
        <Link href="/eptr" className="text-ink-muted hover:text-primary">
          EPrT
        </Link>
        <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
        <span aria-current="page">
          {sim.scope ? "Hasil mini-test" : "Hasil simulasi"} {formatDate(sim.createdAt)}
        </span>
      </nav>

      <section
        aria-label="Skor"
        className="rise flex flex-wrap items-center gap-8 rounded-[32px] bg-charcoal p-6 text-charcoal-ink sm:p-8"
      >
        <div className="hidden shrink-0 sm:block">
          <Kaka mood={diff !== null && diff < 0 ? "coach" : "proud"} size={168} label="Kaka melihat hasilmu" />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
          <span className="text-[0.75rem] font-extrabold tracking-[0.08em] text-mango-line">
            {sim.scope ? `MINI-TEST ${bars[0].label.toUpperCase()}` : "SIMULASI PENUH"} · {totalQuestions} SOAL ·{" "}
            {minutes} MNT
          </span>
          <span className="flex flex-wrap items-baseline gap-3.5">
            <CountUp to={shown} ms={1200} className="font-round text-[4.5rem] font-extrabold leading-[0.9] tabular-nums sm:text-[5.5rem]" />
            {diff !== null && diff !== 0 ? (
              <span
                className={cn(
                  "pop inline-flex items-center gap-1 rounded-full bg-charcoal-raised px-3 py-1 text-[0.9375rem] font-extrabold",
                  diff > 0 ? "text-mint" : "text-brick-line",
                )}
                style={{ "--delay": "900ms" } as React.CSSProperties}
              >
                <ArrowUp className={cn("size-4", diff < 0 && "rotate-180")} aria-hidden />
                {Math.abs(diff)} dari {sim.scope ? "mini-test" : "simulasi"} lalu
              </span>
            ) : null}
          </span>
          <p className="text-charcoal-muted">
            Kaka: “
            {diff === null
              ? "Ini simulasi pertamamu. Jadikan patokan, lalu kejar bagian yang paling lemah."
              : diff > 0
                ? `Naik ${diff} poin.`
                : diff < 0
                  ? `Turun ${Math.abs(diff)} poin. Cek pembahasan dan ulang bagian yang meleset.`
                  : "Sama dengan sebelumnya."}
            {target && !sim.scope && shown < target ? ` Target ${target} masih ${target - shown} poin lagi.` : ""}
            {bars.length > 1 ? ` ${lowest.label} yang paling menahanmu.` : ""}” {" "}
            {sim.scope
              ? "Satu section belum cukup untuk memperkirakan skor total."
              : "Perkiraan, bukan skor resmi. Selisih dengan tes asli bisa sekitar ±20 poin."}
          </p>
        </div>
        <div className="flex flex-[0_1_220px] flex-col gap-2.5">
          <Link
            href="/eptr#practice-title"
            className="flex h-[52px] items-center justify-center rounded-[16px] bg-mango px-5 font-display text-[0.9375rem] font-extrabold text-mango-on shadow-[0_5px_0_var(--color-mango-deep)] transition-transform active:translate-y-[5px] active:shadow-none"
          >
            LATIH {lowest.label.toUpperCase()}
          </Link>
          <a
            href="#pembahasan"
            className="flex h-12 items-center justify-center rounded-[16px] border-2 border-charcoal-line px-5 font-display text-[0.9375rem] font-extrabold text-charcoal-ink hover:bg-charcoal-raised"
          >
            Lihat pembahasan
          </a>
        </div>
      </section>

      <section aria-label="Skor per bagian" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {bars.map((section) => {
          const value = score[section.key];
          const below = sectionTarget !== null && value < sectionTarget;
          const reached = sectionTarget !== null && !below;
          const pct = (n: number) => Math.max(2, Math.min(100, ((n - 31) / (68 - 31)) * 100));
          const tone = below && section.key === lowest.key && bars.length > 1 ? "brick" : reached ? "primary" : "sky";
          return (
            <div
              key={section.key}
              className={cn(
                "flex flex-col gap-2.5 rounded-[24px] border-2 bg-surface p-5",
                tone === "brick"
                  ? "border-brick-line shadow-[0_4px_0_var(--color-brick-line)]"
                  : "border-hairline shadow-card",
              )}
            >
              <div className="flex items-center justify-between">
                <strong className="font-display text-[1.125rem]">{section.label}</strong>
                <span className={cn("text-[0.8125rem] font-extrabold", tone === "brick" ? "text-brick-deep" : "text-ink-subtle")}>
                  {score.correct[section.key]}/{score.answered[section.key]} benar
                </span>
              </div>
              <span
                className={cn(
                  "font-round text-[2.75rem] font-extrabold leading-none",
                  tone === "brick" ? "text-brick-deep" : tone === "primary" && "text-primary-deep",
                )}
              >
                {value}
              </span>
              <div className="relative h-3 rounded-full bg-surface-sunken">
                <span
                  className={cn(
                    "grow-x absolute inset-y-0 left-0 rounded-full",
                    tone === "brick" ? "bg-brick" : tone === "primary" ? "bg-primary" : "bg-sky",
                  )}
                  style={{ width: `${pct(value)}%` }}
                />
                {sectionTarget !== null ? (
                  <span
                    className="absolute -inset-y-1 w-[3px] rounded-sm bg-ink"
                    style={{ left: `${pct(sectionTarget)}%` }}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="flex justify-between text-[0.75rem] font-bold text-ink-subtle">
                <span>31</span>
                <span>
                  {sectionTarget === null
                    ? "belum ada target"
                    : `target ${sectionTarget} · ${below ? `kurang ${sectionTarget - value}` : "tercapai"}`}
                </span>
                <span>68</span>
              </div>
            </div>
          );
        })}
      </section>

      {weak.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-[24px] border-2 border-hairline bg-surface px-6 py-5">
          <h2 className="font-display text-[1.25rem] font-extrabold">Perlu latihan</h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {weak.map((stat, i) => {
              const bad = i === 0;
              return (
                <Link
                  key={stat.skill}
                  href="/eptr#practice-title"
                  className={cn(
                    "flex items-center gap-3 rounded-[16px] border-2 px-4 py-3.5 text-ink",
                    bad ? "border-brick-line bg-brick-soft" : "border-mango-line bg-mango-soft",
                  )}
                >
                  <strong className={cn("font-round text-[1.375rem]", bad ? "text-brick-deep" : "text-mango-ink")}>
                    {stat.wrong}
                  </strong>
                  <span className="flex-1 text-[0.875rem]">
                    <strong className="block">{SKILLS[stat.skill].label}</strong>
                    <span className={bad ? "text-brick-deep" : "text-mango-ink"}>salah dari {stat.answered}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section id="pembahasan" aria-labelledby="review-title" className="flex scroll-mt-6 flex-col gap-3.5">
        <h2 id="review-title" className="font-display text-[1.375rem] font-extrabold">
          Pembahasan · {totalWrong} salah
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {sim.parts.map((part) =>
            part.sessionId ? (
              <li key={part.index}>
                <Link
                  href={`${home}&r=${part.index}`}
                  className="flex min-h-[60px] items-center gap-3 rounded-[18px] border-2 border-hairline bg-surface px-4 shadow-card hover:border-primary-line"
                >
                  <SkillChip skill={part.section}>{SECTION_LABEL[part.section]}</SkillChip>
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">{part.title.replace(/^\w+: /, "")}</span>
                  <span className="text-[0.875rem] font-extrabold text-primary">Lihat</span>
                  <ChevronRight className="size-4 text-primary" strokeWidth={2.6} aria-hidden />
                </Link>
              </li>
            ) : (
              <li
                key={part.index}
                className="flex min-h-[60px] items-center gap-3 rounded-[18px] border-2 border-dashed border-hairline-strong px-4 text-ink-subtle"
              >
                <SkillChip skill={part.section}>{SECTION_LABEL[part.section]}</SkillChip>
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{part.title.replace(/^\w+: /, "")}</span>
                <span className="text-[0.875rem] font-extrabold text-mango-ink">Waktu habis</span>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
