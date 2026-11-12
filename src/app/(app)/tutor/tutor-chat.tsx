"use client";

import { Loader2, Send, Sparkles, Square, Trash2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Lori } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Jelaskan perbedaan much dan many dengan contoh.",
  "Periksa kalimat ini: She go to school every day.",
  "Beri 5 kosakata penting untuk topik lingkungan.",
  "Buatkan 3 soal structure untuk latihan malam ini.",
];

/** Jaga-jaga kalau model tetap memakai markdown: buang tanda bintang dan pagar. */
const plain = (text: string) =>
  text.replace(/^\s*\*\s+/gm, "- ").replace(/\*+/g, "").replace(/^#+\s*/gm, "");

const CORRECTION_PREFIX = "Lebih natural:";

/** Render balasan tutor. Baris "Lebih natural:" (mode koreksi skenario) ditampilkan
 *  sebagai kartu koreksi kecil di dalam bubble yang sama, sisanya teks biasa. */
function renderAssistant(content: string) {
  const text = plain(content);
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.trim().startsWith(CORRECTION_PREFIX)) {
      return (
        <span
          key={i}
          className="mt-2 block rounded-[12px] border-t-2 border-hairline-soft bg-sky-soft/60 px-3 py-2 text-[0.875rem] text-sky-deep"
        >
          <strong className="mr-1 font-extrabold">Koreksi:</strong>
          {line.trim().slice(CORRECTION_PREFIX.length).trim()}
        </span>
      );
    }
    // Baris koreksi adalah elemen block (pindah baris sendiri), jadi pemisah "\n"
    // tidak perlu kalau baris berikutnya adalah koreksi.
    const nextIsCorrection = lines[i + 1]?.trim().startsWith(CORRECTION_PREFIX) ?? false;
    return (
      <Fragment key={i}>
        {line}
        {i < lines.length - 1 && !nextIsCorrection ? "\n" : ""}
      </Fragment>
    );
  });
}

