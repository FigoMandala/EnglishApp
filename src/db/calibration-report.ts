import "./load-env";

import { listQuestionStats } from "./queries/question-bank";
import { EXPECTED_ACCURACY, MIN_ATTEMPTS, summarize } from "@/lib/calibration";

const LABEL = {
  thin: "data kurang",
  "on-target": "sesuai",
  "too-easy": "terlalu mudah",
  "too-hard": "terlalu sulit",
} as const;

async function main() {
  const rows = await listQuestionStats("eptr");
  if (!rows.length) {
    console.log("Belum ada data jawaban.");
    return;
  }
  const answered = rows.reduce((sum, row) => sum + row.attempts, 0);
  console.log(`Soal tercatat: ${rows.length}, total jawaban: ${answered} (soal dinilai mulai ${MIN_ATTEMPTS} jawaban)\n`);
  console.table(
    summarize(rows).map((group) => ({
      jenis: group.kind,
      level: group.band,
      soal: group.questions,
      jawaban: group.attempts,
      "% benar": group.accuracy === null ? "-" : `${Math.round(group.accuracy * 100)}%`,
      target: `${EXPECTED_ACCURACY[group.band][0] * 100}-${EXPECTED_ACCURACY[group.band][1] * 100}%`,
      status: LABEL[group.status],
      "kunci bermasalah": group.faulty,
      "terlalu mudah": group.tooEasy,
    })),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
