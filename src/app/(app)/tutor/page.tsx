import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { listChatMessages } from "@/db/queries/chat";
import { requireUser } from "@/lib/session";

import { TutorChat } from "./tutor-chat";

export const metadata = { title: "Tutor AI · EnglishApp" };

export default async function TutorPage() {
  const user = await requireUser();
  const history = await listChatMessages(user.id, 40);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <TutorChat
        className="flex-[1_1_560px]"
        initialMessages={history.map((row) => ({ role: row.role, content: row.content }))}
      />
      <aside className="flex min-w-[260px] flex-[0_1_300px] flex-col gap-4">
        <Link
          href="/tutor/skenario"
          className="flex flex-col gap-2.5 rounded-[24px] border-2 border-hairline bg-surface p-5 text-ink shadow-card hover:border-primary-line"
        >
          <span className="eyebrow text-primary-deep">Mode skenario</span>
          <strong className="font-display text-[1.1875rem] leading-tight">
            Role-play bareng Lori: interview, presentasi, hotel
          </strong>
          <span className="text-[0.875rem] text-ink-subtle">
            Lori jadi lawan bicara. Kamu dapat misi dan ringkasan koreksi di akhir.
          </span>
          <span className="flex items-center gap-1 text-[0.875rem] font-extrabold text-primary-deep">
            Pilih skenario <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden />
          </span>
        </Link>
        <p className="px-1 text-[0.8125rem] text-ink-subtle">
          Lori bisa salah. Untuk soal ujian, cek ulang di Materi.
        </p>
      </aside>
    </div>
  );
}
