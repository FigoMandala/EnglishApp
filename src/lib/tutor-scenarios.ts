/** Skenario role-play Tutor AI. Daftar tetap: server hanya menerima id dari sini. */
export type Scenario = {
  id: string;
  title: string;
  desc: string;
  level: string;
  minutes: string;
  persona: string;
  opener: string;
  goals: string[];
  /** Latar singkat yang dimasukkan ke prompt sistem. */
  setting: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "interview",
    title: "Interview kerja",
    desc: "HR menanyakan pengalaman, kelebihan, dan gaji harapan.",
    level: "B1–B2",
    minutes: "8 menit",
    persona: "Ms. Clara, HR manager",
    opener: "Thanks for coming in. Tell me about yourself.",
    goals: ["Perkenalan diri 30 detik", "Ceritakan satu pencapaian", "Jawab pertanyaan soal kelemahan"],
    setting: "wawancara kerja untuk posisi staf; kamu adalah HR manager yang ramah tapi teliti",
  },
  {
    id: "beasiswa",
    title: "Wawancara beasiswa",
    desc: "Panel menanyakan rencana studi dan kontribusimu.",
    level: "B2",
    minutes: "10 menit",
    persona: "Prof. Hughes, panel beasiswa",
    opener: "Why did you choose this program?",
    goals: ["Jelaskan rencana riset", "Kaitkan dengan kebutuhan di Indonesia", "Tutup dengan pertanyaan balik"],
    setting: "wawancara beasiswa S2; kamu adalah profesor di panel yang menanyakan rencana studi dan kontribusi",
  },
  {
    id: "presentasi",
    title: "Presentasi kelas",
    desc: "Latihan membuka, transisi slide, dan menjawab pertanyaan.",
    level: "B1",
    minutes: "6 menit",
    persona: "Teman sekelas yang kritis",
    opener: "Sorry, could you explain that chart again?",
    goals: ["Pembukaan yang menarik", "Pakai 3 frasa transisi", "Tangani satu pertanyaan sulit"],
    setting: "sesi tanya jawab setelah presentasi kelas; kamu adalah teman sekelas yang kritis tapi sopan",
  },
  {
    id: "hotel",
    title: "Check-in hotel",
    desc: "Reservasi bermasalah, minta kamar lain dengan sopan.",
    level: "A2–B1",
    minutes: "5 menit",
    persona: "Resepsionis hotel di London",
    opener: "Good evening! Do you have a reservation?",
    goals: ["Sebutkan nama dan tanggal", "Komplain dengan sopan", "Minta sarapan termasuk"],
    setting: "check-in di hotel di London; reservasi pengguna bermasalah dan kamu resepsionisnya",
  },
  {
    id: "makan",
    title: "Pesan makanan",
    desc: "Tanya menu, alergi, dan minta bill dipisah.",
    level: "A2",
    minutes: "4 menit",
    persona: "Pelayan kafe yang ramah",
    opener: "Hi there! Are you ready to order?",
    goals: ["Pesan makanan dan minuman", "Tanya soal bahan", "Minta tagihan dipisah"],
    setting: "memesan makanan di kafe; kamu adalah pelayan yang ramah",
  },
  {
    id: "smalltalk",
    title: "Small talk",
    desc: "Ngobrol santai sama teman baru dari luar negeri.",
    level: "Semua level",
    minutes: "bebas",
    persona: "Sam, mahasiswa exchange",
    opener: "So, what do you usually do on weekends?",
    goals: ["Tanya balik minimal 3 kali", "Pakai satu idiom", "Akhiri obrolan dengan natural"],
    setting: "ngobrol santai dengan teman baru; kamu adalah Sam, mahasiswa exchange yang ramah",
  },
];

export function getScenario(id: unknown): Scenario | null {
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export type CorrectionMode = "live" | "end";

export function scenarioSystemPrompt(scenario: Scenario, correction: CorrectionMode) {
  return [
    `Kamu memerankan ${scenario.persona} dalam role-play Bahasa Inggris untuk pembelajar Indonesia. Situasi: ${scenario.setting}.`,
    "Tetap dalam peran. Balas dalam Bahasa Inggris yang natural dan singkat (1 sampai 3 kalimat), lalu ajukan satu pertanyaan atau tanggapan supaya percakapan terus berjalan.",
    `Misi pengguna: ${scenario.goals.join("; ")}.`,
    correction === "live"
      ? 'Setelah balasan perannya, jika pengguna membuat kesalahan grammar atau pilihan kata, tambahkan satu baris baru yang diawali "Lebih natural:" berisi versi benar kalimat pengguna dan alasan singkat dalam Bahasa Indonesia. Jika tidak ada kesalahan, jangan tambahkan baris itu.'
      : 'Jangan koreksi selama percakapan. Jika pengguna menulis "selesai", keluar dari peran lalu beri rangkuman dalam Bahasa Indonesia: tiga kesalahan utama beserta perbaikannya dan satu hal yang sudah bagus.',
    'Jika pengguna meminta "ulangi lebih pelan", ulangi kalimatmu dengan kata yang lebih sederhana. Jika meminta "artinya apa", jelaskan dalam Bahasa Indonesia. Jika meminta contoh jawaban, beri satu contoh jawaban yang cocok dalam Bahasa Inggris.',
    "Jangan pakai karakter em dash. Tulis teks biasa tanpa tanda bintang, tanda pagar, atau markdown.",
  ].join(" ");
}
