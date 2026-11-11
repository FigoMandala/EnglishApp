import { cn } from "@/lib/utils";

/** Gelembung ucapan maskot (sudut kiri bawah lancip). */
export function SpeechBubble({
  who,
  tone = "light",
  className,
  children,
}: {
  who?: string;
  tone?: "light";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px_20px_20px_6px] px-4 py-3 text-[0.9375rem] leading-[1.5]",
        tone === "light" && "border-2 border-hairline bg-surface shadow-[0_3px_0_var(--color-hairline)]",
        className,
      )}
    >
      {who ? (
        <strong className="block text-[0.875rem] text-primary-deep">{who}</strong>
      ) : null}
      {children}
    </div>
  );
}
