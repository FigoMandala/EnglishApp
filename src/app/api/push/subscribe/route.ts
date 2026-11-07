import { savePushSubscription } from "@/db/queries/push";
import { getCurrentUser } from "@/lib/session";

/** Simpan (atau perbarui) langganan push milik pengguna yang sedang login. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "Belum masuk." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: unknown;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const keys = body?.keys as { p256dh?: unknown; auth?: unknown } | null | undefined;
  if (
    !endpoint.startsWith("https://") ||
    !keys ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string"
  ) {
    return Response.json({ ok: false, message: "Langganan tidak valid." }, { status: 400 });
  }

  await savePushSubscription(user.id, endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth }));
  return Response.json({ ok: true });
}
