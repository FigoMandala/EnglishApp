export type PromptLevel = "basic" | "intermediate" | "advanced";
export type PromptKind = "opinion" | "preference" | "problem" | "describe" | "compare";

export type WritingPrompt = {
  id: string;
  level: PromptLevel;
  kind: PromptKind;
  /** Label topik singkat dalam bahasa Indonesia. */
  topic: string;
  /** Instruksi esai dalam bahasa Inggris, seperti di lembar ujian. */
  title: string;
  /** Poin pemandu dalam bahasa Indonesia; bukan jawaban. */
  hints: string[];
  /** Target panjang esai dalam kata. */
  minWords: number;
};

export const PROMPT_LEVELS: PromptLevel[] = ["basic", "intermediate", "advanced"];

export const PROMPT_LEVEL_LABEL: Record<PromptLevel, string> = {
  basic: "Dasar",
  intermediate: "Menengah",
  advanced: "Lanjut",
};

export const PROMPT_KIND_LABEL: Record<PromptKind, string> = {
  opinion: "Opini",
  preference: "Pilihan",
  problem: "Solusi",
  describe: "Deskripsi",
  compare: "Perbandingan",
};

export const PROMPT_KIND_HINT: Record<PromptKind, string> = {
  opinion: "Nyatakan sikapmu, lalu beri dua alasan.",
  preference: "Bandingkan dua opsi sebelum memilih.",
  problem: "Jelaskan masalahnya, lalu tawarkan solusi.",
  describe: "Pakai detail konkret: siapa, di mana, seperti apa.",
  compare: "Bahas sisi baik dan buruk keduanya.",
};

