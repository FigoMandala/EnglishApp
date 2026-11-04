"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   Komponen visual data — mono-tone hijau + dual-encode
   ═══════════════════════════════════════════════════════════ */

/** Kartu KPI ringkas untuk dashboard (label kiri, angka kanan). */
export function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "neutral",
  progress,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "dark";
  progress?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-plate border-2 px-[1.1875rem] py-[1.0625rem] shadow-card transition-transform duration-200 hover:-translate-y-0.5",
        tone === "dark" ? "border-ink bg-ink" : "border-hairline bg-surface",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          {icon ? (
            <span
              className={cn(
                "flex size-[2.375rem] shrink-0 items-center justify-center rounded-[11px] border",
                tone === "dark"
                  ? "border-white/10 bg-white/5 text-white"
                  : "border-hairline bg-surface-muted text-ink-muted",
              )}
            >
              {icon}
            </span>
          ) : null}
          <div>
            <p className={cn("text-[0.8125rem] font-bold", tone === "dark" ? "text-white/70" : "text-ink-subtle")}>
              {label}
            </p>
            {hint ? (
              <p className={cn("mt-0.5 text-[0.75rem]", tone === "dark" ? "text-white/55" : "text-ink-faint")}>
                {hint}
              </p>
            ) : null}
          </div>
        </div>
        <p
          className={cn(
            "font-round text-[1.875rem] font-extrabold leading-none",
            tone === "dark" ? "text-white" : "text-ink",
          )}
        >
          {value}
          {unit ? (
            <span className={cn("text-[0.8125rem] font-semibold", tone === "dark" ? "text-white/60" : "text-ink-subtle")}>
              {" "}
              {unit}
            </span>
          ) : null}
        </p>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-mint" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Bar chart 7 hari: batang hijau = target tercapai, abu = belum. */
export function ActivityBars({
  data,
  target,
  unit = "",
}: {
  data: { label: string; value: number }[];
  target?: number;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value), target ?? 0);
  const summary = data.map((d) => `${d.label} ${d.value}${unit}`).join(", ");
  return (
    <div className="bar-chart" role="img" aria-label={`Tujuh hari terakhir: ${summary}`}>
      {data.map((point) => {
        const below = target ? point.value < target : false;
        return (
          <div key={point.label} className="bar-col" title={`${point.label}: ${point.value}${unit}`}>
            <span className="tnum font-round text-[0.75rem] font-extrabold text-ink-muted">
              {point.value > 0 ? point.value : ""}
            </span>
            <div
              className={cn("bar", below && "below")}
              style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
            />
            <span className="whitespace-nowrap text-[0.6875rem] font-semibold text-ink-faint">{point.label}</span>
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
          stroke={`var(--color-${tone === "primary" ? "primary" : tone})`}
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
          <span className="mt-0.5 text-[0.6875rem] font-bold text-ink-subtle">{caption}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Radar 4-sumbu mono-tone untuk skill EPrT. */
export function SkillRadar({
  skills,
}: {
  skills: { name: string; value: number; href?: string }[];
}) {
  const cx = 108;
  const cy = 108;
  const R = 86;
  const n = skills.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, radius: number) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius] as const;
  };
  const poly = (radiusFor: (i: number) => number) =>
    skills
      .map((_, i) => {
        const [x, y] = pt(i, radiusFor(i));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        viewBox="0 0 216 216"
        className="size-[200px] shrink-0 overflow-visible"
        role="img"
        aria-label={skills.map((s) => `${s.name} ${s.value} persen`).join(", ")}
      >
        {[1, 0.66, 0.33].map((scale) => (
          <polygon
            key={scale}
            points={poly(() => R * scale)}
            fill="none"
            stroke="var(--color-canvas-deep)"
            strokeWidth={1.3}
          />
        ))}
        {skills.map((_, i) => {
          const [x1, y1] = pt(i, R);
          const [x2, y2] = pt(i, 0);
          return <line key={i} x1={x2} y1={y2} x2={x1} y2={y1} stroke="var(--color-canvas-deep)" strokeWidth={1.3} />;
        })}
        <polygon
          points={poly((i) => (skills[i].value / 100) * R)}
          fill="rgba(21,128,61,0.14)"
          stroke="var(--color-primary)"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        {skills.map((s, i) => {
          const [x, y] = pt(i, (s.value / 100) * R);
          return <circle key={i} cx={x} cy={y} r={4.5} fill="var(--color-primary)" />;
        })}
        {skills.map((s, i) => {
          const [x, y] = pt(i, R + 14);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={700}
              fill="var(--color-ink-subtle)"
            >
              {s.name}
            </text>
          );
        })}
      </svg>
      <div className="flex min-w-[160px] flex-1 flex-col gap-[0.6875rem]">
        {skills.map((s) => {
          const row = (
            <>
              <span className="min-w-[70px] text-[0.8125rem] font-bold text-ink">{s.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-deep">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${s.value}%` }} />
              </span>
              <span className="tnum min-w-[36px] text-right text-[0.75rem] font-semibold text-ink-subtle">{s.value}%</span>
            </>
          );
          return s.href ? (
            <Link
              key={s.name}
              href={s.href}
              className="-mx-2 flex min-h-9 items-center gap-[0.5625rem] rounded-[10px] px-2 transition-colors hover:bg-surface-muted"
            >
              {row}
            </Link>
          ) : (
            <div key={s.name} className="flex items-center gap-[0.5625rem]">
              {row}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Line chart tren skor (EPrT) menuju target. */
export function TrendLine({
  points,
  target,
  labels,
}: {
  points: number[];
  target: number;
  labels?: string[];
}) {
  const w = 300;
  const h = 150;
  const pad = 15;
  const min = Math.min(...points, target) - 15;
  const max = Math.max(...points, target) + 15;
  const xFor = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const yFor = (v: number) => h - 25 - ((v - min) / (max - min)) * (h - 45);
  const line = points.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");
  const area = `${line} ${xFor(points.length - 1).toFixed(1)},${h - 25} ${xFor(0).toFixed(1)},${h - 25}`;
  const goalY = yFor(target);

  return (
    <div>
      <div className="relative h-[150px]">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="size-full overflow-visible"
          role="img"
          aria-label={`Tren skor menuju target ${target}: ${points.join(", ")}`}
        >
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(37,99,235,0.14)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0)" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={w}
              y1={h * f}
              y2={h * f}
              stroke="var(--color-canvas-deep)"
              strokeWidth={1}
            />
          ))}
          <line x1={0} x2={w} y1={goalY} y2={goalY} stroke="var(--color-ink-faint)" strokeWidth={2} strokeDasharray="6 5" opacity={0.5} />
          <text x={0} y={goalY - 5} fontSize={9} fill="var(--color-ink-subtle)" fontFamily="JetBrains Mono, monospace">
            target {target}
          </text>
          <polygon points={area} fill="url(#trendGrad)" />
          <polyline points={line} fill="none" stroke="var(--color-data)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((v, i) => (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(v)}
              r={i === points.length - 1 ? 4 : 3.4}
              fill="#fff"
              stroke="var(--color-data)"
              strokeWidth={2.6}
            />
          ))}
        </svg>
      </div>
      {labels ? (
        <div className="mt-2 flex justify-between font-mono text-[0.625rem] text-ink-faint">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}