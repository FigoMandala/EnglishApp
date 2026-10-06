"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

import { completeUnitAction } from "../actions";

export function CompleteUnitButton({ unitId }: { unitId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-[0.875rem] font-bold text-primary-deep">
        <CheckCircle2 className="size-4" aria-hidden />
        Unit selesai
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await completeUnitAction(unitId);
          setDone(true);
          router.refresh();
        })
      }
      className="flex h-11 items-center gap-2 rounded-control bg-primary px-5 text-[0.9375rem] font-bold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
      Tandai unit selesai
    </button>
  );
}
