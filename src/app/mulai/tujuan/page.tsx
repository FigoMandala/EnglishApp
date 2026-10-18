"use client";

import { BookOpen, Briefcase, Check, FileText, GraduationCap, MapPin, MessageCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { GOAL_IDS, loadOnboarding, saveOnboarding, type GoalId } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { CHOICE, OnboardingStep } from "../step-layout";

const GOALS: Record<GoalId, { label: string; sub: string; Icon: LucideIcon; tone: string; t: string; b: string }> = {
  eprt: { label: "Lulus EPrT kampus", sub: "Syarat sidang, wisuda, atau beasiswa", Icon: GraduationCap, tone: "bg-mango-soft text-mango-ink", t: "EPrT? Pas banget.", b: "Kaka bakal jadi pelatih ujianmu. Dia agak galak soal waktu, tapi jago Structure." },
  toefl: { label: "TOEFL ITP / IELTS", sub: "Daftar S2 atau program exchange", Icon: FileText, tone: "bg-sky-soft text-sky-deep", t: "Siap, mode akademik.", b: "Kita banyak main di reading panjang dan grammar formal. Pelan-pelan, ya." },
  kerja: { label: "Interview & kerja", sub: "Email, meeting, presentasi", Icon: Briefcase, tone: "bg-primary-soft text-primary-deep", t: "Biar pede di kantor.", b: "Aku siapin latihan jawab interview dan nulis email yang sopan tapi nggak kaku." },
  kuliah: { label: "Baca jurnal & kuliah", sub: "Paham teks dan istilah akademik", Icon: BookOpen, tone: "bg-[#f1e8f7] text-[#5d2e86]", t: "Jurnal nggak serem lagi.", b: "Kita bongkar kalimat panjang jadi potongan kecil yang gampang dicerna." },
  ngobrol: { label: "Ngobrol lancar", sub: "Berani ngomong tanpa mikir lama", Icon: MessageCircle, tone: "bg-brick-soft text-brick-deep", t: "Ayo ngobrol!", b: "Tutor AI siap diajak ngomong kapan aja. Salah dikit nggak apa-apa." },
  jalan: { label: "Jalan-jalan", sub: "Bandara, hotel, pesan makanan", Icon: MapPin, tone: "bg-[#e5f3f3] text-[#165e5e]", t: "Koper siap?", b: "Frasa yang langsung kepake di perjalanan, lengkap sama cara ngucapinnya." },
};

export default function TujuanPage() {
  const [picked, setPicked] = useState<GoalId | null>(null);
  useEffect(() => setPicked(loadOnboarding().goal), []);
  const cur = picked ? GOALS[picked] : null;

  return (
    <OnboardingStep
      step={1}
      backHref="/"
      closeInstead
      mood={picked ? "cheer" : "wave"}
      hop={Boolean(picked)}
      bubble={{
        title: cur ? cur.t : "Halo! Mau belajar buat apa?",
        body: cur ? cur.b : "Pilih satu tujuan utama dulu. Nanti bisa diganti kapan saja di Profil.",
      }}
      canNext={Boolean(picked)}
      nextHref="/mulai/level"
      skipHref="/mulai/level"
      skipLabel="Lewati, putuskan nanti"
    >
      <div className="rise">
        <h1 className="font-display text-[2.25rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem]">Kamu belajar buat apa?</h1>
        <p className="mt-2.5 text-[1.125rem] text-ink-subtle">Pilih tujuan utama. Jalur, contoh kalimat, dan latihanmu akan disesuaikan.</p>
      </div>
      <div role="group" aria-label="Tujuan belajar" className="grid gap-4 sm:grid-cols-2">
        {GOAL_IDS.map((id, i) => {
          const g = GOALS[id];
          const sel = id === picked;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={sel}
              onClick={() => {
                setPicked(id);
                saveOnboarding({ goal: id });
              }}
              className={cn(
                CHOICE,
                "min-h-24",
                sel ? "border-primary bg-[#eaf5ee] shadow-[0_4px_0_var(--color-primary)]" : "border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)]",
              )}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className={cn("grid size-14 shrink-0 place-items-center rounded-[16px]", g.tone)}>
                <g.Icon className="size-7" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.25rem] font-extrabold">{g.label}</span>
                <span className="mt-0.5 block text-[0.9375rem] text-ink-subtle">{g.sub}</span>
              </span>
              <span
                aria-hidden
                className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-white", sel ? "border-primary bg-primary" : "border-hairline bg-surface")}
              >
                {sel ? <Check className="size-4" strokeWidth={3.4} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </OnboardingStep>
  );
}
