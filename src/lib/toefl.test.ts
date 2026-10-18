import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectAnswers,
  correctCount,
  dialogueKey,
  estimateScore,
  stripQuestionNumber,
  isComplete,
  isSkill,
  longestAnswerGiveaway,
  parseAnswers,
  parseQuestions,
  renumber,
  scaledScore,
  SKILLS,
  skillStats,
  underlineSpans,
  type ToeflAnswer,
  type ToeflQuestion,
} from "./toefl";

const answers = (skill: keyof typeof SKILLS, correct: number, wrong: number): ToeflAnswer[] => [
  ...Array.from({ length: correct }, () => ({
    skill,
    section: SKILLS[skill].section,
    correct: true,
  })),
  ...Array.from({ length: wrong }, () => ({
    skill,
    section: SKILLS[skill].section,
    correct: false,
  })),
];

describe("scaledScore", () => {
  it("follows conversion anchors and interpolates between them", () => {
    assert.equal(scaledScore("structure", 0), 31);
    assert.equal(scaledScore("structure", 0.5), 44);
    assert.equal(scaledScore("structure", 1), 68);
    assert.equal(scaledScore("reading", 0.6), 48);
  });
});

describe("estimateScore", () => {
  it("needs enough answers per section", () => {
    assert.equal(estimateScore(answers("sv", 10, 10)), null);
  });

  it("assumes listening from the other two sections when missing", () => {
    assert.deepEqual(estimateScore([...answers("sv", 10, 10), ...answers("detail", 6, 4)]), {
      total: 460,
      structure: 44,
      reading: 48,
      listening: null,
      estimated: true,
    });
  });

  it("uses listening data once available", () => {
    const estimate = estimateScore([
      ...answers("sv", 10, 10),
      ...answers("detail", 6, 4),
      ...answers("listen-short", 6, 4),
    ]);
    assert.equal(estimate?.total, 477);
    assert.equal(estimate?.estimated, false);
    assert.equal(estimate?.listening !== null, true);
  });
});

describe("parseQuestions", () => {
  it("keeps valid questions and drops malformed ones", () => {
    const raw = JSON.stringify([
      { type: "structure", skill: "clause", q: "It ___ now.", options: ["is", "are"], answer: 0 },
      { q: "rusak", options: ["a"], answer: 5 },
      { q: "", options: ["a", "b"], answer: 0 },
    ]);
    const questions = parseQuestions(raw);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].skill, "clause");
  });

  it("returns empty for invalid json and null", () => {
    assert.deepEqual(parseQuestions("{rusak"), []);
    assert.deepEqual(parseQuestions(null), []);
  });
});

describe("parseAnswers", () => {
  it("pads missing answers with null", () => {
    assert.deepEqual(parseAnswers("[1]", 3), [1, null, null]);
    assert.deepEqual(parseAnswers("rusak", 2), [null, null]);
    assert.deepEqual(parseAnswers(null, 2), [null, null]);
  });
});

describe("correctCount and isComplete", () => {
  const questions = parseQuestions(
    JSON.stringify([
      { type: "structure", q: "a", options: ["x", "y"], answer: 0 },
      { type: "structure", q: "b", options: ["x", "y"], answer: 1 },
    ]),
  );

  it("counts matches and detects completion", () => {
    assert.equal(correctCount(questions, [0, 1]), 2);
    assert.equal(correctCount(questions, [1, 0]), 0);
    assert.equal(isComplete([0, 1]), true);
    assert.equal(isComplete([0, null]), false);
    assert.equal(isComplete([]), false);
  });
});

describe("collectAnswers and skillStats", () => {
  it("skips reviews and unanswered questions", () => {
    const questions = parseQuestions(
      JSON.stringify([
        { type: "structure", skill: "clause", q: "a", options: ["x", "y"], answer: 0 },
        { type: "structure", skill: "clause", q: "b", options: ["x", "y"], answer: 1 },
      ]),
    );
    const collected = collectAnswers([
      { section: "drill", questions, answers: [0, 1] },
      { section: "review", questions, answers: [0, 1] },
      { section: "drill", questions, answers: [1, null] },
    ]);
    assert.equal(collected.length, 3);
    assert.equal(collected.filter((answer) => answer.correct).length, 2);

    const stats = skillStats(collected).find((stat) => stat.skill === "clause");
    assert.equal(stats?.answered, 3);
    assert.equal(stats?.pct, 67);
  });
});

describe("underlineSpans", () => {
  it("finds each part in order on word boundaries", () => {
    const sentence = "The birds within the region fly in winter.";
    const spans = underlineSpans(sentence, ["The", "in", "winter"]);
    assert.deepEqual(
      spans?.map(([start, end]) => sentence.slice(start, end)),
      ["The", "in", "winter"],
    );
  });

  it("rejects missing or out-of-order parts", () => {
    assert.equal(underlineSpans("Birds fly south.", ["fly", "Birds"]), null);
    assert.equal(underlineSpans("Birds fly south.", ["north"]), null);
  });
});

