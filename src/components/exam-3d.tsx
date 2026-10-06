import { Headphones } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tumpukan tiga lembar ujian isometrik (Listening, Structure, Reading).
 * Murni CSS 3D transform: ringan di HP dan berhenti bergerak saat
 * prefers-reduced-motion aktif. Dekoratif, jadi disembunyikan dari pembaca layar.
 */
export function ExamStack({
  size = "lg",
  labels = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  labels?: boolean;
  className?: string;
}) {
  const dims = {
    sm: { w: 52, h: 64, gap: 14, radius: 8, text: "" },
    md: { w: 230, h: 290, gap: 46, radius: 16, text: "text-2xl" },
    lg: { w: 300, h: 380, gap: 60, radius: 18, text: "text-[2rem]" },
  }[size];

  const sheets = [
    { label: "Reading · 50", tone: "bg-[#3a3e43] text-[#c4c0b6]" },
    { label: "Structure · 40", tone: "bg-surface text-ink" },
    { label: "Listening · 50", tone: "bg-primary text-white", icon: true },
  ];

  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center", className)}
      style={{ perspective: size === "sm" ? 600 : 1300 }}
    >
      <div className="stack-3d relative" style={{ width: dims.w, height: dims.h }}>
        {sheets.map((sheet, index) => (
          <div
            key={sheet.label}
            className={cn(
              "absolute inset-0 flex flex-col justify-end p-5 shadow-[0_30px_50px_-24px_rgba(0,0,0,0.6)]",
              sheet.icon && labels && "justify-between",
              sheet.tone,
            )}
            style={{ transform: `translateZ(${index * dims.gap}px)`, borderRadius: dims.radius }}
          >
            {labels && sheet.icon ? <Headphones className="size-9" strokeWidth={1.8} /> : null}
            {labels ? (
              <span className={cn("font-display font-extrabold leading-tight", dims.text)}>{sheet.label}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const BAR_TONES = {
  listening: { front: "#15803d", side: "#14532d", top: "#79c79a" },
  structure: { front: "#b8862f", side: "#8a6520", top: "#e0b562" },
  reading: { front: "#2563eb", side: "#1e4bb8", top: "#7ea3f0" },
} as const;

/** Grafik batang skor section (31-68) dalam bentuk balok 3D. */
export function ScoreBars3D({
  bars,
}: {
  bars: { key: keyof typeof BAR_TONES; label: string; score: number; detail: string }[];
}) {
  const depth = 96;
  const heightOf = (score: number) => Math.round(40 + ((Math.min(Math.max(score, 31), 68) - 31) / 37) * 220);

  return (
    <div
      role="img"
      aria-label={`Skor section: ${bars.map((bar) => `${bar.label} ${bar.score}`).join(", ")}, skala 31 sampai 68`}
      className="flex flex-col gap-4"
    >
      <div
        className="flex h-[300px] items-end justify-center gap-10 sm:gap-16"
        style={{ perspective: 1400, perspectiveOrigin: "50% 20%" }}
        aria-hidden
      >
        {bars.map((bar, index) => {
          const h = heightOf(bar.score);
          const tone = BAR_TONES[bar.key];
          return (
            <div
              key={bar.key}
              className="flex items-end"
              style={{ transformStyle: "preserve-3d", transform: "rotateX(-14deg) rotateY(-28deg)" }}
            >
              <div
                className="bar-rise relative"
                style={{
                  width: depth,
                  height: h,
                  transformStyle: "preserve-3d",
                  animationDelay: `${index * 120}ms`,
                }}
              >
                <div
                  className="absolute left-0 top-0 flex justify-center pt-3 font-round text-[1.75rem] font-extrabold text-white"
                  style={{ width: depth, height: h, transform: `translateZ(${depth / 2}px)`, background: tone.front }}
                >
                  {bar.score}
                </div>
                <div
                  className="absolute left-0 top-0"
                  style={{ width: depth, height: h, transform: `rotateY(90deg) translateZ(${depth / 2}px)`, background: tone.side }}
                />
                <div
                  className="absolute left-0"
                  style={{
                    top: (h - depth) / 2,
                    width: depth,
                    height: depth,
                    transform: `rotateX(90deg) translateZ(${h / 2}px)`,
                    background: tone.top,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-6 sm:gap-10">
        {bars.map((bar) => (
          <div key={bar.key} className="flex w-28 flex-col items-center text-center">
            <span className="text-[1rem] font-bold text-ink">{bar.label}</span>
            <span className="text-[0.875rem] text-ink-subtle">{bar.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}