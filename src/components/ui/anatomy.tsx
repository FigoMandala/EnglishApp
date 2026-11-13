import { cn } from "@/lib/utils";

import type { AnatomyPart, AnatomyTone } from "@/lib/anatomy";

export { blankAnatomy, type AnatomyPart } from "@/lib/anatomy";

const LINE: Record<AnatomyTone, string> = {
  subject: "border-b-4 border-sky",
  verb: "border-b-4 border-primary text-primary-deep",
  wrong: "rounded-lg border-b-4 border-brick bg-brick-soft px-1.5 text-brick-deep line-through decoration-[3px]",
  right: "rounded-lg border-b-4 border-primary bg-primary-soft px-1.5 text-primary-deep",
  muted: "border-b-4 border-hairline-strong",
  time: "border-b-4 border-mango",
  plain: "",
  strike: "border-b-4 border-dotted border-hairline-strong text-ink-faint line-through decoration-2",
};

const LABEL: Record<AnatomyTone, string> = {
  subject: "text-sky-deep",
  verb: "text-primary-deep",
  wrong: "text-brick-deep",
  right: "text-primary-deep",
  muted: "text-ink-subtle",
  time: "text-mango-ink",
  plain: "text-ink-subtle",
  strike: "text-ink-subtle",
};

/**
 * Bedah kalimat: tiap potongan diberi garis bawah berwarna sesuai peran, label kecil di bawahnya.
 * Bagian keliru dicoret bata, perbaikannya hijau.
 */
export function Anatomy({
  parts,
  size = "md",
  className,
}: {
  parts: AnatomyPart[];
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const text = { sm: "text-[1rem]", md: "text-[1.25rem]", lg: "text-[1.5rem]" }[size];
  return (
    <p className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 font-semibold leading-snug", text, className)}>
      {parts.map((part, i) =>
        part.label ? (
          <span key={i} className="inline-flex flex-col items-center gap-1">
            <span className={LINE[part.tone ?? "plain"]}>{part.text}</span>
            <span className={cn("text-[0.75rem] font-extrabold uppercase tracking-[0.06em]", LABEL[part.tone ?? "plain"])}>
              {part.label}
            </span>
          </span>
        ) : (
          <span key={i} className={LINE[part.tone ?? "plain"]}>
            {part.text}
          </span>
        ),
      )}
    </p>
  );
}
