import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[16px] text-center font-display font-extrabold tracking-[0.01em] transition-[color,background-color,border-color,transform,box-shadow,filter] duration-150 hover:brightness-[1.04] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none";

// Gaya mockup: tepi bawah tebal yang turun 5px saat ditekan.
const press = "active:translate-y-[5px] active:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: "ledge bg-primary text-white",
  secondary: `border-2 border-hairline bg-surface text-ink shadow-[0_5px_0_var(--color-hairline)] hover:border-primary-bright hover:text-primary-deep ${press}`,
  ghost: "text-ink-subtle hover:bg-surface-muted hover:text-ink",
  danger: `border-2 border-negative/35 bg-surface text-negative shadow-[0_5px_0_var(--color-negative-soft)] hover:bg-negative-soft ${press}`,
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-[0.9375rem]",
  md: "h-14 px-7 text-[1.0625rem]",
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
