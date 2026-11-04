"use client";

import { Dices } from "lucide-react";
import { useState } from "react";

import {
  DrillFooter,
  DrillHeader,
  DrillMain,
  DrillPage,
  SecondaryButton,
} from "@/components/drill/parts";
import { SPEAKING_PROMPTS, type SpeakingPrompt } from "@/lib/speaking-prompts";
import { averageBest, triedTopicCount, type SpeakingBest } from "@/lib/speaking-scores";
import { PROMPT_LEVEL_LABEL } from "@/lib/writing-prompts";

import { SpeakingDrill, type SpeakingItem } from "./speaking-drill";
import { SpeakingTopicPicker } from "./topic-picker";

/** Ubah kalimat model jadi item drill; id sintetis supaya tidak bentrok dengan id kosakata. */
function promptItems(prompt: SpeakingPrompt): SpeakingItem[] {
  return prompt.sentences.map((sentence, index) => ({
    id: 100_000 + index,
    sentence: sentence.en,
    translation: sentence.id,
    focus: sentence.focus,
    phonetic: null,
  }));
}

export function SpeakingSession({
  vocab,
  topics = SPEAKING_PROMPTS,
  best = {},
  initialTopicId,
}: {
  vocab: SpeakingItem[];
  topics?: SpeakingPrompt[];
  /** Skor terbaik per topik, dari pengaturan pengguna. */
  best?: SpeakingBest;
  /** Topik dari tautan `/latihan/ucapkan?topic=…`, langsung dibuka. */
  initialTopicId?: string;
}) {
  const initial = initialTopicId ? (topics.find((topic) => topic.id === initialTopicId) ?? null) : null;
  const [items, setItems] = useState<SpeakingItem[] | null>(initial ? promptItems(initial) : null);
  const [topicId, setTopicId] = useState<string | undefined>(initial?.id);
  const [context, setContext] = useState<string | undefined>(
    initial ? `${PROMPT_LEVEL_LABEL[initial.level]} · ${initial.topic}` : undefined,
  );
  const [run, setRun] = useState(0);

  if (items) {
    return (
      <SpeakingDrill
        key={run}
        items={items}
        context={context}
        topicId={topicId}
        onRestart={() => setRun((value) => value + 1)}
      />
    );
  }

  const topicIds = topics.map((topic) => topic.id);
  const tried = triedTopicCount(best, topicIds);
  const avgBest = averageBest(best, topicIds);

  function start(prompt: SpeakingPrompt) {
    setContext(`${PROMPT_LEVEL_LABEL[prompt.level]} · ${prompt.topic}`);
    setTopicId(prompt.id);
    setItems(promptItems(prompt));
    setRun((value) => value + 1);
  }

  function startVocab() {
    setContext(undefined);
    setTopicId(undefined);
    setItems(vocab);
    setRun((value) => value + 1);
  }

  return (
    <DrillPage>
      <DrillHeader
        exitHref="/latihan"
        value={0}
        max={1}
        trailing={<span className="shrink-0 text-[0.875rem] font-extrabold text-ink-muted">Pilih topik</span>}
      />
      <DrillMain className="flex flex-col items-center gap-6">
        <div className="rise flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-display text-[1.875rem] font-black tracking-[-0.02em] sm:text-[2.125rem]">
            Mau latihan ngomong apa?
          </h1>
          <p className="max-w-[520px] text-[0.9375rem] text-ink-subtle">
            Pilih topik, lalu ucapkan 5 kalimat modelnya. Lori menandai kata yang belum terdengar jelas.
          </p>
          {tried > 0 ? (
            <p className="text-[0.8125rem] font-extrabold text-ink-muted">
              {tried}/{topics.length} topik sudah dicoba
              {avgBest !== null ? ` · rata-rata terbaik ${avgBest}` : ""}
            </p>
          ) : null}
        </div>

        <div className="rise w-full [--i:1]">
          <SpeakingTopicPicker topics={topics} best={best} onPick={start} />
        </div>
      </DrillMain>
      <DrillFooter>
        <p className="text-[0.875rem] text-ink-subtle">Belum siap memilih? Latihan singkat dengan kalimat acak tetap jalan.</p>
        <SecondaryButton onClick={startVocab} disabled={vocab.length === 0}>
          <Dices className="size-4" aria-hidden />
          KALIMAT ACAK
        </SecondaryButton>
      </DrillFooter>
    </DrillPage>
  );
}
