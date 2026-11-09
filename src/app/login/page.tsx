import { Flame, Lock } from "lucide-react";

import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { Lori } from "@/components/mascot";
import { getCurrentUser, homePath } from "@/lib/session";
import { SITE_CLOSED } from "@/lib/site-lock";

import { AuthForm } from "./auth-form";

export const metadata = { title: "Masuk · EnglishApp" };

function ClosedNotice() {
  return (
    <div
      role="status"
      className="pop flex items-start gap-3.5 rounded-[20px] border-2 border-mango-deep/30 bg-mango-soft px-[18px] py-4 text-ink"
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-surface text-mango-deep">
        <span className="ping absolute inset-0 rounded-[14px] bg-mango-deep/30" aria-hidden />
        <Lock className="bob relative size-6" aria-hidden />
      </span>
      <span>
        <strong className="block font-display text-[1.125rem]">Sedang dalam tahap pengembangan</strong>
        <span className="text-[0.9375rem] text-ink-muted">
          Kami sedang menyiapkan aplikasi ini. Pendaftaran belum dibuka dan hanya admin yang bisa masuk. Nantikan ya!
        </span>
      </span>
    </div>
  );
}

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePath());

  return (
    <main className="flex min-h-dvh flex-wrap bg-canvas">
      <div className="flex min-w-0 flex-[1_1_520px] flex-col px-4 pb-10 pt-7 sm:px-10">
        <Logo href="/" size={40} />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="page-enter flex w-full max-w-[440px] flex-col gap-6">
            {SITE_CLOSED ? <ClosedNotice /> : null}
            <AuthForm />
          </div>
        </div>
      </div>

      <aside
        aria-label="Sorotan"
        className="relative m-4 hidden min-w-0 flex-[1_1_480px] flex-col justify-between gap-8 overflow-hidden rounded-[32px] bg-primary p-12 text-white lg:flex"
      >
        <div className="flex flex-col gap-3.5">
          <p className="eyebrow text-primary-soft">{SITE_CLOSED ? "Dalam pengembangan" : "Selamat datang kembali"}</p>
          <h2 className="max-w-[440px] font-display text-[2.5rem] font-black leading-[1.1] tracking-[-0.03em]">
            {SITE_CLOSED ? "Lori lagi sibuk menyiapkan pelajaran. Segera hadir!" : "Streak-mu menunggu. Satu sesi 3 menit cukup."}
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
        <Lori
          mood={SITE_CLOSED ? "sad" : "wave"}
          size={280}
          label={SITE_CLOSED ? "Lori menunggu aplikasi selesai dikembangkan" : "Lori melambai"}
          className="absolute -bottom-2 right-6"
        />
      </aside>
    </main>
  );
}
