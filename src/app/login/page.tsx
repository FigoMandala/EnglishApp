import { Flame } from "lucide-react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { Lori } from "@/components/mascot";
import { getCurrentUser, homePath } from "@/lib/session";

import { AuthForm } from "./auth-form";

export const metadata = { title: "Masuk · EnglishApp" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePath());

  return (
    <main className="flex min-h-dvh flex-wrap bg-canvas">
      <div className="flex min-w-0 flex-[1_1_520px] flex-col px-4 pb-10 pt-7 sm:px-10">
        <Logo href="/" size={40} />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="page-enter flex w-full max-w-[440px] flex-col gap-6">
            <AuthForm />
            <div className="flex items-center gap-3 text-[0.875rem] text-ink-subtle">
              <span className="h-0.5 flex-1 bg-hairline" />
              atau
              <span className="h-0.5 flex-1 bg-hairline" />
            </div>
            <Link
              href="/mulai/tujuan"
              className="flex min-h-[52px] items-center justify-center rounded-[16px] border-2 border-hairline bg-surface font-display font-extrabold text-ink shadow-card transition-transform active:translate-y-1 active:shadow-none"
            >
              Atur tujuan dulu, akun nanti
            </Link>
          </div>
        </div>
      </div>

      <aside
        aria-label="Sorotan"
        className="relative m-4 hidden min-w-0 flex-[1_1_480px] flex-col justify-between gap-8 overflow-hidden rounded-[32px] bg-primary p-12 text-white lg:flex"
      >
        <div className="flex flex-col gap-3.5">
          <p className="eyebrow text-primary-soft">Selamat datang kembali</p>
          <h2 className="max-w-[440px] font-display text-[2.5rem] font-black leading-[1.1] tracking-[-0.03em]">
            Streak-mu menunggu. Satu sesi 3 menit cukup.
          </h2>
        </div>
        <div className="relative z-[1] flex max-w-[380px] flex-col gap-3 pb-40">
          <div className="flex items-center gap-3.5 rounded-[20px] bg-surface px-[18px] py-4 text-ink shadow-[0_5px_0_var(--color-primary-deep)]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-mango-soft text-mango-deep">
              <Flame className="size-6" aria-hidden />
            </span>
            <span>
              <strong className="block font-display text-[1.125rem]">Jaga streak</strong>
              <span className="text-[0.875rem] text-ink-subtle">Belajar tiap hari, pelindung untuk hari berat</span>
            </span>
          </div>
          <div className="ml-7 flex items-center gap-3.5 rounded-[20px] bg-surface px-[18px] py-4 text-ink shadow-[0_5px_0_var(--color-primary-deep)]">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft font-display font-black text-primary">
              Aa
            </span>
            <span>
              <strong className="block font-display text-[1.125rem]">Kartu siap diulang</strong>
              <span className="text-[0.875rem] text-ink-subtle">SRS menjadwalkan sebelum kamu lupa</span>
            </span>
          </div>
        </div>
        <Lori mood="wave" size={280} label="Lori melambai" className="absolute -bottom-2 right-6" />
      </aside>
    </main>
  );
}
