import { exportUserData, recordDataRequest } from "@/db/queries/reporting";
import { getCurrentUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";

/**
 * Hak subjek data UU PDP: unduh seluruh data milik akun sendiri sebagai JSON.
 * Setiap unduhan tercatat di data_requests dan terlihat di panel admin.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const data = await exportUserData(user.id);
  await recordDataRequest(user.id, "export");

  const body = JSON.stringify(
    {
      account: { username: user.username, displayName: user.displayName, role: user.role },
      ...data,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="englishapp-data-${user.username}-${todayISO()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
