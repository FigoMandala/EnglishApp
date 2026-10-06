import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { chatMessages } from "@/db/schema";

export type ChatRow = { id: number; role: "user" | "assistant"; content: string };

export async function listChatMessages(userId: number, limit = 40): Promise<ChatRow[]> {
  const rows = await db
    .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.id));
  return rows.slice(-limit);
}

export async function createChatMessage(
  userId: number,
  role: "user" | "assistant",
  content: string,
) {
  await db.insert(chatMessages).values({ userId, role, content });
}

export async function clearChatMessages(userId: number) {
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}
