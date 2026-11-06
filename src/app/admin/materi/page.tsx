import { ArrowDown, ArrowUp, BookOpen, SpellCheck } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listAllUnits } from "@/db/queries/admin";
import { cn } from "@/lib/utils";

import { moveUnitAction, moveUnitItemAction, toggleUnitAction } from "../actions";
import { Notice, param, type AdminSearchParams } from "../notice";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Tombol naik/turun kecil. Di ujung daftar tombolnya nonaktif. */
function MoveButtons({
  action,
  hidden,
  label,
  first,
  last,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string | number>;
  label: string;
  first: boolean;
  last: boolean;
}) {
  return (
    <form action={action} className="flex gap-1">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        name="dir"
        value="up"
        disabled={first}
        aria-label={`Naikkan ${label}`}
        className="flex size-10 items-center justify-center rounded-[10px] border-2 border-hairline bg-surface disabled:opacity-30"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="submit"
        name="dir"
        value="down"
        disabled={last}
        aria-label={`Turunkan ${label}`}
        className="flex size-10 items-center justify-center rounded-[10px] border-2 border-hairline bg-surface disabled:opacity-30"
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </form>
  );
}

export default async function AdminMaterialsPage({
  searchParams }: { searchParams: AdminSearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const units = await listAllUnits();
  const selected = units.find((unit) => unit.id === Number(param(params, "unit"))) ?? units[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Mode admin"
        title="Materi & Jalur Belajar"
        description="Urutan di sini = urutan unit di jalur pelajar. Unit yang disembunyikan tidak muncul di jalur."
      />
      <Notice pesan={param(params, "pesan")} galat={param(params, "galat")} />

      {units.length === 0 ? (
        <Card className="p-6 text-ink-subtle">Belum ada unit. Jalankan seed jalur belajar dulu.</Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <Card className="flex flex-col gap-1 p-3">
            <h2 className="px-2 pb-1 pt-1 text-[0.75rem] font-black uppercase tracking-[0.08em] text-ink-subtle">Unit · {units.length}</h2>
            <ol className="flex flex-col gap-1">
              {units.map((unit, index) => {
                const active = unit.id === selected?.id;
                return (
                  <li key={unit.id} className={cn("flex items-center gap-2 rounded-control border-2 p-1.5", active ? "border-primary bg-primary-soft" : "border-transparent")}>
                    <Link href={`/admin/materi?unit=${unit.id}`} aria-current={active ? "true" : undefined} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-ink">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full font-display text-[0.8125rem] font-extrabold text-white", unit.published ? "bg-primary" : "bg-hairline-strong")}>
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{unit.title}</span>
                        <span className="text-[0.75rem] text-ink-subtle">
                          {unit.items.length} item · {unit.level}
                          {unit.published ? "" : " · disembunyikan"}
                        </span>
                      </span>
                    </Link>
                    <MoveButtons action={moveUnitAction} hidden={{ unitId: unit.id }} label={unit.title} first={index === 0} last={index === units.length - 1} />
                  </li>
                );
              })}
            </ol>
          </Card>

          {selected ? (
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.75rem] font-black uppercase tracking-[0.08em] text-primary">{selected.slug}</p>
                  <h2 className="font-display text-2xl font-extrabold">{selected.title}</h2>
                  {selected.description ? <p className="text-ink-subtle">{selected.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/belajar/${selected.slug}`} className="flex min-h-11 items-center rounded-control border-2 border-hairline px-4 font-bold text-ink">
                    Lihat sebagai pelajar
                  </Link>
                  <form action={toggleUnitAction}>
                    <input type="hidden" name="unitId" value={selected.id} />
                    <input type="hidden" name="publish" value={selected.published ? "0" : "1"} />
                    <button
                      type="submit"
                      className={cn(
                        "ledge min-h-11 rounded-control px-4 font-bold",
                        selected.published ? "bg-surface text-brick-deep [--ledge:var(--color-hairline)] border-2 border-hairline" : "bg-mango text-mango-ink [--ledge:var(--color-mango-deep)]",
                      )}
                    >
                      {selected.published ? "Sembunyikan dari pelajar" : "Terbitkan unit"}
                    </button>
                  </form>
                </div>
              </div>

              <h3 className="text-[0.8125rem] font-black uppercase tracking-[0.06em] text-ink-subtle">Isi unit · urutan langkah di jalur</h3>
              {selected.items.length === 0 ? (
                <p className="text-ink-subtle">Unit ini belum punya isi.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {selected.items.map((item, index) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-control border-2 border-hairline bg-surface p-2.5">
                      <span className="tnum w-6 text-center font-display font-extrabold text-ink-subtle">{index + 1}</span>
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[12px]", item.kind === "grammar" ? "bg-primary-soft text-primary-deep" : "bg-mango-soft text-mango-ink")}>
                        {item.kind === "grammar" ? <BookOpen className="size-5" aria-hidden /> : <SpellCheck className="size-5" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{item.title}</span>
                        <span className="text-[0.75rem] text-ink-subtle">
                          {item.kind === "grammar" ? `Materi grammar · ${item.refSlug ?? "—"}` : `Paket kosakata · ${item.vocabCount ?? 0} kata`}
                        </span>
                      </span>
                      <MoveButtons
                        action={moveUnitItemAction}
                        hidden={{ unitId: selected.id, itemId: item.id }}
                        label={item.title}
                        first={index === 0}
                        last={index === selected.items.length - 1}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
