import { PROMPT_LEVEL_LABEL } from "@/lib/writing-prompts";
import { summarizeTopics, type WritingStatRow } from "@/lib/writing-stats";
import { cn } from "@/lib/utils";

export function TopicStats({ rows }: { rows: WritingStatRow[] }) {
  const stats = summarizeTopics(rows);
  const share = stats.promptsTotal ? Math.round((stats.promptsTried / stats.promptsTotal) * 100) : 0;

  return (
    <section
      aria-labelledby="topik-title"
      className="flex flex-col gap-3 rounded-[22px] border-2 border-hairline bg-surface p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="topik-title" className="eyebrow text-ink-subtle">
          Statistik topik
        </h2>
        <span className="tnum text-[0.8125rem] font-extrabold text-primary-deep">
          {stats.promptsTried}/{stats.promptsTotal}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Prompt katalog yang sudah dicoba"
        aria-valuemin={0}
        aria-valuemax={stats.promptsTotal}
        aria-valuenow={stats.promptsTried}
        className="h-2 overflow-hidden rounded-full bg-canvas-deep"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
      </div>

      <ul className="flex flex-col gap-2">
        {stats.levels.map((level) => (
          <li key={level.level} className="flex items-center gap-2 text-[0.8125rem]">
            <span className="w-[68px] shrink-0 font-extrabold text-ink-muted">{PROMPT_LEVEL_LABEL[level.level]}</span>
            <span className="flex min-w-0 flex-1 gap-1" aria-hidden>
              {Array.from({ length: level.promptsTotal }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2.5 flex-1 rounded-full",
                    index < level.promptsTried ? "bg-primary" : "bg-canvas-deep",
                  )}
                />
              ))}
            </span>
            <span className="tnum w-[86px] shrink-0 text-right text-ink-subtle">
              {level.essays} esai{level.avg !== null ? ` · ${level.avg}` : ""}
            </span>
          </li>
        ))}
      </ul>

      {stats.top.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t-2 border-hairline-soft pt-2.5">
          <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-ink-subtle">
            Paling sering ditulis
          </span>
          <ul className="flex flex-col gap-1">
            {stats.top.slice(0, 3).map((entry) => (
              <li key={entry.prompt.id} className="flex items-start gap-2 text-[0.8125rem] leading-snug">
                <span className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-mango-soft font-round text-[0.75rem] font-extrabold text-mango-ink">
                  {entry.count}×
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{entry.prompt.title}</span>
                <span className="tnum shrink-0 font-extrabold text-ink">{entry.best}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[0.8125rem] leading-snug text-ink-subtle">
          Pilih prompt dari bank supaya topikmu tercatat di sini.
        </p>
      )}

      {stats.custom > 0 ? (
        <p className="text-[0.75rem] text-ink-subtle">
          {stats.custom} esai dengan topik bebas tidak masuk hitungan level.
        </p>
      ) : null}
    </section>
  );
}
