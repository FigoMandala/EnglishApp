"use client";

import { Loader2, Send, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

export function TutorChat({ initialMessages }: { initialMessages: ChatMessage[] }) {
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
        body: JSON.stringify({ message }),
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
    if (!window.confirm("Hapus semua riwayat chat?")) return;
    await fetch("/api/tutor/clear", { method: "POST" });
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="clay flex min-h-[420px] flex-col gap-4 p-5 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <p className="max-w-sm text-[0.9375rem] text-ink-subtle">
              Mulai percakapan. Tanyakan grammar, kosakata, atau minta latihan soal.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
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
            <div
              key={index}
              className={cn("flex flex-col gap-1", entry.role === "user" ? "items-end" : "items-start")}
            >
              <span className="px-1 text-[0.6875rem] font-bold uppercase tracking-wide text-ink-faint">
                {entry.role === "user" ? "Kamu" : "Tutor"}
              </span>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-plate px-4 py-3 text-[0.9375rem] leading-relaxed",
                  entry.role === "user"
                    ? "bg-primary text-white"
                    : "border-2 border-hairline bg-surface-muted text-ink",
                )}
              >
                {entry.content ||
                  (streaming && index === messages.length - 1 ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "…"
                  ))}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p role="alert" className="rounded-control bg-negative-soft px-4 py-2.5 text-[0.875rem] font-semibold text-negative">
          {error}
        </p>
      ) : null}

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
          className="min-h-12 resize-none py-3"
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
            <Button
              type="button"
              variant="secondary"
              onClick={stop}
              aria-label="Hentikan jawaban"
              title="Hentikan jawaban"
            >
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
    </div>
  );
}
