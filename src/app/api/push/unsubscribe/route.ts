import { deletePushSubscription } from "@/db/queries/push";
import { getCurrentUser } from "@/lib/session";

/** Cabut langganan push milik pengguna yang sedang login. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "Belum masuk." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return Response.json({ ok: false, message: "Endpoint tidak valid." }, { status: 400 });

  await deletePushSubscription(user.id, endpoint);
  return Response.json({ ok: true });
}
