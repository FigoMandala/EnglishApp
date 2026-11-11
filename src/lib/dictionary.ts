/** Fonetik IPA dari Free Dictionary API (dictionaryapi.dev, terbuka, tanpa key). Null kalau kata tidak ada atau API gagal. */
export async function dictionaryPhonetic(word: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const [entry] = (await response.json()) as { phonetic?: string; phonetics?: { text?: string }[] }[];
    return entry?.phonetic || entry?.phonetics?.find((p) => p.text)?.text || null;
  } catch {
    return null;
  }
}