describe("listening skills", () => {
  it("registers the long dialogue and lecture skills under listening", () => {
    assert.equal(SKILLS["listen-long"].section, "listening");
    assert.equal(SKILLS["listen-lecture"].section, "listening");
    assert.equal(SKILLS["listen-short"].section, "listening");
  });

  it("recognizes the new skills and rejects unknown ones", () => {
    assert.equal(isSkill("listen-long"), true);
    assert.equal(isSkill("listen-lecture"), true);
    assert.equal(isSkill("listen-nope"), false);
  });

  it("keeps narrator and speaker audio lines with the new speaker types", () => {
    const questions = parseQuestions(
      JSON.stringify([
        {
          type: "listening",
          skill: "listen-lecture",
          q: "What is the main idea?",
          options: ["a", "b", "c", "d"],
          answer: 0,
          audio: [
            { speaker: "narrator", text: "Questions 39-42 are based on a lecture." },
            { speaker: "speaker", text: "Welcome to the investment club." },
          ],
        },
      ]),
    );
    assert.equal(questions.length, 1);
    assert.deepEqual(
      questions[0].audio?.map((line) => line.speaker),
      ["narrator", "speaker"],
    );
  });
});

describe("dialogueKey", () => {
  it("mengabaikan baris narator", () => {
    const a = { audio: [{ speaker: "narrator", text: "Question 1" }, { speaker: "man", text: "Hi" }] };
    const b = { audio: [{ speaker: "narrator", text: "Questions 7-9" }, { speaker: "man", text: "Hi" }] };
    assert.equal(dialogueKey(a as ToeflQuestion), dialogueKey(b as ToeflQuestion));
  });
});

describe("renumber", () => {
  const short = (text: string, narrator?: string): ToeflQuestion => ({
    type: "listening",
    skill: "listen-short",
    q: `Q ${text}`,
    options: ["a", "b", "c", "d"],
    answer: 0,
    explain_id: "",
    audio: [
      ...(narrator ? [{ speaker: "narrator" as const, text: narrator }] : []),
      { speaker: "man", text },
      { speaker: "woman", text: "response" },
    ],
  });

  it("memberi nomor dari posisi tampil, bukan nomor lama di transkrip", () => {
    const result = renumber([short("line one", "Question 18"), short("line two", "Question 9")], 1);
    assert.deepEqual(
      result.map((question) => question.audio?.[0]),
      [
        { speaker: "narrator", text: "Question 1" },
        { speaker: "narrator", text: "Question 2" },
      ],
    );
  });

  it("membuang narator lama, hanya satu narator baru di awal", () => {
    const [first] = renumber([short("line one", "Questions 31-33")], 31);
    assert.equal(first.audio?.filter((line) => line.speaker === "narrator").length, 1);
    assert.equal(first.audio?.[0].text, "Question 31");
  });

  it("memakai satu rentang nomor untuk soal yang berbagi dialog", () => {
    const shared = [
      "man: Did you register",
      "woman: Not yet",
    ];
    const lecture = (q: string, narrator: string): ToeflQuestion => ({
      type: "listening",
      skill: "listen-long",
      q,
      options: ["a", "b", "c", "d"],
      answer: 0,
      explain_id: "",
      audio: [
        { speaker: "narrator", text: narrator },
        { speaker: "man", text: shared[0].slice(4) },
        { speaker: "woman", text: shared[1].slice(7) },
      ],
    });
    const result = renumber([lecture("Q1", "Questions 5-6"), lecture("Q2", "Questions 20-21")], 31);
    assert.deepEqual(
      result.map((question) => question.audio?.[0].text),
      ["Questions 31-32", "Questions 31-32"],
    );
  });

  it("membiarkan soal tanpa audio apa adanya", () => {
    const structure: ToeflQuestion = {
      type: "structure",
      skill: "clause",
      q: "It ___ now.",
      options: ["is", "are", "were", "be"],
      answer: 0,
      explain_id: "",
    };
    const [result] = renumber([structure], 1);
    assert.equal(result.audio, undefined);
  });
});

describe("stripQuestionNumber", () => {
  it("membuang nomor bawaan AI di awal pertanyaan", () => {
    assert.equal(stripQuestionNumber("Number 6. Why did the man talk to the professor?"), "Why did the man talk to the professor?");
    assert.equal(stripQuestionNumber("Question 3: What does the woman mean?"), "What does the woman mean?");
    assert.equal(stripQuestionNumber("12. Where does the conversation take place?"), "Where does the conversation take place?");
  });

  it("tidak mengubah kalimat yang memang diawali angka", () => {
    assert.equal(stripQuestionNumber("1,000 people ___ the city."), "1,000 people ___ the city.");
    assert.equal(stripQuestionNumber("1990 was the year ___."), "1990 was the year ___.");
  });
});

describe("longestAnswerGiveaway", () => {
  it("menandai jawaban benar yang jauh lebih panjang, bukan yang sebanding", () => {
    assert.equal(longestAnswerGiveaway(["To ask about his lab partner for the class.", "To pay", "To leave", "To book"], 0), true);
    assert.equal(longestAnswerGiveaway(["To ask about a lab", "To pay a fee late", "To leave a note", "To book a room"], 0), false);
    assert.equal(longestAnswerGiveaway(["Yes", "No", "Maybe", "Never"], 3), false);
  });
});
