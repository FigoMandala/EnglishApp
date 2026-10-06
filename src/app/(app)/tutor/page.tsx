import { listChatMessages } from "@/db/queries/chat";
import { requireUser } from "@/lib/session";

import { TutorChat } from "./tutor-chat";

export const metadata = { title: "Tutor AI · EnglishApp" };

export default async function TutorPage() {
  const user = await requireUser();
  const history = await listChatMessages(user.id, 40);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Tutor AI</p>
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]">
          Tanya apa saja, dijawab tutor yang sabar
        </h1>
        <p className="max-w-2xl text-[0.9375rem] text-ink-subtle">
          Tanya grammar, minta contoh kalimat, atau latihan percakapan. Penjelasan dalam Bahasa
          Indonesia, contoh dalam Bahasa Inggris. Riwayat chat tersimpan.
        </p>
      </header>

      <TutorChat
        initialMessages={history.map((row) => ({ role: row.role, content: row.content }))}
      />
    </div>
  );
}
