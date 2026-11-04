"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { register, type AuthState } from "@/app/auth-actions";
import { Confetti } from "@/components/fx/confetti";
import { CountUp } from "@/components/fx/count-up";
import { Lori } from "@/components/mascot";
import { FieldError, Input, Label } from "@/components/ui/field";
import { CEFR_TO_LEVEL, type WordLevel } from "@/lib/cefr";
import { EMPTY_ONBOARDING, loadOnboarding, placedCefr, type GoalId, type Onboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const GOAL_LABEL: Record<GoalId, string> = {
  eprt: "Lulus EPrT",
  toefl: "TOEFL ITP / IELTS",
  kerja: "Interview & kerja",
  kuliah: "Baca jurnal & kuliah",
  ngobrol: "Ngobrol lancar",
  jalan: "Jalan-jalan",
};
const LEVEL_NAME: Record<WordLevel, string> = { basic: "Dasar", intermediate: "Menengah", advanced: "Lanjut" };
const LEVEL_TONE: Record<WordLevel, string> = { basic: "bg-primary", intermediate: "bg-sky", advanced: "bg-mango" };

const initialState: AuthState = {};

export default function HasilPage() {
  const [data, setData] = useState<Onboarding>(EMPTY_ONBOARDING);
  const [showPw, setShowPw] = useState(false);
  const [state, action, pending] = useActionState(register, initialState);
  useEffect(() => setData(loadOnboarding()), []);

  const cefr = placedCefr(data);
  const skipped = CEFR_TO_LEVEL[cefr] === "advanced" ? 2 : CEFR_TO_LEVEL[cefr] === "intermediate" ? 1 : 0;
  const tested = Boolean(data.placement);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Confetti count={36} />
      <main className="relative mx-auto flex w-full max-w-[1280px] flex-1 flex-wrap items-center gap-10 px-6 py-10 sm:px-14">
        <section className="flex min-w-0 flex-1 basis-[560px] flex-col gap-[22px]">
          <div className="flex flex-wrap items-center gap-6">
            <Lori mood="cheer" size={200} label="Lori melompat gembira" />
            <div className="rise min-w-[280px] flex-1">
              <p className="text-[0.9375rem] font-extrabold tracking-[0.06em] text-primary-deep">{tested ? "HASIL TES PENEMPATAN" : "TITIK MULAIMU"}</p>
              <h1 className="mt-1.5 font-display text-[2.5rem] font-black leading-[1.02] tracking-[-0.03em] sm:text-[2.875rem]">
                Kamu mulai dari <span className="pop inline-block text-primary">{cefr}</span>
                {skipped > 0 ? ", bukan dari nol!" : "."}
              </h1>
              <p className="mt-1 text-[0.875rem] text-ink-subtle sm:mt-2.5 sm:text-[1.125rem]">
                {skipped === 0
                  ? "Jalurmu dimulai dari unit pertama, dengan Lori menemani tiap langkah."
                  : skipped === 1
                    ? "Lori melewati unit tingkat dasar, jadi kamu langsung masuk ke unit menengah."
                    : "Lori melewati unit dasar dan menengah, jadi kamu langsung masuk ke unit lanjut."}
              </p>
            </div>
          </div>

          {data.placement ? (
            <div className="rise grid gap-3.5 sm:grid-cols-3 [--i:2]">
              {(Object.keys(LEVEL_NAME) as WordLevel[]).map((level, i) => {
                const [good, total] = data.placement!.byLevel[level];
                if (total === 0) return null;
                return (
                  <div key={level} className="rounded-[18px] border-2 border-hairline bg-surface p-[18px] shadow-[0_4px_0_var(--color-hairline)]">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[1rem] font-extrabold">{LEVEL_NAME[level]}</span>
                      <span className="font-display text-[1.375rem] font-black">
                        <CountUp to={good} ms={600} />/{total}
                      </span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-sunken">
                      <div className={cn("grow-x h-full rounded-full", LEVEL_TONE[level])} style={{ width: `${(good / total) * 100}%`, animationDelay: `${0.3 + i * 0.15}s` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rise flex flex-wrap items-center gap-2.5 [--i:3]">
            {data.goal ? <span className="rounded-[12px] bg-mango-soft px-3.5 py-2.5 text-[0.9375rem] font-bold text-mango-ink">Tujuan: {GOAL_LABEL[data.goal]}</span> : null}
            <span className="rounded-[12px] bg-primary-soft px-3.5 py-2.5 text-[0.9375rem] font-bold text-primary-deep">{data.dailyMinutes} menit / hari</span>
            <Link href="/mulai/tujuan" className="flex min-h-11 items-center px-2 text-[0.9375rem] font-bold text-primary hover:underline">
              Ubah
            </Link>
          </div>
        </section>

        <section aria-labelledby="save-title" className="pop w-full max-w-[440px] rounded-[26px] border-2 border-hairline bg-surface p-7 shadow-[0_6px_0_var(--color-hairline)] [--i:3] lg:flex-1">
          <h2 id="save-title" className="font-display text-[1.75rem] font-black tracking-[-0.02em]">
            Simpan progresmu
          </h2>
          <p className="mb-5 mt-1.5 text-[1rem] text-ink-subtle">Biar hasil tes dan jalurmu nggak hilang.</p>
          <form action={action} className="flex flex-col gap-3.5" noValidate>
            <input type="hidden" name="onboarding" value={JSON.stringify(data)} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName">Nama panggilan</Label>
              <Input id="displayName" name="displayName" autoComplete="nickname" maxLength={40} placeholder="mis. Dimas" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "reg-error" : undefined} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Kata sandi</Label>
              <div className="relative">
                <Input id="password" name="password" type={showPw ? "text" : "password"} autoComplete="new-password" className="pr-14" />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-1 top-1 grid size-11 cursor-pointer place-items-center rounded-[10px] text-ink-subtle hover:bg-surface-muted"
                >
                  {showPw ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
              </div>
            </div>
            <div id="reg-error" role="alert">
              <FieldError>{state.error}</FieldError>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="ledge mt-1 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[16px] bg-primary font-display text-[1.1875rem] font-extrabold tracking-[0.02em] text-white disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              BUAT AKUN &amp; MULAI
            </button>
            <p className="text-center text-[0.9375rem] text-ink-subtle">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-extrabold text-primary hover:underline">
                Masuk
              </Link>
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
