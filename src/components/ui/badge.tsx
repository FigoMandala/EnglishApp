import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "danger" | "data" | "reward";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-subtle border-hairline",
  accent: "bg-primary-soft text-primary-deep border-primary/20",
  success: "bg-positive-soft text-positive border-positive/20",
  danger: "bg-negative-soft text-negative border-negative/20",
  data: "bg-data-soft text-data border-data/20",
  reward: "bg-warning-soft text-warning border-warning/20",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.75rem] font-bold leading-5",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}