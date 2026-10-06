import { redirect } from "next/navigation";

import { ExamStack } from "@/components/exam-3d";
import { getCurrentUser, homePath } from "@/lib/session";

import { AuthForm } from "./auth-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePath());

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative flex flex-col justify-between gap-8 overflow-hidden bg-primary-deep px-6 py-8 text-white sm:px-12 lg:px-16 lg:py-16">
        <div
          className="pointer-events-none absolute -bottom-24 -right-20 size-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(63,157,99,0.5), transparent 68%)" }}
          aria-hidden
        />
        <p className="relative z-[1] flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[12px] bg-white font-display text-xl font-extrabold text-primary-deep">
            E
          </span>
          <span className="font-display text-xl font-bold">EnglishApp</span>
        </p>

        <ExamStack size="lg" className="relative z-[1] hidden h-[440px] lg:flex" />

        <div className="relative z-[1] flex max-w-lg flex-col gap-3">
          <h2 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[2.5rem]">
            Latihan EPrT yang terasa seperti hari ujian.
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-[#cfe8d8]">
            140 soal, tiga section, timer sungguhan. Soal baru setiap kali, pembahasan dalam Bahasa Indonesia.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-12">
        <div className="page-enter flex w-full max-w-[420px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[2rem] font-extrabold tracking-[-0.02em]">Masuk</h1>
            <p className="text-[1.0625rem] text-ink-subtle">
              Lanjutkan latihan dari terakhir kali, atau buat akun baru.
            </p>
          </div>
          <AuthForm />
        </div>
      </section>
    </main>
  );
}