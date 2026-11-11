import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { requireAdmin } from "@/lib/session";

import { generateWordsAction, saveAiConfigAction } from "../actions";
import { Notice, param, type AdminSearchParams } from "../notice";
import { BankForm } from "./bank-form";
import { SubmitButton } from "./submit-button";

export const dynamic = "force-dynamic";
// Generate soal memanggil AI beberapa kali; tanpa ini fungsi Vercel mati di 10-60 dtk.
export const maxDuration = 300;

const SELECT = "h-11 rounded-control border-2 border-hairline bg-surface px-3 font-bold";

function Field({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11 text-[0.9375rem]" {...rest} />
      {hint ? <p className="text-[0.75rem] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

export default async function AdminGeneratePage({ searchParams }: { searchParams: AdminSearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const config = await getAiConfig();
  const ready = aiConfigured(config);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Mode admin"
        title="Generate Konten"
        description="Isi kosakata dan bank soal EPrT dengan AI. Hasil langsung masuk database; cek dan koreksi di Kosakata / Bank Soal."
      />
      <Notice pesan={param(params, "pesan")} galat={param(params, "galat")} />

      <Card className="flex flex-col gap-4 p-5">
        <h2 className="font-display text-xl font-extrabold">Pengaturan AI</h2>
        <p className="text-[0.875rem] text-ink-subtle">
          Status: {ready ? "key terpasang" : "belum ada key"}. Kolom kosong = pertahankan nilai sekarang. Penyedia harus kompatibel OpenAI (/chat/completions).
        </p>
        <form action={saveAiConfigAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Base URL" name="baseUrl" defaultValue={config.baseUrl} />
          <Field label="Model" name="model" defaultValue={config.model} />
          <Field label="Model pemeriksa soal (opsional)" name="verifyModel" defaultValue={config.verifyModel} placeholder="kosong = sama dengan Model" hint="Pakai model berbeda dari pembuat soal supaya kesalahan yang konsisten tertangkap." />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reasoningEffort">Mode berpikir (reasoning)</Label>
            <select id="reasoningEffort" name="reasoningEffort" defaultValue={config.reasoningEffort} className={SELECT}>
              <option value="">Mati</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-[0.75rem] text-ink-subtle">Lebih teliti tapi lebih lambat dan mahal. Hanya untuk model penalar; model lain bisa menolak.</p>
          </div>
          <Field label="API key" name="apiKey" type="password" autoComplete="off" placeholder={ready ? "•••• (tersimpan)" : "sk-…"} />
          <button type="submit" className={buttonVariants({ variant: "secondary", className: "sm:col-span-2" })}>
            Simpan pengaturan AI
          </button>
        </form>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl font-extrabold">Kosakata</h2>
          <p className="text-[0.875rem] text-ink-subtle">
            Isi daftar kata (satu per baris) untuk dilengkapi arti dan contoh, atau kosongkan dan pilih topik supaya AI memilih kata baru. Fonetik diambil dari kamus terbuka (dictionaryapi.dev). Kata yang sudah ada dilewati.
          </p>
          <form action={generateWordsAction} className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="words">Daftar kata (opsional, maks 30)</Label>
              <Textarea id="words" name="words" rows={4} placeholder={"resilient\nmitigate\nconsequently"} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Topik" name="topic" placeholder="akademik" />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="level">Level</Label>
                <select id="level" name="level" defaultValue="intermediate" className={SELECT}>
                  <option value="basic">basic</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                </select>
              </div>
              <Field label="Jumlah" name="count" type="number" min={1} max={30} defaultValue={10} />
            </div>
            <SubmitButton disabled={!ready} waiting="Membuat kosakata…">Generate kosakata</SubmitButton>
          </form>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl font-extrabold">Soal EPrT</h2>
          <p className="text-[0.875rem] text-ink-subtle">
            Tiap batch membuat 6 soal (Structure, Written, Short Dialogue), 1 teks + 12 soal (Reading), atau 2 naskah ≈ 10 soal (Long Dialogue, Lecture). Progres tampil per batch. Setiap soal dijawab ulang oleh AI; yang jawabannya beda dengan kunci dibuang. Pilih Semua untuk membuat ketiga jenis sekaligus (jumlah batch berlaku per jenis). Bisa memakan 1-3 menit.
          </p>
          <BankForm ready={ready} />
        </Card>
      </div>
    </div>
  );
}
