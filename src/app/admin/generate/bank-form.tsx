"use client";

import { useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

const SELECT = "h-11 rounded-control border-2 border-hairline bg-surface px-3 font-bold";
const KIND_LABEL: Record<string, string> = {
  structure: "Structure",
  written: "Written",
  reading: "Reading",
  "listen-short": "Listening: Short Dialogue",
  "listen-long": "Listening: Long Dialogue",
  "listen-lecture": "Listening: Lecture",
};
const KINDS = Object.keys(KIND_LABEL);
/** Sama dengan batas per request di route; total yang lebih besar dikirim sebagai beberapa request berurutan. */
const CHUNK = 5;
const MAX_BATCHES = 100;
const WARN_ABOVE = 30;
const STOP_AFTER_EMPTY = 3;
const SHOW_LINES = 50;

type Line = { kind: string; n: number; dropped: number; error?: string };
type StreamEvent =
  | { type: "start"; total: number }
  | ({ type: "batch"; done: number; total: number } & Line)
  | { type: "end"; added: number; dropped: number };

/** Pecah permintaan jadi potongan <= CHUNK batch; untuk "all" bergantian antar jenis supaya hasil sementara tetap seimbang. */
function planChunks(kind: string, calls: number) {
  const kinds = kind === "all" ? KINDS : [kind];
  const left = new Map(kinds.map((k) => [k, calls]));
  const chunks: { kind: string; calls: number }[] = [];
  while ([...left.values()].some((n) => n > 0)) {
    for (const k of kinds) {
      const n = Math.min(CHUNK, left.get(k) ?? 0);
      if (n > 0) {
        chunks.push({ kind: k, calls: n });
        left.set(k, (left.get(k) ?? 0) - n);
      }
    }
  }
  return chunks;
}

/** Form generate soal EPrT: permintaan besar dipecah per 5 batch, dikirim berurutan dengan progres nyata dan tombol Berhenti. */
export function BankForm({ ready }: { ready: boolean }) {
  const [running, setRunning] = useState(false);
  const [kind, setKind] = useState("all");
  const [calls, setCalls] = useState(1);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [summary, setSummary] = useState<{ ok: boolean; text: string } | null>(null);
  const stopped = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const total = Math.min(MAX_BATCHES, Math.max(1, calls || 1)) * (kind === "all" ? KINDS.length : 1);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chunks = planChunks(String(form.get("kind")), Math.min(MAX_BATCHES, Math.max(1, Number(form.get("calls")) || 1)));
    const grand = chunks.reduce((sum, chunk) => sum + chunk.calls, 0);
    stopped.current = false;
    setRunning(true);
    setLines([]);
    setSummary(null);
    setProgress({ done: 0, total: grand });

    let doneBase = 0;
    let added = 0;
    let dropped = 0;
    let failedChunks = 0;
    let emptyInRow = 0;
    let note = "";
    try {
      for (const chunk of chunks) {
        if (stopped.current) break;
        controller.current = new AbortController();
        let finished = false;
        let chunkAdded = 0;
        try {
          const response = await fetch("/api/admin/generate-bank", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.current.signal,
            body: JSON.stringify({ kind: chunk.kind, band: form.get("band"), calls: chunk.calls, topic: form.get("topic") }),
          });
          if (!response.ok || !response.body) {
            const data = (await response.json().catch(() => ({}))) as { message?: string };
            throw new Error(data.message ?? `Server menjawab status ${response.status}.`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const rows = buffer.split("\n");
            buffer = rows.pop() ?? "";
            for (const row of rows.filter(Boolean)) {
              const message = JSON.parse(row) as StreamEvent;
              if (message.type === "batch") {
                setProgress({ done: doneBase + message.done, total: grand });
                setLines((prev) => [...prev, message].slice(-SHOW_LINES));
              } else if (message.type === "end") {
                finished = true;
                chunkAdded = message.added;
                added += message.added;
                dropped += message.dropped;
              }
            }
          }
          if (!finished) throw new Error("Koneksi terputus sebelum potongan ini selesai.");
        } catch (error) {
          if (stopped.current) break;
          failedChunks += 1;
          // Kegagalan koneksi/server (bukan sekadar 0 soal lolos) menghentikan loop supaya tidak menghabiskan biaya percuma.
          note = error instanceof Error ? error.message : "Gagal.";
          break;
        }
        doneBase += chunk.calls;
        setProgress({ done: doneBase, total: grand });
        emptyInRow = chunkAdded === 0 ? emptyInRow + 1 : 0;
        if (emptyInRow >= STOP_AFTER_EMPTY) {
          note = `Berhenti otomatis: ${STOP_AFTER_EMPTY} potongan berturut-turut tidak menghasilkan soal (cek key, saldo, atau model).`;
          break;
        }
      }
    } finally {
      const stoppedByUser = stopped.current;
      setSummary({
        ok: added > 0 && !note,
        text: `${stoppedByUser ? "Dihentikan. " : note ? `${note} ` : "Selesai. "}+${added} item masuk bank, ${dropped} soal dibuang saat verifikasi${failedChunks ? `, ${failedChunks} potongan gagal` : ""}. Yang sudah selesai tetap tersimpan.`,
      });
      setRunning(false);
    }
  }

  function stop() {
    stopped.current = true;
    controller.current?.abort();
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kind">Jenis</Label>
          <select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value)} className={SELECT} disabled={running}>
            <option value="all">Semua ({KINDS.length} jenis)</option>
            <optgroup label="Structure & Reading">
              <option value="structure">Structure: Sentence Completion</option>
              <option value="written">Structure: Error Recognition</option>
              <option value="reading">Reading</option>
            </optgroup>
            <optgroup label="Listening">
              <option value="listen-short">Short Dialogue</option>
              <option value="listen-long">Long Dialogue</option>
              <option value="listen-lecture">Lecture</option>
            </optgroup>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="band">Level</Label>
          <select id="band" name="band" defaultValue="mid" className={SELECT} disabled={running}>
            <option value="low">low (~400)</option>
            <option value="mid">mid (~500)</option>
            <option value="high">high (~600)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calls">Jumlah batch{kind === "all" ? " per jenis" : ""}</Label>
          <Input
            id="calls"
            name="calls"
            type="number"
            min={1}
            max={MAX_BATCHES}
            value={calls}
            onChange={(event) => setCalls(Number(event.target.value))}
            disabled={running}
            className="h-11 text-[0.9375rem]"
          />
          <p className="text-[0.75rem] text-ink-subtle">1 batch = 6 soal (Reading: 1 teks; Long Dialogue dan Lecture: 2 naskah ≈ 10 soal). Maks {MAX_BATCHES}.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="topic">Topik (opsional)</Label>
        <Input id="topic" name="topic" placeholder="kosong = topik acak" disabled={running} className="h-11 text-[0.9375rem]" />
      </div>
      {total > WARN_ABOVE ? (
        <p role="note" className="rounded-control border-2 border-mango/40 bg-mango-soft px-3 py-2 text-[0.8125rem] font-bold text-mango-ink">
          {total} batch akan memakan puluhan menit dan biaya AI sebanding. Tab ini harus tetap terbuka sampai selesai; kamu bisa menekan Berhenti kapan saja.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={!ready || running} aria-busy={running} className={buttonVariants({ className: "flex-1" })}>
          {running ? "Sedang membuat… jangan tutup halaman" : "Generate soal"}
        </button>
        {running ? (
          <button type="button" onClick={stop} className={buttonVariants({ variant: "secondary" })}>
            Berhenti
          </button>
        ) : null}
      </div>

      {progress ? (
        <div role="status" className="flex flex-col gap-2">
          <div className="h-3 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.total ? Math.max(4, (progress.done / progress.total) * 100) : 4}%` }}
            />
          </div>
          <p className="text-[0.8125rem] font-bold">
            {progress.total ? `${progress.done}/${progress.total} batch selesai` : "Menyiapkan…"}
          </p>
          <ul className="flex flex-col gap-1 text-[0.8125rem]">
            {lines.map((line, i) => (
              <li key={i} className={line.error ? "text-brick-deep" : "text-ink-subtle"}>
                {KIND_LABEL[line.kind]}: {line.error ? `gagal (${line.error})` : `+${line.n} item, ${line.dropped} dibuang`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary ? (
        <p role="status" className={summary.ok ? "font-bold text-primary-deep" : "font-bold text-brick-deep"}>
          {summary.text}
        </p>
      ) : null}
    </form>
  );
}
