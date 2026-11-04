"use client";

import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { deleteEssayAction } from "./actions";

export type EssayRow = {
  id: number;
  prompt: string;
  createdAt: string;
  wordCount: number;
  total: number;
};

export function EssayHistory({ rows }: { rows: EssayRow[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(id: number) {
    if (deleting !== null || pending) return;
    if (!window.confirm("Hapus esai ini beserta nilainya? Tindakan ini tidak bisa dibatalkan.")) return;
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteEssayAction(id);
        router.refresh();
      } finally {
        setDeleting(null);
      }
    });
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className="group relative border-b-2 border-hairline-soft last:border-b-0">
          <Link href={`/writing/${row.id}`} className="flex items-center gap-3 py-2.5 pr-10 text-ink hover:text-primary-deep">
            <span
              className={cn(
                "tnum flex size-11 shrink-0 items-center justify-center rounded-[12px] font-round text-[1.125rem] font-extrabold",
                row.total >= 70
                  ? "bg-primary-soft text-primary-deep"
                  : row.total >= 50
                    ? "bg-mango-soft text-mango-ink"
                    : "bg-brick-soft text-brick-deep",
              )}
            >
              {row.total}
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <strong className="block truncate text-[0.875rem]">{row.prompt || "Esai tanpa topik"}</strong>
              <span className="text-[0.75rem] text-ink-subtle">
                {formatDate(row.createdAt)} · {row.wordCount} kata
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-label={`Hapus esai ${row.prompt || "tanpa topik"}`}
            title="Hapus esai"
            disabled={deleting !== null || pending}
            onClick={() => remove(row.id)}
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-ink-faint opacity-0 transition-opacity hover:bg-brick-soft hover:text-brick focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
          >
            {deleting === row.id ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
