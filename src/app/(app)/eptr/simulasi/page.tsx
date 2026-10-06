import { ArrowLeft, ArrowUp, Check, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ScoreBars3D } from "@/components/exam-3d";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  loadSimulation,
  simulationHistory,
  startSectionTimer,
  type SimulationView,
} from "@/lib/api/eprt-simulation";
import { loadSession } from "@/lib/api/toefl-turn";
import { formatDate } from "@/lib/dates";
import { scopeQuestionTotal, SECTION_MINUTES } from "@/lib/eprt-simulation";
import { requireUser } from "@/lib/session";
import { SKILLS } from "@/lib/toefl";
import { cn } from "@/lib/utils";
import { getVoiceConfig } from "@/lib/voice-config";

import { ToeflRunner } from "../../toefl/toefl-runner";
import { OpenPartButton, PrefetchPart } from "./simulation-client";
import { SimulationReview } from "./simulation-review";

export const maxDuration = 60;

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
    const history = await simulationHistory(user.id);
    // Bandingkan dengan tes sejenis sebelumnya: simulasi penuh dengan total, mini-test dengan skor section.
    const previous = history.find(
      (item) => item.id < sim.id && item.completed && item.scope === sim.scope && item.score,
    );
    const previousScore = previous?.score ? (sim.scope ? previous.score[sim.scope] : previous.score.total) : null;
    return <Result sim={sim} home={home} previous={previousScore} />;
  }

  return <Overview sim={sim} />;
}

const SECTIONS = [
  { key: "listening", label: "Listening" },
  { key: "structure", label: "Structure" },
  { key: "reading", label: "Reading" },
] as const;

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

function Result({ sim, home, previous }: { sim: SimulationView; home: string; previous: number | null }) {
  const score = sim.score!;
  const focus = sim.skills
    .filter((stat) => stat.pct !== null)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
    .slice(0, 4);
  // Mini-test: yang ditampilkan skor section (31-68), bukan total 310-677.
  const shown = sim.scope ? score[sim.scope] : score.total;
  const diff = previous === null ? null : shown - previous;
  const bars = SECTIONS.filter((section) => !sim.scope || section.key === sim.scope);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <BackLink />
        <h1 className="font-display text-[2rem] font-extrabold tracking-[-0.025em] sm:text-[3rem]">
          {sim.scope ? `Hasil mini-test ${bars[0].label}` : "Hasil simulasi"} · {formatDate(sim.createdAt)}
        </h1>
      </div>

      <section
        aria-label="Skor"
        className="grid gap-8 rounded-[28px] border border-hairline bg-surface p-6 sm:p-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <div className="flex flex-col justify-center gap-3">
          <span className="text-[1.0625rem] font-bold text-ink-subtle">{sim.scope ? "Skor section" : "Skor total"}</span>
          <span className="tnum font-display text-[5.5rem] font-extrabold leading-[0.9] tracking-[-0.04em] sm:text-[7.5rem]">
            {shown}
          </span>
          <span className="text-[1.0625rem] text-ink-subtle">{sim.scope ? "skala 31–68" : "skala 310–677"}</span>
          {diff !== null && diff !== 0 ? (
            <span
              className={cn(
                "flex items-center gap-2 self-start rounded-[14px] px-4 py-3 text-base font-semibold",
                diff > 0 ? "bg-accent-soft text-accent-ink" : "bg-warning-soft text-warning-ink",
              )}
            >
              <ArrowUp className={cn("size-4", diff < 0 && "rotate-180")} aria-hidden />
              {diff > 0 ? "Naik" : "Turun"} {Math.abs(diff)} poin dari {sim.scope ? "mini-test" : "simulasi"} sebelumnya
            </span>
          ) : null}
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-ink-subtle">
            Perkiraan dengan tabel konversi mirip TOEFL ITP, bukan skor resmi.{" "}
            {sim.scope
              ? "Satu section saja belum cukup untuk memperkirakan skor total."
              : "Selisih dengan tes asli bisa sekitar ±20 poin."}
          </p>
        </div>
        <ScoreBars3D
          bars={bars.map((section) => ({
            key: section.key,
            label: section.label,
            score: score[section.key],
            detail: `${score.correct[section.key]}/${score.answered[section.key]} benar`,
          }))}
        />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="focus-title"
          className="flex flex-col gap-4 rounded-plate border-2 border-hairline bg-surface p-6 sm:p-8"
        >
          <h2 id="focus-title" className="font-display text-2xl font-extrabold">
            Fokus latihan berikutnya
          </h2>
          {focus.length === 0 ? (
            <p className="text-base text-ink-subtle">Belum ada data skill.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {focus.map((stat) => {
                const weak = (stat.pct ?? 0) < 60;
                return (
                  <li
                    key={stat.skill}
                    className="grid grid-cols-[minmax(0,1fr)_6rem_3rem] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_8rem_3rem_6.5rem]"
                  >
                    <span className="text-base font-semibold">{SKILLS[stat.skill].label}</span>
                    <span className="h-3 rounded-full bg-surface-sunken">
                      <span
                        className={cn("block h-full rounded-full", weak ? "bg-warning" : "bg-accent")}
                        style={{ width: `${stat.pct}%` }}
                      />
                    </span>
                    <span className="tnum text-right font-mono text-[0.9375rem]">{stat.pct}%</span>
                    <span
                      className={cn(
                        "col-span-3 text-[0.875rem] font-bold sm:col-span-1",
                        weak ? "text-warning-ink" : "text-accent-ink",
                      )}
                    >
                      {weak ? "Perlu latihan" : "Cukup"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/eptr#practice-title" className={cn(buttonVariants(), "self-start")}>
            Latihan per bagian
          </Link>
        </section>

        <section
          aria-labelledby="review-title"
          className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-6 sm:p-8"
        >
          <h2 id="review-title" className="font-display text-2xl font-extrabold">
            Pembahasan per bagian
          </h2>
          <ul className="flex flex-col gap-2">
            {sim.parts.map((part) =>
              part.sessionId ? (
                <li key={part.index}>
                  <Link
                    href={`${home}&r=${part.index}`}
                    className="flex min-h-[52px] items-center justify-between gap-3 rounded-control bg-surface-muted px-4 hover:bg-surface-sunken"
                  >
                    <span className="text-base font-semibold">{part.title}</span>
                    <span className="text-[0.875rem] font-bold text-accent">Lihat</span>
                  </Link>
                </li>
              ) : (
                <li
                  key={part.index}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-control border border-dashed border-hairline-strong px-4 text-ink-subtle"
                >
                  <span className="text-base font-semibold">{part.title}</span>
                  <span className="text-[0.875rem] font-bold text-warning-ink">Waktu habis</span>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
