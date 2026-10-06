import { cn } from "@/lib/utils";

const fieldBase = [
  "w-full rounded-control border-2 border-hairline bg-surface px-4 text-ink",
  "h-12",
  "text-base",
  "focus:border-primary focus:outline-none",
  "placeholder:text-ink-faint",
  "transition-colors duration-150",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle",
];

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldBase, "h-auto min-h-24 resize-y py-3 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-[0.875rem] font-bold leading-none text-ink", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id="field-error" role="alert" className="text-[0.875rem] font-semibold leading-snug text-negative">
      {children}
    </p>
  );
}