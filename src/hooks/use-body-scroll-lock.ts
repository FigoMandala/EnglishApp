"use client";

import { useEffect } from "react";

/**
 * Kunci scroll halaman saat overlay layar penuh terbuka.
 * iOS Safari mengabaikan overflow:hidden pada body (halaman tetap rubber-band
 * di belakang overlay), jadi dipakai teknik position:fixed + compensasi scroll.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { scrollY } = window;
    const { body } = document;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
