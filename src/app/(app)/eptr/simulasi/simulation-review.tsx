import { Check, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { SessionView } from "@/lib/api/toefl-turn";
import { parseInline } from "@/lib/markdown";
import { SKILLS, type ToeflQuestion } from "@/lib/toefl";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"];
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
  return (
    <div className="flex flex-col gap-4">
      {session.passage ? (
        <Card>
          <CardContent className="py-5">
            <p className="eyebrow mb-3 text-ink-subtle">Bacaan</p>
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink">
              <Rich text={session.passage} />
            </p>
          </CardContent>
        </Card>
      ) : null}

      {session.questions.map((question, index) => {
        const chosen = session.answers[index];
        const right = chosen === question.answer;
        const sharedAudio =
          index > 0 &&
          dialogueOf(session.questions[index - 1]) === dialogueOf(question) &&
          dialogueOf(question) !== "";
        return (
          <Card key={index}>
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow text-ink-subtle">Soal {index + 1}</p>
                <p className={cn("text-[0.9375rem] font-semibold", right ? "text-positive" : "text-negative")}>
                  {right ? "Benar" : chosen === null || chosen < 0 ? "Tidak dijawab" : "Belum tepat"}
                </p>
              </div>

              {question.audio && !sharedAudio ? (
                <div className="flex flex-col gap-1 rounded-control border border-hairline-strong bg-surface-muted px-4 py-3 text-base leading-relaxed text-ink">
                  {question.audio.map((line, i) => (
                    <p key={i}>
                      <span className="font-semibold">{SPEAKER[line.speaker]}:</span> {line.text}
                    </p>
                  ))}
                </div>
              ) : null}

              <p className="text-lg font-semibold leading-relaxed text-ink">
                <Rich text={question.q} />
              </p>

              <ul className="grid gap-1.5 sm:grid-cols-2">
                {question.options.map((option, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-center gap-2.5 rounded-control border-[1.5px] px-4 py-3 text-base",
                      i === question.answer
                        ? "border-positive bg-positive-soft text-positive"
                        : i === chosen
                          ? "border-dashed border-negative bg-negative-soft text-negative"
                          : "border-hairline text-ink-muted",
                    )}
                  >
                    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center font-mono text-[0.875rem] font-semibold">
                      {i === question.answer ? (
                        <Check className="size-5" strokeWidth={2.5} />
                      ) : i === chosen ? (
                        <X className="size-5" strokeWidth={2.5} />
                      ) : (
                        LETTERS[i]
                      )}
                    </span>
                    <span className="sr-only">
                      {i === question.answer ? "Jawaban benar: " : i === chosen ? "Jawabanmu: " : ""}
                    </span>
                    {option}
                  </li>
                ))}
              </ul>

              {question.explain_id ? (
                <p className="text-base leading-relaxed text-ink-muted">{question.explain_id}</p>
              ) : null}
              {question.skill ? (
                <p className="eyebrow text-ink-faint">Skill - {SKILLS[question.skill].label}</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
