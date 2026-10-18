"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Angka naik dari 0 ke `to`. Server dan "kurangi gerakan" langsung menampilkan angka akhir.
 */
export function CountUp({ to, ms = 800, className }: { to: number; ms?: number; className?: string }) {
  const [n, setN] = useState(to);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);

  return <span className={className ?? "tnum"}>{n.toLocaleString("id-ID")}</span>;
}
