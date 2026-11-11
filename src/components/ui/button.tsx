import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "reward" | "exam" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[14px] text-center font-display font-extrabold tracking-[0.02em] transition-[color,background-color,border-color,transform,translate,box-shadow,filter] duration-150 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

// Tombol "ledge": tepi bawah tebal yang turun 5px saat ditekan.
const press = "active:translate-y-[5px] active:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: `bg-primary text-white shadow-[0_5px_0_var(--color-primary-deep)] hover:bg-primary-bright ${press}`,
  secondary: `border-2 border-hairline bg-surface text-ink shadow-[0_5px_0_var(--color-hairline)] hover:border-hairline-strong hover:bg-surface-muted ${press}`,
  reward: `bg-mango text-mango-on shadow-[0_5px_0_var(--color-mango-deep)] hover:brightness-105 ${press}`,
  exam: `bg-charcoal text-charcoal-ink shadow-[0_5px_0_#000] hover:bg-charcoal-raised ${press}`,
  ghost: "text-ink-subtle hover:bg-surface-muted hover:text-ink",
  danger: `border-2 border-hairline bg-surface text-brick-deep shadow-[0_5px_0_var(--color-hairline)] hover:border-brick-line hover:bg-brick-soft ${press}`,
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-[0.9375rem]",
  md: "h-[52px] px-6 text-[1rem]",
  lg: "h-14 px-8 text-[1.0625rem] rounded-[16px]",
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
