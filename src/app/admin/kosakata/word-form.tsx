"use client";

import { useActionState } from "react";

import { Lori } from "@/components/mascot";
import { SpeakButton } from "@/components/speak-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/field";
import type { Vocabulary } from "@/db/schema";
import { cn } from "@/lib/utils";

import { saveWordAction, type FormState } from "../actions";

const CEFRS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function WordForm({
  word,
  tab,
  leech,
}: {
  word: Vocabulary | null;
  tab: string;
  /** Diisi kalau kata ini leech: berapa pelajar nyangkut, dan ambangnya. */
  leech: { learners: number; lapses: number; minLearners: number } | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWordAction, {});

  // Kalau simpan gagal, isi form diambil dari kiriman terakhir, bukan dari database.
  const value = (name: keyof Vocabulary) => {
    const sent = state.values?.[name];
    if (sent !== undefined) return sent;
    const stored = word?.[name];
    return stored === null || stored === undefined ? "" : String(stored);
  };

  return (
    <Card className="flex flex-col gap-4 p-5 xl:sticky xl:top-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold">{word ? `Edit · ${word.word}` : "Kata baru"}</h2>
        {word ? <SpeakButton text={word.word} label={`Dengar ${word.word}`} /> : null}
      </div>

      {leech ? (
        <div className="flex items-center gap-3 rounded-control border-2 border-brick/30 bg-brick-soft p-3 text-[0.8125rem] text-brick-deep">
          <Lori mood="sad" size={56} />
          <p>
            <strong>Kata leech:</strong> {leech.learners} pelajar sudah lupa {leech.lapses}× atau lebih (ditandai mulai {leech.minLearners} pelajar). Tambahkan jembatan keledai dan contoh yang dekat dengan keseharian.
          </p>
        </div>
      ) : null}

      <form key={state.nonce ?? "awal"} action={action} className="grid grid-cols-2 gap-3" aria-describedby={state.error ? "field-error" : undefined}>
        <input type="hidden" name="id" value={word?.id ?? ""} />
        <input type="hidden" name="tab" value={tab} />
        <Field label="Kata" name="word" defaultValue={value("word")} required />
        <Field label="Fonetik" name="phonetic" defaultValue={value("phonetic")} placeholder="/…/" />
        <Field label="Kelas kata" name="partOfSpeech" defaultValue={value("partOfSpeech")} placeholder="verb, noun…" />
        <Field label="Arti" name="meaning" defaultValue={value("meaning")} required />
        <Field label="Contoh (EN)" name="exampleEn" defaultValue={value("exampleEn")} wide />
        <Field label="Terjemahan contoh (ID)" name="exampleId" defaultValue={value("exampleId")} wide />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-level">Level</Label>
          <select id="f-level" name="level" defaultValue={value("level") || "intermediate"} className="h-11 rounded-control border-2 border-hairline bg-surface px-3 font-bold">
            <option value="basic">basic</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-cefr">CEFR</Label>
          <select id="f-cefr" name="cefr" defaultValue={value("cefr")} className="h-11 rounded-control border-2 border-hairline bg-surface px-3 font-bold">
            <option value="">—</option>
            {CEFRS.map((cefr) => (
              <option key={cefr} value={cefr}>{cefr}</option>
            ))}
          </select>
        </div>
        <Field label="Topik" name="topic" defaultValue={value("topic")} />
        <Field label="Peringkat frekuensi" name="frequencyRank" defaultValue={value("frequencyRank")} inputMode="numeric" />
        <Field
          label="Jembatan keledai Lori"
          name="mnemonic"
          defaultValue={value("mnemonic")}
          placeholder="Trik singkat biar gampang diingat"
          hint="Tampil di balik kartu saat pelajar mengulang."
          wide
        />

        <div className="col-span-2 grid grid-cols-2 gap-2 border-t-2 border-dashed border-hairline pt-3" aria-label="Pratinjau kartu">
          <div className="flex min-h-24 items-center justify-center rounded-control border-2 border-hairline bg-surface font-display text-xl font-extrabold">
            {word?.word ?? "kata"}
          </div>
          <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-control border-2 border-primary/30 bg-primary-soft p-2 text-center">
            <strong className="text-primary-deep">{word?.meaning ?? "arti"}</strong>
            {word?.mnemonic ? <span className="text-[0.75rem] text-mango-ink">{word.mnemonic}</span> : null}
          </div>
        </div>

        <div className="col-span-2">
          <FieldError>{state.error}</FieldError>
        </div>
        <button type="submit" disabled={pending} className={buttonVariants({ className: "col-span-2" })}>
          {pending ? "Menyimpan…" : word ? "Simpan perubahan" : "Tambah kata"}
        </button>
      </form>
    </Card>
  );
}

function Field({
  label,
  name,
  wide,
  hint,
  ...rest
}: { label: string; name: string; wide?: boolean; hint?: string } & React.ComponentProps<"input">) {
  const id = `f-${name}`;
  return (
    <div className={cn("flex flex-col gap-1.5", wide && "col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} className="h-11 text-[0.9375rem]" aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      {hint ? <p id={`${id}-hint`} className="text-[0.75rem] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