export const WRITING_PROMPTS: WritingPrompt[] = [
  // Dasar — topik pribadi dan sehari-hari.
  {
    id: "hometown",
    level: "basic",
    kind: "describe",
    topic: "Kota asal",
    title: "Describe your hometown and explain what makes it a special place to grow up.",
    hints: [
      "Sebutkan letak dan ciri khas kotamu di paragraf pertama.",
      "Beri dua contoh konkret: makanan, tradisi, atau tempat favorit.",
      "Tutup dengan perasaanmu tentang kota itu sekarang.",
    ],
    minWords: 120,
  },
  {
    id: "weekday-routine",
    level: "basic",
    kind: "describe",
    topic: "Rutinitas harian",
    title: "Describe a typical weekday in your life and one change you would like to make.",
    hints: [
      "Urutkan kegiatan pagi, siang, dan malam dengan kata penghubung waktu.",
      "Sebutkan satu kebiasaan yang ingin kamu ubah dan alasannya.",
      "Gunakan simple present tense sepanjang esai.",
    ],
    minWords: 120,
  },
  {
    id: "regional-food",
    level: "basic",
    kind: "describe",
    topic: "Makanan daerah",
    title: "What is your favorite food from your region, and why would you recommend it to a visitor?",
    hints: [
      "Jelaskan bahan dan cara makannya, bukan hanya rasanya.",
      "Ceritakan kapan biasanya makanan itu disajikan.",
      "Ajak pembaca mencobanya di kalimat penutup.",
    ],
    minWords: 120,
  },
  {
    id: "study-place",
    level: "basic",
    kind: "preference",
    topic: "Tempat belajar",
    title: "Do you prefer studying at home or in a library? Explain your choice.",
    hints: [
      "Pilih satu, jangan dua-duanya.",
      "Bandingkan suasana, gangguan, dan fasilitasnya.",
      "Tambahkan contoh dari pengalamanmu sendiri.",
    ],
    minWords: 120,
  },
  {
    id: "phones-in-class",
    level: "basic",
    kind: "opinion",
    topic: "HP di kelas",
    title: "Should students be allowed to use mobile phones during class? Give your opinion.",
    hints: [
      "Tentukan posisimu di kalimat pertama.",
      "Satu alasan untuk manfaat, satu alasan untuk risikonya.",
      "Tawarkan aturan yang menurutmu paling masuk akal.",
    ],
    minWords: 140,
  },
  {
    id: "good-friend",
    level: "basic",
    kind: "describe",
    topic: "Sahabat",
    title: "What qualities make someone a good friend? Use examples from your own life.",
    hints: [
      "Pilih dua atau tiga sifat, jangan membuat daftar panjang.",
      "Untuk tiap sifat, beri satu cerita singkat.",
      "Simpulkan mengapa sifat itu penting bagimu.",
    ],
    minWords: 120,
  },
  {
    id: "exercise-habit",
    level: "basic",
    kind: "opinion",
    topic: "Olahraga",
    title: "Why is regular exercise important for students? Support your answer with examples.",
    hints: [
      "Hubungkan olahraga dengan konsentrasi dan suasana hati.",
      "Sebutkan jenis olahraga yang realistis untuk pelajar.",
      "Akhiri dengan ajakan kecil yang bisa langsung dilakukan.",
    ],
    minWords: 120,
  },
  {
    id: "online-vs-store",
    level: "basic",
    kind: "preference",
    topic: "Belanja",
    title: "Do you prefer shopping online or in a physical store? Explain why.",
    hints: [
      "Bahas harga, kenyamanan, dan kepastian barang.",
      "Sebutkan satu pengalaman belanja yang mendukung pilihanmu.",
      "Akui satu kelemahan pilihanmu supaya seimbang.",
    ],
    minWords: 120,
  },
  {
    id: "next-holiday",
    level: "basic",
    kind: "preference",
    topic: "Liburan",
    title: "Where would you like to spend your next holiday, and what would you do there?",
    hints: [
      "Sebut tempatnya dan alasan memilih tempat itu.",
      "Rincikan dua aktivitas yang akan kamu lakukan.",
      "Gunakan bentuk will atau would like to.",
    ],
    minWords: 120,
  },
  {
    id: "volunteer-work",
    level: "basic",
    kind: "opinion",
    topic: "Kerja sukarela",
    title: "Should high school students be required to do volunteer work? Give your opinion.",
    hints: [
      "Pikirkan manfaat untuk siswa dan untuk masyarakat.",
      "Jawab kemungkinan keberatan: waktu belajar jadi berkurang.",
      "Tutup dengan syarat supaya program itu berjalan adil.",
    ],
    minWords: 140,
  },

  // Menengah — isu sosial, teknologi, dan pendidikan.
  {
    id: "ai-homework",
    level: "intermediate",
    kind: "opinion",
    topic: "AI & sekolah",
    title: "Should students use AI tools to help with their homework? Give your opinion.",
    hints: [
      "Bedakan membantu memahami materi dengan menggantikan usaha sendiri.",
      "Bahas risiko: jawaban salah dan hilangnya kemampuan menulis.",
      "Usulkan batas pemakaian yang jelas untuk sekolah.",
    ],
    minWords: 180,
  },
  {
    id: "social-media-teens",
    level: "intermediate",
    kind: "opinion",
    topic: "Media sosial",
    title: "Is social media good for teenagers? Support your view with reasons and examples.",
    hints: [
      "Bahas manfaat koneksi dan risiko perbandingan sosial.",
      "Beri contoh nyata dari lingkungan sekitarmu.",
      "Simpulkan bahwa dampaknya bergantung pada cara pakai.",
    ],
    minWords: 180,
  },
  {
    id: "public-transport",
    level: "intermediate",
    kind: "problem",
    topic: "Transportasi umum",
    title: "How can your city improve public transport so more people leave their cars at home?",
    hints: [
      "Mulai dari masalah: kemacetan, waktu tunggu, atau keamanan.",
      "Tawarkan dua solusi yang bisa dijalankan pemerintah kota.",
      "Jelaskan cara mengukur keberhasilannya.",
    ],
    minWords: 200,
  },
  {
    id: "plastic-bags",
    level: "intermediate",
    kind: "opinion",
    topic: "Sampah plastik",
    title: "Should shops be banned from giving free plastic bags? Discuss both sides and give your view.",
    hints: [
      "Sebutkan dampak lingkungan dan beban bagi pedagang kecil.",
      "Bahas alternatif: kantong kain, tas berbayar, atau daur ulang.",
      "Pastikan pendapatmu muncul jelas di paragraf akhir.",
    ],
    minWords: 200,
  },
  {
    id: "work-or-university",
    level: "intermediate",
    kind: "compare",
    topic: "Kuliah vs kerja",
    title: "Is it better to start working right after school or to go to university first?",
    hints: [
      "Bandingkan penghasilan awal, pengalaman, dan peluang karier.",
      "Sebutkan satu kondisi ketika pilihan sebaliknya lebih masuk akal.",
      "Beri rekomendasi untuk siswa yang masih bingung.",
    ],
    minWords: 200,
  },
  {
    id: "free-university",
    level: "intermediate",
    kind: "opinion",
    topic: "Kuliah gratis",
    title: "Should university education be free for everyone? Explain your position.",
    hints: [
      "Pertimbangkan kualitas, akses, dan sumber pendanaan.",
      "Jawab pertanyaan: siapa yang akhirnya membayar?",
      "Tawarkan model beasiswa sebagai jalan tengah.",
    ],
    minWords: 200,
  },
  {
    id: "english-for-career",
    level: "intermediate",
    kind: "opinion",
    topic: "Bahasa Inggris",
    title: "Why is English important for your future career? Use specific examples from your field.",
    hints: [
      "Sebut pekerjaan atau jurusan yang kamu incar.",
      "Beri contoh situasi kerja yang butuh bahasa Inggris.",
      "Bahas juga caramu berlatih mulai sekarang.",
    ],
    minWords: 180,
  },
  {
    id: "free-museums",
    level: "intermediate",
    kind: "opinion",
    topic: "Museum",
    title: "Should museums and cultural sites be free for students? Give your opinion.",
    hints: [
      "Bahas manfaat edukasi versus biaya perawatan.",
      "Bandingkan dengan harga tiket hiburan lain.",
      "Usulkan skema diskon atau hari gratis tertentu.",
    ],
    minWords: 180,
  },
  {
    id: "remote-work",
    level: "intermediate",
    kind: "compare",
    topic: "Kerja jarak jauh",
    title: "Does remote work give employees more freedom or more loneliness? Discuss.",
    hints: [
      "Sebutkan kelebihan: waktu, biaya perjalanan, fleksibilitas.",
      "Sebutkan kerugian: batas kerja kabur, komunikasi tertunda.",
      "Tawarkan kebijakan hibrida sebagai kesimpulan.",
    ],
    minWords: 200,
  },
  {
    id: "food-delivery",
    level: "intermediate",
    kind: "opinion",
    topic: "Ojek makanan",
    title: "Are food delivery apps worth the extra cost? Support your answer.",
    hints: [
      "Hitung dari sisi waktu, uang, dan kesehatan.",
      "Pertimbangkan dampaknya bagi warung kecil.",
      "Beri batas pribadi kapan aplikasi itu layak dipakai.",
    ],
    minWords: 180,
  },

  // Lanjut — isu kebijakan dan abstrak ala EPrT.
  {
    id: "automation-jobs",
    level: "advanced",
    kind: "opinion",
    topic: "Otomasi kerja",
    title: "Automation will reshape the jobs of the next decade. Do the benefits outweigh the risks?",
    hints: [
      "Bedakan pekerjaan rutin dan pekerjaan yang butuh pertimbangan manusia.",
      "Bahas dampaknya bagi pekerja dengan keterampilan rendah.",
      "Ajukan peran pemerintah dan pelatihan ulang.",
    ],
    minWords: 250,
  },
  {
    id: "climate-responsibility",
    level: "advanced",
    kind: "compare",
    topic: "Perubahan iklim",
    title: "Who should take the lead in fighting climate change: individuals or governments?",
    hints: [
      "Bandingkan skala dampak kebijakan dengan perubahan gaya hidup.",
      "Beri contoh kebijakan yang berhasil dan gagal.",
      "Jelaskan mengapa keduanya saling bergantung.",
    ],
    minWords: 250,
  },
  {
    id: "skills-vs-theory",
    level: "advanced",
    kind: "opinion",
    topic: "Kurikulum kampus",
    title: "Universities should teach practical skills rather than academic theory. To what extent do you agree?",
    hints: [
      "Tentukan seberapa jauh kamu setuju, bukan sekadar ya atau tidak.",
      "Bahas risiko kurikulum yang terlalu vokasional.",
      "Usulkan komposisi ideal teori dan praktik.",
    ],
    minWords: 250,
  },
  {
    id: "online-privacy",
    level: "advanced",
    kind: "opinion",
    topic: "Privasi digital",
    title: "Is meaningful online privacy still possible in the age of data collection? Explain.",
    hints: [
      "Sebutkan jenis data yang dikumpulkan setiap hari.",
      "Bahas peran regulasi, perusahaan, dan kebiasaan pengguna.",
      "Simpulkan dengan definisi privasi yang realistis.",
    ],
    minWords: 250,
  },
  {
    id: "online-censorship",
    level: "advanced",
    kind: "opinion",
    topic: "Sensor daring",
    title: "Should governments limit harmful content online, even at the cost of free expression?",
    hints: [
      "Definisikan konten berbahaya secara konkret.",
      "Bahas risiko penyalahgunaan wewenang.",
      "Tawarkan mekanisme pengawasan yang independen.",
    ],
    minWords: 250,
  },
  {
    id: "space-budget",
    level: "advanced",
    kind: "opinion",
    topic: "Eksplorasi antariksa",
    title: "Is spending on space exploration justified when many basic needs remain unmet?",
    hints: [
      "Sebutkan manfaat teknologi turunan dari riset antariksa.",
      "Bandingkan besaran anggaran dengan kebutuhan sosial.",
      "Beri syarat kapan pengeluaran itu wajar.",
    ],
    minWords: 250,
  },
  {
    id: "local-culture",
    level: "advanced",
    kind: "opinion",
    topic: "Budaya lokal",
    title: "How can local cultures survive in a globalized world? Propose concrete measures.",
    hints: [
      "Pilih satu budaya lokal yang kamu kenal baik.",
      "Bahas peran sekolah, media, dan keluarga.",
      "Hindari romantisme; sebutkan biaya dan tantangannya.",
    ],
    minWords: 250,
  },
  {
    id: "standardized-tests",
    level: "advanced",
    kind: "compare",
    topic: "Tes standar",
    title: "Are standardized tests a fair measure of ability or a barrier to opportunity?",
    hints: [
      "Bahas konsistensi penilaian versus bias akses bimbingan belajar.",
      "Bandingkan dengan penilaian berbasis portofolio.",
      "Usulkan cara memperbaiki sistemnya, bukan hanya mengkritik.",
    ],
    minWords: 250,
  },
  {
    id: "urbanization",
    level: "advanced",
    kind: "opinion",
    topic: "Urbanisasi",
    title: "Rapid urbanization brings both opportunity and risk. Which outweighs the other in your country?",
    hints: [
      "Sebut satu kota sebagai studi kasus.",
      "Bahas lapangan kerja, perumahan, dan layanan publik.",
      "Simpulkan dengan prioritas kebijakan yang mendesak.",
    ],
    minWords: 250,
  },
  {
    id: "english-dominance",
    level: "advanced",
    kind: "opinion",
    topic: "Dominasi bahasa",
    title: "Does the global dominance of English threaten local languages? Discuss and give your view.",
    hints: [
      "Bedakan bahasa untuk pekerjaan dan bahasa untuk identitas.",
      "Sebut kebijakan bahasa di sekolah yang kamu amati.",
      "Tawarkan cara menjaga keduanya tetap hidup.",
    ],
    minWords: 250,
  },
];

