"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   Komponen visual data — mono-tone hijau + dual-encode
   ═══════════════════════════════════════════════════════════ */

/** Bar chart 7 hari aktivitas terakhir. */
export function ActivityBars({
  data,
  unit = "",
}: {
  data: { label: string; value: number }[];
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const summary = data.map((d) => `${d.label} ${d.value}${unit}`).join(", ");
  return (
    <div className="bar-chart" role="img" aria-label={`Tujuh hari terakhir: ${summary}`}>
      {data.map((point) => {
        return (
          <div key={point.label} className="bar-col" title={`${point.label}: ${point.value}${unit}`}>
            <span className="tnum font-round text-[0.75rem] font-extrabold text-ink-muted">
              {point.value > 0 ? point.value : ""}
            </span>
            <div className="bar" style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }} />
            <span className="whitespace-nowrap text-[0.75rem] font-semibold text-ink-faint">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Gauge ring untuk target harian. */
export function GaugeRing({
  value,
  label,
  caption,
  display,
  tone = "primary",
  size = 104,
}: {
  value: number;
  label?: string;
  caption?: string;
  /** Teks di tengah; default persen. */
  display?: string;
  tone?: "primary" | "mango" | "brick";
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = 42;
  const circ = 2 * Math.PI * r;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSettled(true);
      return;
    }
    const raf = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const target = circ - (clamped / 100) * circ;
  const offset = settled ? target : circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progres"}
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-canvas-deep)" strokeWidth={11} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`var(--color-${tone === "primary" ? "primary" : tone === "mango" ? "mango-deep" : tone})`}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms var(--ease-out)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-round text-[1.5rem] font-extrabold leading-none text-ink">{display ?? `${clamped}%`}</span>
        {caption ? (
          <span className="mt-0.5 text-[0.75rem] font-bold text-ink-subtle">{caption}</span>
        ) : null}
      </div>
    </div>
  );
}
