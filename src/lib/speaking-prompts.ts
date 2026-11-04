import type { PromptLevel } from "./writing-prompts";

export type SpeakingSentence = {
  /** Kalimat model dalam bahasa Inggris. */
  en: string;
  /** Terjemahan Indonesia, ditampilkan sebagai konteks. */
  id: string;
  /** Kata kunci yang ditekankan saat latihan. */
  focus: string;
};

export type SpeakingPrompt = {
  id: string;
  level: PromptLevel;
  /** Label topik singkat dalam bahasa Indonesia. */
  topic: string;
  /** Instruksi berbicara dalam bahasa Inggris, seperti pertanyaan wawancara. */
  title: string;
  /** Arahan singkat dalam bahasa Indonesia. */
  brief: string;
  /** Kalimat model untuk diucapkan dan dinilai pelafalannya. */
  sentences: SpeakingSentence[];
};

export const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  // Dasar — pengalaman pribadi, simple present & past.
  {
    id: "morning-routine",
    level: "basic",
    topic: "Rutinitas pagi",
    title: "Talk about your morning routine from waking up to leaving the house.",
    brief: "Pakai simple present: biasanya apa dulu, lalu apa.",
    sentences: [
      { en: "I usually wake up at half past five.", id: "Aku biasanya bangun jam setengah enam.", focus: "wake up" },
      { en: "The first thing I do is drink a glass of water.", id: "Hal pertama yang kulakukan adalah minum segelas air.", focus: "first thing" },
      { en: "After that, I take a quick shower and get dressed.", id: "Setelah itu, aku mandi cepat dan berpakaian.", focus: "shower" },
      { en: "I have breakfast with my family before I leave.", id: "Aku sarapan bersama keluarga sebelum berangkat.", focus: "breakfast" },
      { en: "I ride a motorbike to campus every morning.", id: "Aku naik motor ke kampus setiap pagi.", focus: "motorbike" },
    ],
  },
  {
    id: "favorite-food",
    level: "basic",
    topic: "Makanan favorit",
    title: "Describe your favorite food and explain when you usually eat it.",
    brief: "Sebutkan makanannya, siapa yang memasak, dan kenapa kamu suka.",
    sentences: [
      { en: "My favorite food is fried rice with a fried egg on top.", id: "Makanan favoritku nasi goreng dengan telur ceplok di atasnya.", focus: "fried rice" },
      { en: "My mother makes it every Sunday morning.", id: "Ibuku membuatnya setiap Minggu pagi.", focus: "makes" },
      { en: "It smells amazing because of the garlic and soy sauce.", id: "Aromanya luar biasa karena bawang dan kecap.", focus: "smells" },
      { en: "I always add a little chili because I love spicy food.", id: "Aku selalu menambah sedikit cabai karena suka makanan pedas.", focus: "chili" },
      { en: "Eating it reminds me of home when I study far away.", id: "Memakannya mengingatkanku pada rumah saat kuliah jauh.", focus: "reminds" },
    ],
  },
  {
    id: "free-time",
    level: "basic",
    topic: "Waktu luang",
    title: "Talk about what you do in your free time and why you enjoy it.",
    brief: "Beri dua kegiatan dan satu alasan untuk tiap kegiatan.",
    sentences: [
      { en: "In my free time, I usually listen to music or play badminton.", id: "Saat waktu luang, aku biasanya mendengar musik atau main bulu tangkis.", focus: "free time" },
      { en: "I play badminton with my neighbors twice a week.", id: "Aku main bulu tangkis dengan tetangga dua kali seminggu.", focus: "neighbors" },
      { en: "It keeps me healthy after sitting in class all day.", id: "Itu membuatku tetap sehat setelah seharian duduk di kelas.", focus: "healthy" },
      { en: "When it rains, I stay home and watch films.", id: "Saat hujan, aku diam di rumah dan menonton film.", focus: "stay home" },
      { en: "I enjoy it because it helps me forget about assignments.", id: "Aku menikmatinya karena membantuku melupakan tugas.", focus: "forget" },
    ],
  },
  {
    id: "last-weekend",
    level: "basic",
    topic: "Akhir pekan lalu",
    title: "Tell a short story about what you did last weekend.",
    brief: "Pakai simple past dan tunjukkan urutan kejadiannya.",
    sentences: [
      { en: "Last Saturday, I visited my grandmother in the village.", id: "Sabtu lalu, aku mengunjungi nenekku di desa.", focus: "visited" },
      { en: "We cooked together and talked for hours.", id: "Kami memasak bersama dan berbincang berjam-jam.", focus: "cooked" },
      { en: "In the afternoon, I helped her water the plants.", id: "Sore harinya, aku membantunya menyiram tanaman.", focus: "helped" },
      { en: "It rained heavily, so we stayed inside.", id: "Hujan deras, jadi kami di dalam rumah.", focus: "rained" },
      { en: "I came home late but I felt very happy.", id: "Aku pulang terlambat tapi merasa sangat senang.", focus: "felt" },
    ],
  },
  // Menengah — pendapat singkat dengan alasan.
  {
    id: "study-habits",
    level: "intermediate",
    topic: "Cara belajar",
    title: "Explain how you prepare for an exam and which method works best for you.",
    brief: "Jelaskan langkahnya berurutan, lalu sebut metode paling efektif.",
    sentences: [
      { en: "I start by listing every topic I need to review.", id: "Aku mulai dengan mendaftar semua topik yang perlu diulang.", focus: "listing" },
      { en: "Then I divide the material into small chunks of thirty minutes.", id: "Lalu aku membagi materi jadi bagian kecil tiga puluh menit.", focus: "chunks" },
      { en: "I turn off my phone so notifications do not break my focus.", id: "Aku mematikan ponsel agar notifikasi tidak merusak fokus.", focus: "notifications" },
      { en: "Explaining a concept to a friend is the best way to test my understanding.", id: "Menjelaskan konsep ke teman adalah cara terbaik menguji pemahamanku.", focus: "concept" },
      { en: "Two days before the exam, I only do practice questions.", id: "Dua hari sebelum ujian, aku hanya mengerjakan soal latihan.", focus: "practice questions" },
    ],
  },
  {
    id: "city-problems",
    level: "intermediate",
    topic: "Masalah kota",
    title: "Describe one problem in your city and suggest a practical solution.",
    brief: "Satu masalah, dua penyebab, satu solusi konkret.",
    sentences: [
      { en: "The biggest problem in my city is traffic during rush hour.", id: "Masalah terbesar di kotaku adalah lalu lintas saat jam sibuk.", focus: "traffic" },
      { en: "Many people drive alone instead of sharing a car.", id: "Banyak orang menyetir sendiri daripada berbagi mobil.", focus: "sharing" },
      { en: "The government could improve the bus service so it is more reliable.", id: "Pemerintah bisa memperbaiki layanan bus agar lebih andal.", focus: "reliable" },
      { en: "Cycling lanes would also help students reach campus safely.", id: "Jalur sepeda juga akan membantu pelajar sampai kampus dengan aman.", focus: "cycling lanes" },
      { en: "A small change in habit can make the air cleaner.", id: "Perubahan kecil dalam kebiasaan bisa membuat udara lebih bersih.", focus: "habit" },
    ],
  },
  {
    id: "everyday-technology",
    level: "intermediate",
    topic: "Teknologi sehari-hari",
    title: "Talk about one app or device you cannot live without and explain why.",
    brief: "Sebut fungsinya, contoh pemakaian, dan dampaknya buat kamu.",
    sentences: [
      { en: "The app I use most is a note-taking tool on my phone.", id: "Aplikasi yang paling sering kupakai adalah catatan di ponsel.", focus: "note-taking" },
      { en: "I write down ideas whenever they come to me.", id: "Aku menulis ide kapan pun muncul.", focus: "ideas" },
      { en: "It syncs to my laptop, so I never lose my notes.", id: "Aplikasi itu tersinkron ke laptop, jadi catatanku tidak pernah hilang.", focus: "syncs" },
      { en: "Before that, I kept forgetting what I had planned.", id: "Sebelumnya, aku sering lupa apa yang sudah kurencanakan.", focus: "forgetting" },
      { en: "Simple tools like this save me a lot of time.", id: "Alat sederhana seperti ini menghemat banyak waktuku.", focus: "save" },
    ],
  },
  {
    id: "work-experience",
    level: "intermediate",
    topic: "Pengalaman kerja",
    title: "Describe a part-time job or project you have done and what you learned from it.",
    brief: "Ceritakan peranmu, satu tantangan, dan pelajaran yang kamu ambil.",
    sentences: [
      { en: "Last year I worked part-time at a small bookshop.", id: "Tahun lalu aku bekerja paruh waktu di toko buku kecil.", focus: "part-time" },
      { en: "My main task was arranging new stock on the shelves.", id: "Tugas utamaku menata stok baru di rak.", focus: "arranging" },
      { en: "I learned to stay calm when customers were impatient.", id: "Aku belajar tetap tenang saat pelanggan tidak sabar.", focus: "impatient" },
      { en: "My manager trusted me to close the shop alone.", id: "Manajerku mempercayaiku menutup toko sendiri.", focus: "trusted" },
      { en: "That experience taught me how to manage my time.", id: "Pengalaman itu mengajariku mengatur waktu.", focus: "manage" },
    ],
  },
  // Lanjut — argumen dengan nuansa dan counterargument.
  {
    id: "remote-work",
    level: "advanced",
    topic: "Kerja jarak jauh",
    title: "Discuss whether remote work makes people more or less productive.",
    brief: "Sebut satu sisi positif, satu risiko, lalu posisimu.",
    sentences: [
      { en: "Remote work removes commuting time and gives people quieter hours.", id: "Kerja jarak jauh menghapus waktu komuter dan memberi jam yang lebih tenang.", focus: "commuting" },
      { en: "However, it can blur the line between work and rest.", id: "Namun, itu bisa mengaburkan batas kerja dan istirahat.", focus: "blur" },
      { en: "Some employees thrive alone, while others need the energy of an office.", id: "Sebagian karyawan berkembang saat sendiri, sebagian butuh energi kantor.", focus: "thrive" },
      { en: "Managers should measure results rather than hours logged.", id: "Manajer sebaiknya mengukur hasil, bukan jam kerja tercatat.", focus: "results" },
      { en: "A hybrid schedule often strikes the best balance.", id: "Jadwal hibrida sering memberi keseimbangan terbaik.", focus: "hybrid" },
    ],
  },
  {
    id: "social-media",
    level: "advanced",
    topic: "Media sosial",
    title: "Explain how social media changes the way young people see themselves.",
    brief: "Bahas dampak negatif, satu sisi positif, lalu solusinya.",
    sentences: [
      { en: "Social media turns ordinary life into something people compare constantly.", id: "Media sosial mengubah hidup biasa jadi sesuatu yang terus dibandingkan.", focus: "compare" },
      { en: "Filters create standards of beauty that no one can reach.", id: "Filter menciptakan standar kecantikan yang tak mungkin dicapai.", focus: "standards" },
      { en: "Teenagers often mistake attention for genuine approval.", id: "Remaja sering menyamakan perhatian dengan penerimaan tulus.", focus: "approval" },
      { en: "Yet these platforms also give quiet voices a place to be heard.", id: "Namun platform ini juga memberi suara yang pendiam tempat didengar.", focus: "platforms" },
      { en: "Teaching digital literacy matters more than banning the apps.", id: "Mengajarkan literasi digital lebih penting daripada melarang aplikasinya.", focus: "literacy" },
    ],
  },
  {
    id: "education-cost",
    level: "advanced",
    topic: "Biaya pendidikan",
    title: "Argue whether higher education should be free for everyone.",
    brief: "Beri argumen pro, bantahan, lalu kebijakan yang paling adil.",
    sentences: [
      { en: "Free university would open doors for talented students from poor families.", id: "Kuliah gratis akan membuka pintu bagi pelajar berbakat dari keluarga miskin.", focus: "talented" },
      { en: "Critics argue that the tax burden would be enormous.", id: "Kritikus berpendapat beban pajaknya akan sangat besar.", focus: "burden" },
      { en: "Public money could instead go to scholarships with clear criteria.", id: "Dana publik bisa dialihkan ke beasiswa dengan kriteria jelas.", focus: "scholarships" },
      { en: "Quality suffers when campuses accept more students than they can teach.", id: "Mutu menurun saat kampus menerima lebih banyak mahasiswa dari kemampuan mengajarnya.", focus: "quality" },
      { en: "The fairest policy probably combines low tuition with targeted support.", id: "Kebijakan paling adil mungkin menggabungkan uang kuliah rendah dengan bantuan tepat sasaran.", focus: "targeted" },
    ],
  },
  {
    id: "plastic-policy",
    level: "advanced",
    topic: "Sampah plastik",
    title: "Propose one policy your government should adopt to reduce plastic waste.",
    brief: "Jelaskan masalahnya, usulkan kebijakan, dan sebut syarat keberhasilannya.",
    sentences: [
      { en: "Plastic packaging is convenient, but most of it ends up in rivers.", id: "Kemasan plastik praktis, tapi sebagian besar berakhir di sungai.", focus: "packaging" },
      { en: "A deposit scheme would encourage people to return bottles.", id: "Skema deposit akan mendorong orang mengembalikan botol.", focus: "deposit" },
      { en: "Shops should be required to offer refill stations for daily products.", id: "Toko sebaiknya diwajibkan menyediakan stasiun isi ulang untuk produk harian.", focus: "refill" },
      { en: "Small businesses need support to afford the change.", id: "Usaha kecil butuh dukungan agar mampu membiayai perubahan itu.", focus: "afford" },
      { en: "Without enforcement, even a good policy becomes a slogan.", id: "Tanpa penegakan, kebijakan bagus pun jadi slogan.", focus: "enforcement" },
    ],
  },
];

/** Prompt speaking untuk satu level, urut sesuai katalog. */
export function speakingPromptsAt(level: PromptLevel) {
  return SPEAKING_PROMPTS.filter((prompt) => prompt.level === level);
}
