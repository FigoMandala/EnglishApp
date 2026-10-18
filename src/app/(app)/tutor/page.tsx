import { Drama } from "lucide-react";
import Link from "next/link";

import { listChatMessages } from "@/db/queries/chat";
import { requireUser } from "@/lib/session";

import { TutorChat } from "./tutor-chat";

export const metadata = { title: "Tutor AI · EnglishApp" };

export default async function TutorPage() {
  const user = await requireUser();
  const history = await listChatMessages(user.id, 40);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/tutor/skenario"
        className="flex min-h-11 w-fit items-center gap-2 rounded-[12px] border-2 border-hairline bg-surface px-4 text-[0.9375rem] font-extrabold shadow-[0_3px_0_var(--color-hairline)] transition-[transform,box-shadow] active:translate-y-[3px] active:shadow-none"
      >
        <Drama className="size-4 text-primary" aria-hidden />
        Latihan skenario (interview, hotel, dll.)
      </Link>
      <TutorChat
        initialMessages={history.map((row) => ({ role: row.role, content: row.content }))}
      />
    </div>
  );
}