export function TutorChat({
  initialMessages,
  context,
  suggestions = SUGGESTIONS,
  className,
  compact = false,
  scenario,
  correction = "live",
}: {
  compact?: boolean;
  /** Mode role-play: riwayat dikirim dari klien dan tidak disimpan ke chat biasa. */
  scenario?: { id: string; title: string; persona: string };
  correction?: "live" | "end";
  initialMessages: ChatMessage[];
  /** Soal yang sedang dikerjakan; dikirim ke AI supaya jawabannya relevan. */
  context?: string;
  suggestions?: string[];
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askClear, setAskClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const prm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: streaming || prm ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  // Textarea tumbuh mengikuti isi (maksimal ±8 baris) lalu scroll sendiri.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // box-sizing border-box: scrollHeight tidak menghitung border, tanpa ini muncul scrollbar kecil walau 1 baris.
    const border = el.offsetHeight - el.clientHeight;
    const natural = el.scrollHeight + border;
    el.style.height = `${Math.min(natural, 192)}px`;
    el.style.overflowY = natural > 192 ? "auto" : "hidden";
  }, [input]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;

    setError(null);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/tutor/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scenario
            ? {
                message,
                scenario: scenario.id,
                correction,
                history: messages.filter((entry) => entry.content).slice(-12),
              }
            : { message, context },
        ),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "Tutor tidak bisa dihubungi.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming tidak tersedia.");

      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(trimmed.slice(5).trim()) as { text?: string; message?: string };
            if (payload.text) {
              full += payload.text;
              setMessages((prev) => {
                const copy = [...prev];
                // Riwayat bisa saja dikosongkan di tengah streaming; jangan menulis
                // ke indeks -1 kalau array sudah kosong.
                if (copy.length === 0 || copy[copy.length - 1].role !== "assistant") return prev;
                copy[copy.length - 1] = { role: "assistant", content: full };
                return copy;
              });
            }
            if (payload.message) setError(payload.message);
          } catch {
            // abaikan baris yang tidak bisa diparse
          }
        }
      }
    } catch (err) {
      // Pengguna menekan Berhenti: sisa jawaban yang sudah masuk tetap ditampilkan.
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => prev.filter((entry, index) => !(index === prev.length - 1 && entry.role === "assistant" && !entry.content)));
      } else {
        setError(err instanceof Error ? err.message : "Tutor tidak bisa dihubungi.");
        setMessages((prev) => prev.filter((entry, index) => !(index === prev.length - 1 && entry.role === "assistant" && !entry.content)));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }

  async function clearChat() {
    setAskClear(false);
    if (!scenario) await fetch("/api/tutor/clear", { method: "POST" });
    setMessages(scenario ? initialMessages : []);
    setError(null);
  }

  const confirmClear = (
    <ConfirmDialog
      open={askClear}
      danger
      title={scenario ? "Mulai ulang skenario?" : "Hapus semua riwayat chat?"}
      message={scenario ? undefined : "Percakapan sebelumnya dihapus dan tidak bisa dikembalikan."}
      confirmLabel={scenario ? "Mulai ulang" : "Hapus"}
      onConfirm={() => void clearChat()}
      onCancel={() => setAskClear(false)}
    />
  );

  const form = (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        send(input);
      }}
    >
      <Textarea
        ref={textareaRef}
        value={input}
        rows={1}
        maxLength={2000}
        enterKeyHint="send"
        placeholder="Tulis pertanyaanmu…"
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send(input);
          }
        }}
        className="min-h-[54px] resize-none rounded-[16px] bg-surface-muted py-3.5"
        aria-label="Pesan untuk tutor"
      />
      <div className="flex gap-2">
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={streaming}
            aria-label="Bersihkan riwayat"
            title={streaming ? "Tunggu jawaban selesai" : "Bersihkan riwayat"}
            onClick={() => setAskClear(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : null}
        {streaming ? (
          <Button type="button" variant="secondary" onClick={stop} aria-label="Hentikan jawaban" title="Hentikan jawaban">
            <Square className="size-4" aria-hidden />
            Berhenti
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <Send className="size-4" aria-hidden />
            Kirim
          </Button>
        )}
      </div>
    </form>
  );

  const errorBox = error ? (
    <p role="alert" className="rounded-control bg-negative-soft px-4 py-2.5 text-[0.875rem] font-semibold text-negative">
      {error}
    </p>
  ) : null;

  if (!compact) {
    return (
      <section
        aria-label={scenario ? `Skenario: ${scenario.title}` : "Percakapan dengan Lori"}
        className={cn(
          "flex h-[calc(100dvh-180px)] min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[28px] border-2 border-hairline bg-surface lg:h-[calc(100dvh-64px)]",
          className,
        )}
      >
        {confirmClear}
        <header className="flex flex-wrap items-center gap-3 border-b-2 border-hairline-soft px-[18px] py-3.5">
          <span className="flex size-12 shrink-0 items-end justify-center overflow-hidden rounded-full bg-primary-soft">
            <Lori mood={streaming ? "talk" : "wave"} size={56} className="-mb-2.5" />
          </span>
          <span className="min-w-40 flex-1 leading-tight">
            <strong className="block font-display text-[1.125rem]">{scenario ? scenario.title : "Ngobrol dengan Lori"}</strong>
            <span className="text-[0.8125rem] text-ink-subtle">
              {streaming ? "Lori sedang mengetik…" : scenario ? `Lori jadi ${scenario.persona}` : "Penjelasan Indonesia, contoh Inggris"}
            </span>
          </span>
          {messages.length > 0 ? (
            <button
              type="button"
              aria-label={scenario ? "Mulai ulang skenario" : "Bersihkan riwayat"}
              title={scenario ? "Mulai ulang skenario" : "Bersihkan riwayat"}
              onClick={() => setAskClear(true)}
              className="flex size-10 cursor-pointer items-center justify-center rounded-[12px] border-2 border-hairline bg-surface text-ink-subtle hover:border-brick-line hover:text-brick"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
        </header>

        <ol role="log" aria-label="Transkrip percakapan" className="flex min-h-0 flex-1 list-none flex-col gap-3.5 overflow-y-auto bg-surface-muted px-[18px] py-5">
          {messages.length === 0 ? (
            <li className="pop flex max-w-[82%] items-end gap-2.5 self-start">
              <Lori mood="wave" size={36} className="shrink-0" />
              <span className="rounded-[20px_20px_20px_6px] border-2 border-hairline bg-surface px-4 py-3.5 text-[0.9375rem]">
                Hai! Aku Lori. Tanya grammar, minta contoh kalimat, atau latihan percakapan. Salah dikit nggak apa-apa.
              </span>
            </li>
          ) : (
            messages.map((entry, index) => {
              const typing = !entry.content && streaming && index === messages.length - 1;
              return entry.role === "user" ? (
                <li
                  key={index}
                  className="pop-in max-w-[72%] self-end whitespace-pre-wrap rounded-[20px_20px_6px_20px] bg-primary px-4 py-3 text-[0.9375rem] text-white"
                >
                  {entry.content}
                </li>
              ) : (
                <li key={index} className="pop-in flex max-w-[82%] items-end gap-2.5 self-start">
                  <Lori mood={typing ? "think" : "talk"} size={36} className="shrink-0" />
                  <span className="whitespace-pre-wrap rounded-[20px_20px_20px_6px] border-2 border-hairline bg-surface px-4 py-3.5 text-[0.9375rem] leading-relaxed">
                    {typing ? (
                      <span role="img" aria-label="Lori sedang mengetik" className="flex gap-1 py-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="dot-wave size-2 rounded-full bg-ink-faint" style={{ "--i": i } as React.CSSProperties} />
                        ))}
                      </span>
                    ) : (
                      renderAssistant(entry.content) || "…"
                    )}
                  </span>
                </li>
              );
            })
          )}
          <div ref={bottomRef} />
        </ol>

        <div className="flex flex-col gap-2.5 border-t-2 border-hairline-soft px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={streaming}
                onClick={() => send(suggestion)}
                className="min-h-10 cursor-pointer rounded-full border-2 border-hairline bg-surface px-3 text-[0.8125rem] font-bold text-ink-muted hover:border-primary-line hover:text-primary-deep disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
          {errorBox}
          <form
            className="flex items-end gap-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <Textarea
              ref={textareaRef}
              value={input}
              rows={1}
              maxLength={2000}
              placeholder="Tulis pertanyaanmu…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              className="min-h-[52px] resize-none rounded-[16px] bg-surface-muted py-3.5"
              aria-label="Pesan untuk tutor"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Hentikan jawaban"
                title="Hentikan jawaban"
                className="flex size-[52px] shrink-0 cursor-pointer items-center justify-center rounded-[16px] border-2 border-hairline bg-surface text-ink"
              >
                <Square className="size-5" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Kirim"
                disabled={!input.trim()}
                className="flex size-[52px] shrink-0 cursor-pointer items-center justify-center rounded-[16px] bg-primary text-white shadow-[0_4px_0_var(--color-primary-deep)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-50"
              >
                <Send className="size-5" aria-hidden />
              </button>
            )}
          </form>
        </div>
      </section>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {confirmClear}
      <div role="log" aria-label="Transkrip percakapan" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-plate bg-surface-muted p-3">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <p className="max-w-sm text-[0.9375rem] text-ink-subtle">
              Mulai percakapan. Tanyakan grammar, kosakata, atau minta latihan soal.
            </p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={streaming}
                  onClick={() => send(suggestion)}
                  style={{ "--i": i } as React.CSSProperties}
                  className="rise min-h-11 w-full cursor-pointer rounded-[14px] border-2 border-hairline bg-surface px-4 py-2.5 text-left text-[0.875rem] font-semibold text-ink-muted transition-[color,border-color,transform] duration-150 hover:border-primary-line hover:text-primary-deep active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((entry, index) => (
            <div key={index} className={cn("flex flex-col gap-1", entry.role === "user" ? "items-end" : "items-start")}>
              <span className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-ink-faint">
                {entry.role === "user" ? "Kamu" : "Tutor"}
              </span>
              <div
                className={cn(
                  "max-w-full whitespace-pre-wrap rounded-plate px-4 py-3 text-[0.9375rem] leading-relaxed",
                  entry.role === "user" ? "bg-primary text-white" : "bg-surface text-ink",
                )}
              >
                {(entry.role === "assistant" ? renderAssistant(entry.content) : entry.content) ||
                  (streaming && index === messages.length - 1 ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "…")}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {errorBox}
      {form}
    </div>
  );
}