const PROMPT_BY_ID = new Map(WRITING_PROMPTS.map((prompt) => [prompt.id, prompt]));

/** Cari prompt dari id; undefined kalau id tidak dikenal. */
export function findPrompt(id: string | null | undefined) {
  return id ? PROMPT_BY_ID.get(id) : undefined;
}

const PROMPT_BY_TITLE = new Map(WRITING_PROMPTS.map((prompt) => [prompt.title.toLowerCase(), prompt]));

/**
 * Cari prompt dari teks topik yang tersimpan di submission.
 * Pencocokan longgar (spasi & huruf besar-kecil) karena teks itu bebas diketik.
 */
export function findPromptByTitle(title: string) {
  const key = title.trim().replace(/\s+/g, " ").toLowerCase();
  return key ? PROMPT_BY_TITLE.get(key) : undefined;
}

/** Hash FNV-1a 32-bit; cukup untuk memutar prompt harian. */
function hashSeed(seed: string) {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/**
 * Prompt rekomendasi hari ini: sama untuk satu pengguna pada satu tanggal,
 * berganti tiap hari, dan tidak butuh penyimpanan.
 */
export function promptOfTheDay(userId: number, date: string) {
  const index = hashSeed(`${userId}:${date}`) % WRITING_PROMPTS.length;
  return WRITING_PROMPTS[index];
}

/** Prompt yang judulnya belum ada di riwayat esai pengguna. */
export function unusedPrompts(used: string[]) {
  const written = new Set(used.map((title) => title.trim().toLowerCase()));
  return WRITING_PROMPTS.filter((prompt) => !written.has(prompt.title.toLowerCase()));
}

/** Prompt acak yang belum ditulis; kalau semua sudah ditulis, pakai seluruh katalog. */
export function randomUnusedPrompt(used: string[], random = Math.random) {
  const pool = unusedPrompts(used);
  const source = pool.length > 0 ? pool : WRITING_PROMPTS;
  return source[Math.floor(random() * source.length) % source.length];
}
