"use client";

import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";

/** Tombol submit yang menampilkan status menunggu selama server action (panggilan AI) berjalan. */
export function SubmitButton({ children, waiting, disabled }: { children: string; waiting: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending} className={buttonVariants()}>
      {pending ? `${waiting} (jangan tutup halaman, bisa 1-3 menit)` : children}
    </button>
  );
}
