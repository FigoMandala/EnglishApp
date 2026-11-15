import { Lock } from "lucide-react";

import { redirect } from "next/navigation";

import { getCurrentUser, homePath } from "@/lib/session";
import { SITE_CLOSED } from "@/lib/site-lock";

import { AuthScreen } from "./auth-form";

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

  return <AuthScreen notice={SITE_CLOSED ? <ClosedNotice /> : null} />;
}
