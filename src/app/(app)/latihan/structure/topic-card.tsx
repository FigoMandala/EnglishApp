"use client";

import { useActionState } from "react";

import { startToeflBlock, type ToeflState } from "@/app/(app)/toefl/actions";

const initial: ToeflState = { status: "idle" };

function StartButton({ kind, skill, label, primary }: { kind: "drill" | "written"; skill: string; label: string; primary?: boolean }) {
  const [state, action, pending] = useActionState(startToeflBlock, initial);
  return (
    <form action={action} className="flex flex-1 flex-col gap-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="skill" value={skill} />
      <button
        type="submit"
        disabled={pending}
        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] px-3 text-[0.8125rem] font-extrabold transition-transform active:translate-y-0.5 disabled:opacity-60 ${
          primary
            ? "bg-primary text-white shadow-[0_3px_0_var(--color-primary-deep)]"
            : "border-2 border-hairline bg-surface text-ink shadow-[0_3px_0_var(--color-hairline)]"
        }`}
      >
        {pending ? "Menyiapkan..." : label}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="text-[0.75rem] text-brick-deep">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function TopicCard({ skill, label, hint }: { skill: string; label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-[18px] shadow-card">
      <div className="flex flex-col gap-1">
        <strong className="text-[1rem] leading-snug">{label}</strong>
        <span className="text-[0.8125rem] leading-snug text-ink-subtle">{hint}</span>
      </div>
      <div className="mt-auto flex gap-2">
        <StartButton kind="drill" skill={skill} label="Lengkapi kalimat" primary />
        <StartButton kind="written" skill={skill} label="Cari kesalahan" />
      </div>
    </div>
  );
}
