"use client";

import { useEffect, useRef, useState } from "react";

import { Lori } from "@/components/mascot";
import { cn } from "@/lib/utils";

type ModelViewerProps = React.HTMLAttributes<HTMLElement> & {
  ref?: React.Ref<HTMLElement>;
  src?: string;
  alt?: string;
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "shadow-intensity"?: number;
  shadow?: string;
  exposure?: number;
  loading?: string;
  reveal?: string;
  autoplay?: boolean;
  "animation-name"?: string;
};

/** Custom element <model-viewer> dari @google/model-viewer (dimuat di efek). */
const ModelViewer = "model-viewer" as unknown as React.FC<ModelViewerProps>;

type ModelViewerEl = HTMLElement & { loaded?: boolean };

/**
 * Lori versi 3D (assets/lori-3d/lori.blend → public/models/lori.glb).
 * Bisa diputar dengan drag. Selama model belum termuat, tampil SVG Lori
 * sebagai fallback. Menghormati prefers-reduced-motion: auto-rotate mati.
 */
export function Lori3D({
  size = 190,
  label = "Lori, maskot 3D — putar dengan drag",
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const ref = useRef<ModelViewerEl | null>(null);

  useEffect(() => {
    // Mendaftarkan custom element <model-viewer>; hanya di browser.
    void import("@google/model-viewer");
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setReady(true);
    // Event "load" bisa terjadi sebelum efek ini jalan, jadi cek juga propertinya.
    if (el.loaded) sync();
    el.addEventListener("load", sync);
    return () => el.removeEventListener("load", sync);
  }, []);

  return (
    <div className={cn("relative shrink-0 select-none", className)} style={{ width: size, height: size * 1.2 }}>
      {!ready && <Lori mood="talk" size={size} className="absolute inset-0" />}
      <ModelViewer
        ref={ref}
        src="/models/lori.glb"
        alt={label}
        camera-controls
        {...(reduced ? {} : { "auto-rotate": true })}
        shadow-intensity={1}
        shadow="soft"
        exposure={1.3}
        animation-name="LoriAlive"
        autoplay
        loading="eager"
        reveal="auto"
        className="absolute inset-0 size-full cursor-grab touch-pan-y active:cursor-grabbing"
        style={{ visibility: ready ? "visible" : "hidden" }}
      />
      {ready && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 inline-flex items-center gap-1 rounded-full bg-charcoal px-2 py-0.5 text-[0.625rem] font-extrabold tracking-wide text-white/90"
        >
          3D ↻
        </span>
      )}
    </div>
  );
}
