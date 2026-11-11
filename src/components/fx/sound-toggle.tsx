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
        if (!on) sfx.tap();
      }}
      className="flex size-11 cursor-pointer items-center justify-center rounded-control border-2 border-hairline bg-surface text-ink-subtle transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:border-primary hover:text-primary active:scale-95"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
