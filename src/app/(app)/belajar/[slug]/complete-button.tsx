"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Confetti } from "@/components/fx/confetti";
import { buttonVariants } from "@/components/ui/button";
import { sfx } from "@/lib/sfx";

import { completeUnitAction } from "../actions";

export function CompleteUnitButton({ unitId }: { unitId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className="pop relative flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-[0.875rem] font-extrabold text-primary-deep">
        <Confetti />
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
          sfx.levelUp();
          router.refresh();
        })
      }
      className={buttonVariants({ variant: "reward", size: "sm" })}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
      Tandai unit selesai
    </button>
  );
}
