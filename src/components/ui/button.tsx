import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-control text-center font-bold transition-[color,background-color,border-color,transform,box-shadow] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-card hover:bg-primary-deep hover:-translate-y-0.5",
  secondary:
    "border-2 border-hairline bg-surface text-ink shadow-card hover:border-primary hover:text-primary-deep",
  ghost: "text-ink-subtle hover:bg-surface-muted hover:text-ink",
  danger: "border border-negative/35 bg-surface text-negative hover:bg-negative-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-[0.875rem]",
  md: "h-12 px-[1.375rem] text-[0.9375rem]",
};

export function buttonVariants(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  const { variant = "primary", size = "md", className } = options;
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}