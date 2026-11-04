import { Check, X } from "lucide-react";

import { Anatomy, blankAnatomy } from "@/components/ui/anatomy";
import type { SessionView } from "@/lib/api/toefl-turn";
import { parseInline } from "@/lib/markdown";
import { SKILLS, type ToeflQuestion } from "@/lib/toefl";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"];
const DOT: Record<string, string> = { listening: "bg-sky", structure: "bg-primary", reading: "bg-mango" };
const SPEAKER: Record<string, string> = {
  man: "Pria",
  woman: "Wanita",
  narrator: "Narator",
  speaker: "Pembicara",
};

/** Audio tanpa narator: identitas dialog, supaya transkrip dialog bersama tidak diulang. */
function dialogueOf(question: ToeflQuestion | undefined) {
  const lines = (question?.audio ?? []).filter((line) => line.speaker !== "narrator");
  return lines.map((line) => `${line.speaker}:${line.text}`).join("\n");
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, i) =>
        span.tone === "bold" ? (
          <strong key={i} className="font-semibold">
            {span.text}
          </strong>
        ) : (
          span.text
        ),
      )}
    </>
  );
}

export function SimulationReview({ session }: { session: SessionView }) {
  const prefix = session.section === "listening" ? "L" : session.section === "reading" ? "R" : "S";
  return (
    <div className="flex flex-col gap-3.5">
      {session.passage ? (
        <article className="rounded-[24px] border-2 border-hairline bg-surface px-6 py-5">
          <p className="eyebrow mb-3 text-ink-subtle">Bacaan</p>
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink">
            <Rich text={session.passage} />
          </p>
        </article>
      ) : null}

      {session.questions.map((question, index) => {
        const chosen = session.answers[index];
        const right = chosen === question.answer;
        const skipped = chosen === null || chosen < 0;
        const sharedAudio =
          index > 0 &&
          dialogueOf(session.questions[index - 1]) === dialogueOf(question) &&
          dialogueOf(question) !== "";
        const anatomy =
          session.section === "structure" && !right
            ? blankAnatomy(question.q, skipped ? null : question.options[chosen!], question.options[question.answer])
            : null;
        return (
          <article
            key={index}
            className={cn(
              "flex flex-col gap-3.5 rounded-[24px] border-2 bg-surface px-6 py-5",
              right ? "border-hairline" : "border-brick-line",
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-round text-[1.25rem] font-extrabold">
                {prefix}·{index + 1}
              </span>
              {question.skill ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-hairline px-2.5 py-0.5 text-[0.75rem] font-extrabold">
                  <span className={cn("size-[7px] rounded-full", DOT[session.section] ?? "bg-primary")} aria-hidden />
                  {SKILLS[question.skill].label}
                </span>
              ) : null}
              <span
                className={cn(
                  "ml-auto inline-flex items-center gap-1 text-[0.875rem] font-extrabold",
                  right ? "text-primary-deep" : "text-brick-deep",
                )}
              >
                {right ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <X className="size-4" strokeWidth={3} aria-hidden />}
                {right ? "Benar" : skipped ? "Tidak dijawab" : "Belum tepat"}
              </span>
            </div>

            {question.audio && !sharedAudio ? (
              <div className="rounded-[14px] border-2 border-dashed border-hairline-strong bg-surface-muted px-3.5 py-3 text-[0.9375rem] leading-relaxed">
                <span className="block text-[0.75rem] font-extrabold tracking-[0.06em] text-ink-subtle">TRANSKRIP</span>
                {question.audio.map((line, i) => (
                  <p key={i}>
                    <strong>{SPEAKER[line.speaker]}:</strong> {line.text}
                  </p>
                ))}
              </div>
            ) : null}

            {anatomy ? (
              <Anatomy parts={anatomy} size="lg" />
            ) : (
              <p className="text-lg font-semibold leading-relaxed text-ink">
                <Rich text={question.q} />
              </p>
            )}

            {right ? (
              <span className="self-start rounded-[12px] bg-primary-soft px-3 py-1.5 text-[0.875rem] font-bold text-primary-deep">
                Jawabanmu: {LETTERS[question.answer]} · {question.options[question.answer]}
              </span>
            ) : (
              <div className="flex flex-wrap gap-2.5 text-[0.875rem] font-bold">
                <span className="rounded-[12px] bg-brick-soft px-3 py-1.5 text-brick-deep">
                  Jawabanmu: {skipped ? "—" : `${LETTERS[chosen!]} · ${question.options[chosen!]}`}
                </span>
                <span className="rounded-[12px] bg-primary-soft px-3 py-1.5 text-primary-deep">
                  Jawaban benar: {LETTERS[question.answer]} · {question.options[question.answer]}
                </span>
              </div>
            )}

            {question.explain_id ? (
              <p className="rounded-[14px] bg-surface-muted px-3.5 py-3 text-[0.9375rem] text-ink-muted">
                <strong>Kenapa:</strong> {question.explain_id}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
