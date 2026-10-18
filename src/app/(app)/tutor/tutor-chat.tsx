"use client";

import { Loader2, Send, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  // Textarea tumbuh mengikuti isi (maksimal ±8 baris) lalu scroll sendiri.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
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
    if (!window.confirm(scenario ? "Mulai ulang skenario?" : "Hapus semua riwayat chat?")) return;
    if (!scenario) await fetch("/api/tutor/clear", { method: "POST" });
    setMessages(scenario ? initialMessages : []);
    setError(null);
  }

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
            aria-label="Bersihkan riwayat"
            title="Bersihkan riwayat"
            onClick={() => {
              void clearChat();
            }}
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
      <div className={cn("flex flex-col gap-6 lg:flex-row", className)}>
        <section aria-label="Lori sedang berbicara" className="flex flex-col gap-3.5 lg:w-[420px] lg:shrink-0">
          <div className="rise relative min-h-[420px] flex-1 overflow-hidden rounded-[28px] border-2 border-[#b9d6be] bg-[#dcebdd] lg:min-h-[560px]">
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-[0.875rem] font-extrabold">
                <span className="relative size-2.5">
                  {streaming ? <span className="ping absolute inset-0 rounded-full bg-primary" /> : null}
                  <span className="absolute inset-0 rounded-full bg-primary" />
                </span>
                {streaming ? "Lori sedang mengetik" : scenario ? `Skenario: ${scenario.title}` : "Mode teks"}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-[70px] flex justify-center">
              <Lori mood={streaming ? "talk" : messages.length > 0 ? "idle" : "wave"} size={340} label="Lori, tutor AI-mu" />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-white/90 p-4">
              <div aria-hidden className="flex h-9 flex-1 items-center gap-1">
                {Array.from({ length: 24 }, (_, i) => (
                  <span
                    key={i}
                    className={cn("h-full flex-1 rounded-[3px] bg-primary", streaming ? "wave-bar" : "scale-y-[0.2]")}
                    style={streaming ? { animationDelay: `${(i % 8) * 0.11}s` } : undefined}
                  />
                ))}
              </div>
              <span className="text-[0.875rem] font-extrabold text-primary-deep">{streaming ? "Lori menjawab…" : "Siap mendengarkan"}</span>
            </div>
          </div>
        </section>

        <section
          aria-label="Transkrip percakapan"
          className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border-2 border-hairline bg-surface shadow-[0_5px_0_var(--color-hairline)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#f1ece2] px-5 py-4">
            <h2 className="font-display text-[1.375rem] font-black">{scenario ? scenario.title : "Ngobrol dengan Lori"}</h2>
            <span className="text-[0.8125rem] font-bold text-ink-subtle">{scenario ? `Lori jadi ${scenario.persona}` : "Penjelasan Indonesia, contoh Inggris"}</span>
          </div>

          <ol className="flex max-h-[520px] min-h-[320px] flex-1 list-none flex-col gap-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <li className="pop self-start rounded-[6px_18px_18px_18px] bg-primary-soft px-4 py-3.5 text-[1.0625rem] leading-normal">
                Hai! Aku Lori. Tanya grammar, minta contoh kalimat, atau latihan percakapan. Salah dikit nggak apa-apa.
              </li>
            ) : (
              messages.map((entry, index) => {
                const typing = !entry.content && streaming && index === messages.length - 1;
                return (
                  <li
                    key={index}
                    className={cn(
                      "rise max-w-[85%] whitespace-pre-wrap px-4 py-3.5 text-[1.0625rem] leading-normal",
                      entry.role === "user"
                        ? "self-end rounded-[18px_6px_18px_18px] bg-[#2a2c33] text-canvas"
                        : "self-start rounded-[6px_18px_18px_18px] bg-primary-soft text-ink",
                    )}
                  >
                    {typing ? (
                      <span role="img" aria-label="Lori sedang mengetik" className="flex gap-1.5 py-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="dot-wave size-[9px] rounded-full bg-[#8f8574]" style={{ "--i": i } as React.CSSProperties} />
                        ))}
                      </span>
                    ) : entry.role === "assistant" ? (
                      plain(entry.content) || "…"
                    ) : (
                      entry.content
                    )}
                  </li>
                );
              })
            )}
            <div ref={bottomRef} />
          </ol>

          <div className="flex flex-col gap-3 border-t-2 border-[#f1ece2] px-5 pb-[18px] pt-3.5">
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={streaming}
                  onClick={() => send(suggestion)}
                  className="min-h-10 cursor-pointer rounded-full border-2 border-hairline bg-surface px-3.5 text-[0.875rem] font-bold shadow-[0_2px_0_var(--color-hairline)] transition-[transform,box-shadow] hover:border-primary active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {errorBox}
            {form}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-plate bg-surface-muted p-3">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <p className="max-w-sm text-[0.9375rem] text-ink-subtle">
              Mulai percakapan. Tanyakan grammar, kosakata, atau minta latihan soal.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border-2 border-hairline bg-surface px-4 py-2 text-[0.8125rem] font-semibold text-ink-subtle transition-colors hover:border-primary hover:text-primary"
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
                {(entry.role === "assistant" ? plain(entry.content) : entry.content) ||
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
