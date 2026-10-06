import { clearChatMessages } from "@/db/queries/chat";
import { getCurrentUser } from "@/lib/session";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  await clearChatMessages(user.id);
  return Response.json({ ok: true });
}
