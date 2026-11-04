"use client";

import { Loader2, Volume2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

import { DEFAULT_PREFS, speakLines } from "@/lib/voices";
import { cn } from "@/lib/utils";

/**
 * Tombol putar pengucapan kata memakai Web Speech API (lokal, hemat bandwidth).
 * Dekoratif-fungsional: kalau browser tidak mendukung, tombol disembunyikan.
 */
export function SpeakButton({
  text,
  className,
  label = "Putar pengucapan",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  // Server & render pertama selalu false supaya tidak ada hydration mismatch.
  const supported = useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => false);

  const [loading, setLoading] = useState(false);

  if (!supported) return null;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setLoading(true);
        speakLines([{ speaker: "woman", text }], DEFAULT_PREFS, undefined, () => setLoading(false));
      }}
      className={cn(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-sky-soft text-sky transition-colors hover:bg-sky-line/50 hover:text-sky-deep",
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
    </button>
  );
}