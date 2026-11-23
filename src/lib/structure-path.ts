/** Jalur belajar Structure: urutan slug materi grammar per level, dari dasar sampai expert. Slug yang belum ada di DB dilewati. */
export const STRUCTURE_PATH = [
  {
    key: "dasar",
    tag: "DASAR",
    heading: "Fondasi kalimat",
    slugs: ["16-tenses", "to-be-am-is-are", "personal-pronouns", "this-that-these-those", "a-an-the", "singular-plural", "have-has", "subject-verb-basic", "present-simple", "present-continuous", "simple-past"],
  },
  {
    key: "menengah",
    tag: "MENENGAH",
    heading: "Pola yang paling sering diujikan",
    slugs: ["subject-verb-agreement", "tenses", "articles-prepositions", "word-forms-affixes", "adjectives-vs-adverbs", "present-perfect", "present-perfect-vs-past-simple", "past-continuous", "past-perfect", "future-will-going-to", "passive-voice", "can-could-may", "comparatives-superlatives", "quantifiers-countability"],
  },
  {
    key: "lanjut",
    tag: "LANJUT",
    heading: "Klausa dan struktur kompleks",
    slugs: ["clauses", "relative-clauses", "connectors-transitions", "parallel-structure", "gerunds-infinitives", "conditionals", "reported-speech", "modals-obligation-advice", "preposition-collocations", "causatives", "used-to-be-used-to"],
  },
  {
    key: "expert",
    tag: "EXPERT",
    heading: "Jebakan tingkat tinggi",
    slugs: ["reduced-clauses", "inversion-emphasis", "passive-voice-advanced", "wish-subjunctive", "modals-deduction", "future-perfect-continuous", "punctuation-cohesion"],
  },
] as const;
