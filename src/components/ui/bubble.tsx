import { cn } from "@/lib/utils";

/**
 * Gelembung ucapan maskot (sudut kiri bawah lancip). `tone="dark"` untuk Kaka di atas arang,
 * `tone="cream"` untuk gelembung terang di atas panel arang.
 */
export function SpeechBubble({
  who,
  tone = "light",
  className,
  children,
}: {
  who?: string;
  tone?: "light" | "dark" | "cream";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px_20px_20px_6px] px-4 py-3 text-[0.9375rem] leading-[1.5]",
        tone === "light" && "border-2 border-hairline bg-surface shadow-[0_3px_0_var(--color-hairline)]",
        tone === "dark" && "bg-charcoal text-charcoal-ink",
        tone === "cream" && "bg-canvas text-ink",
        className,
      )}
    >
      {who ? (
        <strong
          className={cn(
            "block text-[0.875rem]",
            tone === "dark" ? "text-mango-line" : tone === "cream" ? "text-brick-deep" : "text-primary-deep",
          )}
        >
          {who}
        </strong>
      ) : null}
      {children}
    </div>
  );
}
