import { getTts } from "@/lib/api/tts";
import { getCurrentUser } from "@/lib/session";

// GET supaya browser bisa meng-cache audio per teks.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const text = params.get("text")?.trim() ?? "";
  const voice = params.get("voice") === "Charon" ? "Charon" : "Kore";
  if (!text || text.length > 600) return new Response("Teks tidak valid", { status: 400 });

  const audio = await getTts(text, voice);
  if (!audio) return new Response("TTS gagal", { status: 502 });
  return new Response(new Uint8Array(audio), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}
