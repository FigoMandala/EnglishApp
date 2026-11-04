import { cn } from "@/lib/utils";

export function ProgressRule({
  value,
  className,
  label,
  tone = "accent",
}: {
  value: number;
  className?: string;
  label?: string;
  tone?: "accent" | "success" | "danger" | "neutral" | "reward";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fill = {
    accent: "bg-primary",
    success: "bg-positive",
    danger: "bg-negative",
    neutral: "bg-ink-faint",
    reward: "bg-warning",
  }[tone];

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-canvas-deep", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full w-full origin-left rounded-full transition-transform duration-300 ease-out", fill)}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 px-5 py-8", className)}>
      <p className="text-base font-semibold text-ink">{title}</p>
      {hint ? <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-subtle">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "accent" | "success" | "danger" | "reward";
  className?: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    accent: "text-primary",
    success: "text-positive",
    danger: "text-negative",
    reward: "text-warning",
  }[tone];

  return (
    <div className={cn("rounded-plate border-2 border-hairline bg-surface px-4 py-4 shadow-card sm:px-5 sm:py-5", className)}>
      <p className="text-[0.8125rem] font-bold text-ink-subtle">{label}</p>
      <p className={cn("tnum mt-1.5 font-round text-[1.75rem] font-extrabold leading-none tracking-[-0.01em] sm:text-[2rem]", valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-[0.8125rem] leading-snug text-ink-subtle">{hint}</p> : null}
    </div>
  );
}