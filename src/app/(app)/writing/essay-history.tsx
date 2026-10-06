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
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.id} className="group relative">
          <Link
            href={`/writing/${row.id}`}
            className="row-hover flex min-h-11 items-center justify-between gap-2 rounded-control px-2 pr-10"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] font-bold text-ink">
                {row.prompt || "Esai tanpa topik"}
              </span>
              <span className="text-[0.75rem] text-ink-faint">
                {formatDate(row.createdAt)} · {row.wordCount} kata
              </span>
            </span>
            <span
              className={cn(
                "tnum shrink-0 font-round text-[1.125rem] font-extrabold",
                row.total >= 70 ? "text-primary" : row.total >= 50 ? "text-warning" : "text-negative",
              )}
            >
              {row.total}
            </span>
          </Link>
          <button
            type="button"
            aria-label={`Hapus esai ${row.prompt || "tanpa topik"}`}
            title="Hapus esai"
            disabled={deleting !== null || pending}
            onClick={() => remove(row.id)}
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-ink-faint opacity-0 transition-opacity hover:bg-negative-soft hover:text-negative focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
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
