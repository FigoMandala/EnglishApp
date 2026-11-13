"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { setSfxEnabled, sfx, sfxEnabled } from "@/lib/sfx";

export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(sfxEnabled()), []);

  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Matikan efek suara" : "Nyalakan efek suara"}
      title={on ? "Efek suara: nyala" : "Efek suara: mati"}
      onClick={() => {
        setSfxEnabled(!on);
        setOn(!on);
        if (!on) sfx.correct(); // bunyi konfirmasi: kalau terdengar, berarti hidup
      }}
      className={`relative flex size-11 cursor-pointer items-center justify-center rounded-control border-2 transition-[background-color,color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-95 ${
        on
          ? "border-primary-line bg-primary-soft text-primary hover:border-primary"
          : "border-hairline bg-surface-muted text-ink-faint hover:border-ink-faint"
      }`}
    >
      <Icon className="size-4" aria-hidden />
      <span
        aria-hidden
        className={`absolute -right-1 -top-1 size-3 rounded-full border-2 border-surface ${on ? "bg-primary-bright" : "bg-ink-faint"}`}
      />
    </button>
  );
}
