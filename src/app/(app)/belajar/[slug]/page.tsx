import { Check, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Lori } from "@/components/mascot";
import { SpeakButton } from "@/components/speak-button";
import { LevelTag } from "@/components/ui/badge";
import { SpeechBubble } from "@/components/ui/bubble";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listGrammarLessons } from "@/db/queries/grammar";
import { completedUnitIds, getUnitBySlug, isUnitCompleted, listUnitsWithItems } from "@/db/queries/learning";
import { listUnitWordPool, vocabularyDetails } from "@/db/queries/vocabulary";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { pickUnitWords } from "@/lib/unit-words";
import { cn } from "@/lib/utils";
import { wordStatus } from "@/lib/word-status";
import { XP_REWARDS } from "@/lib/xp";

import { CompleteUnitButton } from "./complete-button";

export const metadata = { title: "Unit Belajar · EnglishApp" };

const LEVEL_LABEL = { basic: "DASAR", intermediate: "MENENGAH", advanced: "LANJUT" } as const;

export default async function UnitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();

  const unit = await getUnitBySlug(slug);
  if (!unit) notFound();

  const [units, lessons, unitDone, completed] = await Promise.all([
    listUnitsWithItems(),
    listGrammarLessons(user.id),
    isUnitCompleted(user.id, unit.id),
    completedUnitIds(user.id),
  ]);

  // Unit terkunci kalau unit sebelumnya belum selesai.
  const order = units.findIndex((u) => u.id === unit.id);
  const previous = order > 0 ? units[order - 1] : null;
  const locked = previous ? !completed.has(previous.id) : false;
  const title = unit.title.replace(/^Unit \d+:\s*/, "");

  if (locked) {
    // Kembali lebih awal: tidak perlu memuat kosakata dan materi.
    return (
      <div className="flex flex-col items-start gap-5">
        <Crumb title={`Unit ${order + 1}`} />
        <Card className="flex w-full flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-locked text-ink-faint shadow-[0_5px_0_var(--color-locked-ledge)]">
            <Lock className="size-8" strokeWidth={2.6} aria-hidden />
          </span>
          <h1 className="mt-2 font-display text-[1.75rem] font-black">Unit masih terkunci</h1>
          <p className="max-w-md text-[0.9375rem] text-ink-subtle">
            Selesaikan <strong>{previous?.title}</strong> dulu untuk membuka unit ini.
          </p>
          <Link href="/belajar" className="font-extrabold text-primary-deep hover:underline">
            Kembali ke peta jalur
          </Link>
        </Card>
      </div>
    );
  }

  const bySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
  const firstOpen = unit.items.findIndex(
    (item) => item.kind === "grammar" && !(item.refSlug && bySlug.get(item.refSlug)?.completed),
  );
  const steps = unit.items.map((item, i) => {
    const state = unitDone || firstOpen === -1 || i < firstOpen ? "done" : i === firstOpen ? "current" : "todo";
    return { item, state, lesson: item.refSlug ? (bySlug.get(item.refSlug) ?? null) : null };
  });
  const doneCount = steps.filter((step) => step.state === "done").length;
  const nextStep = steps.find((step) => step.state === "current");

  // Kata untuk langkah kosakata: kandidat dipilih dari kolam ringan (tanpa
  // arti/contoh), lalu detail lengkap hanya diambil untuk kata yang terpilih.
  const pool = await listUnitWordPool(user.id);
  const candidateIds = unit.items
    .filter((item) => item.kind === "vocab")
    .flatMap((item) =>
      pickUnitWords(pool, {
        title: item.title,
        level: unit.level,
        unitOrder: order + 1,
        count: item.vocabCount ?? 10,
      }).map((candidate) => candidate.id),
    );
  const unitWords = await vocabularyDetails(user.id, candidateIds);
  const today = todayISO();

  return (
    <div className="flex flex-col gap-6">
      <Crumb title={`Unit ${order + 1}`} />

      <header className="flex flex-wrap items-center gap-6 rounded-hero border-2 border-hairline bg-surface p-6 shadow-card sm:p-7">
        <span className="grid size-[88px] shrink-0 place-items-center rounded-full bg-primary font-round text-[2.5rem] font-extrabold text-white shadow-[0_5px_0_var(--color-primary-deep)]">
          {unitDone ? <Check className="size-10" strokeWidth={3} aria-hidden /> : order + 1}
        </span>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <LevelTag level={LEVEL_LABEL[unit.level]} />
            <span className="text-[0.8125rem] font-bold text-ink-subtle">{unit.items.length} langkah</span>
          </div>
          <h1 className="font-display text-[1.875rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[2.125rem]">{title}</h1>
          {unit.description ? <p className="max-w-[620px] text-ink-subtle">{unit.description}</p> : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-[220px]">
          <div className="flex justify-between text-[0.8125rem] font-extrabold">
            <span>Progres unit</span>
            <span className="text-primary-deep">
              {doneCount} / {steps.length}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progres unit ${order + 1}`}
            aria-valuenow={steps.length ? Math.round((doneCount / steps.length) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3.5 overflow-hidden rounded-full bg-canvas-deep"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${steps.length ? doneCount / steps.length : 0})` }}
            />
          </div>
          <span className="text-[0.8125rem] text-ink-subtle">
            {unitDone ? "Unit selesai" : `Selesai unit: +${XP_REWARDS.unitComplete} XP`}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Langkah unit" className="flex min-w-0 flex-[1_1_560px] flex-col gap-3.5">
          <h2 className="font-display text-[1.375rem] font-extrabold">Langkah</h2>
          <ol className="flex flex-col gap-3">
            {steps.map(({ item, state, lesson }, i) => {
              const href = item.kind === "grammar" ? (lesson ? `/materi/${lesson.slug}` : "/materi") : `/kosakata?level=${unit.level}`;
              const kind =
                item.kind === "grammar" ? `MATERI${lesson ? "" : " · BELUM TERSEDIA"}` : `KOSAKATA · ${item.vocabCount ?? 10} KATA`;
              const sub =
                item.kind === "grammar"
                  ? (lesson?.summary ?? "Materi belum tersedia")
                  : unitWords.slice(0, 6).map((word) => word.word).join(", ") || "Kosakata sedang menunggu ulasan";
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    aria-current={state === "current" ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-4 rounded-plate border-2 px-[18px] py-4 transition-transform active:translate-y-0.5",
                      state === "done" && "border-hairline bg-surface",
                      state === "current" && "border-primary-line bg-primary-soft shadow-[0_4px_0_var(--color-primary-line)]",
                      state === "todo" && "border-hairline",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-full font-round text-[1.375rem] font-extrabold",
                        state === "done" && "bg-primary text-white",
                        state === "current" && "bg-primary text-white shadow-[0_0_0_4px_#fff,0_0_0_7px_var(--color-mint)]",
                        state === "todo" && "bg-primary-soft text-primary-deep",
                      )}
                    >
                      {state === "done" ? <Check className="size-[22px]" strokeWidth={3} aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("eyebrow block", state === "current" ? "text-primary-deep" : "text-ink-subtle")}>
                        {kind}
                        {state === "current" ? " · BERIKUTNYA" : ""}
                      </span>
                      <strong className={cn("block text-[1.0625rem]", state === "current" && "text-primary-deep")}>
                        {item.title}
                      </strong>
                      <span className={cn("block truncate text-[0.875rem]", state === "current" ? "text-primary-deep" : "text-ink-subtle")}>
                        {sub}
                      </span>
                    </span>
                    {state === "current" ? (
                      <span className="flex h-12 shrink-0 items-center rounded-[14px] bg-primary px-5 font-display text-[0.9375rem] font-extrabold tracking-[0.03em] text-white shadow-[0_4px_0_var(--color-primary-deep)]">
                        MULAI
                      </span>
                    ) : (
                      <ChevronRight className="size-5 shrink-0 text-ink-subtle" aria-hidden />
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>

          {unitDone ? null : (
            <div className="flex flex-wrap items-center gap-4 rounded-plate border-2 border-mango-line bg-mango-soft p-[18px] text-mango-ink">
              <span className="flex-1">
                <strong className="block">Sudah paham semua langkah?</strong>
                <span className="text-[0.875rem]">Tandai unit selesai untuk membuka unit berikutnya. +{XP_REWARDS.unitComplete} XP.</span>
              </span>
              <CompleteUnitButton unitId={unit.id} />
            </div>
          )}

          {/* CTA lanjutan berada DI LUAR gate banner di atas: banner (beserta
              CompleteUnitButton) di-unmount saat unitDone, jadi CTA ini yang
              menjamin "Lanjut ke unit berikutnya" tetap terlihat setelah refresh. */}
          {unitDone ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-plate border-2 border-primary-line bg-primary-soft p-[18px] text-primary-deep">
              <strong className="font-display">Unit ini sudah beres!</strong>
              <Link href="/belajar" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Lanjut ke unit berikutnya
              </Link>
            </div>
          ) : null}
        </section>

        <aside className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[1.125rem] font-extrabold">Kosakata unit</h2>
              <span className="text-[0.8125rem] font-extrabold text-ink-subtle">{unitWords.length} kata</span>
            </div>
            {unitWords.length ? (
              <ul className="flex flex-col">
                {unitWords.slice(0, 6).map((word, i) => {
                  const status = wordStatus(word, today);
                  return (
                    <li key={word.id} className={cn("flex items-center gap-2.5 py-2.5", i > 0 && "border-t-2 border-hairline-soft")}>
                      <SpeakButton text={word.word} label={`Dengarkan ${word.word}`} />
                      <span className="min-w-0 flex-1">
                        <strong className="block text-[0.9375rem]">{word.word}</strong>
                        <span className="block truncate text-[0.8125rem] text-ink-subtle">{word.meaning}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-extrabold",
                          status.kind === "new" && "bg-mango text-mango-on",
                          status.kind === "due" && "bg-mango-soft text-mango-ink",
                          status.kind === "mastered" && "bg-primary-soft text-primary-deep",
                          status.kind === "later" && "bg-canvas text-ink-subtle",
                        )}
                      >
                        {status.kind === "new" ? "BARU" : status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[0.875rem] text-ink-subtle">Kosakata sedang menunggu ulasan.</p>
            )}
            <Link href="/kosakata" className="text-[0.875rem] font-extrabold text-primary-deep hover:underline">
              {unitWords.length > 6 ? `Lihat ${unitWords.length - 6} kata lainnya` : "Buka Kosakata"}
            </Link>
          </Card>

          <div className="flex items-end gap-1">
            <Lori mood="talk" size={92} />
            <SpeechBubble who="Lori" className="mb-9">
              {unitDone
                ? "Unit ini sudah beres. Ulangi kapan saja kalau mau menyegarkan ingatan."
                : nextStep
                  ? `Berikutnya: ${nextStep.item.title}. Kerjakan berurutan biar fondasinya kuat.`
                  : "Semua langkah beres. Tinggal tandai unit selesai!"}
            </SpeechBubble>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Crumb({ title }: { title: string }) {
  return (
    <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
      <Link href="/belajar" className="text-ink-muted hover:text-primary-deep hover:underline">
        Jalur Belajar
      </Link>
      <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
      <span aria-current="page">{title}</span>
    </nav>
  );
}
