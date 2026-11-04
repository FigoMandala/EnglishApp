"use client";

import { cn } from "@/lib/utils";

/** Saklar on/off yang bisa diakses (role="switch"), gaya mockup. */
export function Switch({
  checked,
  onChange,
  labelledBy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[34px] w-[58px] shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-hairline-strong",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1 left-1 size-[26px] rounded-full bg-white shadow-[0_2px_0_rgba(0,0,0,0.18)] transition-transform duration-200 ease-out",
          checked ? "translate-x-7" : "translate-x-0",
        )}
      />
    </button>
  );
}
