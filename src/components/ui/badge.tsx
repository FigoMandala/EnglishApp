import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "danger" | "data" | "reward" | "new" | "exam";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-muted border-hairline",
  success: "bg-primary-soft text-primary-deep border-primary-line",
  danger: "bg-brick-soft text-brick-deep border-brick-line",
  data: "bg-sky-soft text-sky-deep border-sky-line",
  reward: "bg-mango-soft text-mango-ink border-mango-line",
  new: "bg-mango text-mango-on border-mango",
  exam: "bg-charcoal text-mango-line border-charcoal",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-[0.75rem] font-extrabold leading-5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Chip skill netral dengan titik warna (Structure hijau, Listening langit, dst.). */
const SKILL_DOT = {
  structure: "bg-primary",
  listening: "bg-sky",
  reading: "bg-mango-deep",
  speaking: "bg-[#8a5530]",
  vocab: "bg-ink",
} as const;

export function SkillChip({
  skill,
  children,
  className,
}: {
  skill: keyof typeof SKILL_DOT;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-hairline bg-surface px-3 py-0.5 text-[0.75rem] font-extrabold text-ink-muted",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", SKILL_DOT[skill])} />
      {children}
    </span>
  );
}

/** Label CEFR: dasar hijau, menengah langit, lanjut arang. */
export function LevelTag({ level, className }: { level: string; className?: string }) {
  const tone =
    level.startsWith("A") || level === "basic" || level === "DASAR"
      ? "bg-primary-soft text-primary-deep"
      : level.startsWith("C") || level === "advanced" || level === "LANJUT"
        ? "bg-charcoal-raised text-charcoal-ink"
        : "bg-sky-soft text-sky-deep";
  return (
    <span className={cn("inline-flex rounded-chip px-2.5 py-0.5 text-[0.75rem] font-extrabold", tone, className)}>
      {level}
    </span>
  );
}
