"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { useNow } from "@/components/pending-overlay";

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return `${String(m).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Hitung mundur sisa waktu section; deadline dihitung sekali dari sisa waktu server saat halaman dimuat. */
export function SectionCountdown({ msLeft }: { msLeft: number }) {
  const [deadline] = useState(() => Date.now() + msLeft);
  const left = deadline - useNow();
  return (
    <p
      role="timer"
      aria-label={left > 0 ? `Sisa waktu section ${clock(left)}` : "Waktu section sudah habis"}
      className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-3 py-1.5 font-round text-[1.125rem] font-extrabold text-mango-line"
    >
      <Clock className="size-4" strokeWidth={2.6} aria-hidden />
      {left > 0 ? <span className="tnum">{clock(left)} tersisa</span> : <span className="font-sans text-[0.875rem]">Waktu section habis</span>}
    </p>
  );
}
