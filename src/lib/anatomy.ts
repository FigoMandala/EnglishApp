/** Peran potongan kalimat di komponen "Bedah kalimat". */
export type AnatomyTone = "subject" | "verb" | "wrong" | "right" | "muted" | "time" | "plain" | "strike";

export type AnatomyPart = { text: string; label?: string; tone?: AnatomyTone };

const BLANK = /_{2,}|\[\s*\]|…{1,}|\.{3,}/;

/**
 * Bedah dari soal isian: kalimat dibelah di titik rumpang, jawaban murid dicoret, jawaban benar hijau.
 * Mengembalikan null kalau soal tidak punya penanda rumpang.
 */
export function blankAnatomy(prompt: string, yours: string | null, correct: string | null): AnatomyPart[] | null {
  const match = BLANK.exec(prompt);
  if (!match || !correct) return null;
  const before = prompt.slice(0, match.index).trim();
  const after = prompt.slice(match.index + match[0].length).trim();
  const parts: AnatomyPart[] = [];
  if (before) parts.push({ text: before, tone: "plain" });
  if (yours && yours.trim().toLowerCase() !== correct.trim().toLowerCase()) {
    parts.push({ text: yours, label: "Jawabanmu", tone: "wrong" });
  }
  parts.push({ text: correct, label: "Yang benar", tone: "right" });
  if (after) parts.push({ text: after, tone: "plain" });
  return parts;
}
