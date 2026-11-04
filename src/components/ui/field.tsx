import { cn } from "@/lib/utils";

const fieldBase = [
  "w-full rounded-control border-2 border-hairline bg-surface-muted px-4 text-ink",
  "h-[52px]",
  "text-base",
  "focus:border-primary focus:bg-surface focus:shadow-[0_0_0_4px_var(--color-primary-soft)] focus:outline-none",
  "aria-[invalid=true]:border-brick",
  "placeholder:text-ink-faint",
  "transition-[border-color,box-shadow,background-color] duration-150",
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle",
];

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldBase, "h-auto min-h-24 resize-y py-3.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-[0.875rem] font-extrabold leading-none text-ink", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      id="field-error"
      role="alert"
      className="flex items-center gap-1.5 text-[0.8125rem] font-bold leading-snug text-brick-deep"
    >
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {children}
    </p>
  );
}
