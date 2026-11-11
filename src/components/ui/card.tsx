import { cn } from "@/lib/utils";

export function Card({ className, flat, ...props }: React.ComponentProps<"div"> & { flat?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-plate border-2 border-hairline bg-surface",
        !flat && "shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-1 sm:px-6 sm:pt-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-display text-[1.25rem] font-extrabold leading-tight text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[0.9375rem] leading-snug text-ink-subtle", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}