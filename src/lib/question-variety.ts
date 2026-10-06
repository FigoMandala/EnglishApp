import { createHash } from "node:crypto";

import type { ToeflQuestion } from "@/lib/toefl";

// Taksonomi topik: bidang -> subtopik. Dipakai untuk Reading, Lecture, dan konteks
// kalimat Structure supaya AI tidak berputar di topik yang sama.
const TAXONOMY: Record<string, string> = {
  astronomy: "exoplanets, solar flares, comets, the Moon's formation, black holes, meteor showers, space telescopes, the Kuiper belt, planetary rings, eclipses, dwarf planets, star life cycles, the Milky Way, asteroid mining, Mars rovers, auroras, cosmic microwave background, pulsars, the International Space Station, light pollution",
  geology: "plate tectonics, volcanoes, earthquakes, fossils, cave formation, glaciers, minerals and gems, sedimentary rocks, geysers, sinkholes, desert dunes, coastal erosion, the rock cycle, tsunamis, soil formation, canyons, permafrost, hot springs, ice ages, landslides",
  "marine biology": "coral reefs, whale migration, deep-sea creatures, kelp forests, octopus intelligence, sea turtles, plankton, mangroves, jellyfish, shark senses, tide pools, dolphins' communication, ocean acidification, salmon runs, seahorses, bioluminescence, seagrass meadows, penguins, sea otters, hydrothermal vents",
  "animal behavior": "bird migration, bee communication, ant colonies, animal camouflage, hibernation, wolf packs, elephant memory, crow problem-solving, animal play, territorial behavior, echolocation in bats, butterfly migration, nest building, mimicry, herd behavior, pet domestication, primate tool use, insect metamorphosis, animal navigation, courtship displays",
  botany: "photosynthesis, carnivorous plants, seed dispersal, tree rings, rainforest canopies, desert plants, pollination, bamboo growth, mushrooms and fungi, plant defenses, orchids, root systems, invasive plants, rice cultivation, cactus adaptation, leaf color change, moss, medicinal herbs, redwood trees, plant communication",
  ecology: "food webs, keystone species, wetland conservation, urban wildlife, rewilding, biodiversity hotspots, pollinator decline, wildfire ecology, migration corridors, endangered species recovery, river restoration, island ecosystems, predator reintroduction, habitat fragmentation, citizen science, national parks, ecotourism, seed banks, coral restoration, grassland ecosystems",
  climate: "greenhouse gases, sea level rise, monsoons, El Nino, heat waves, carbon capture, melting glaciers, weather forecasting, hurricanes, droughts, climate models, urban heat islands, tree planting programs, arctic ice, extreme rainfall, carbon footprints, climate adaptation in cities, air quality, atmospheric rivers, cloud formation",
  energy: "solar panels, wind farms, geothermal power, hydroelectric dams, battery storage, hydrogen fuel, nuclear fusion research, smart grids, electric vehicles charging, energy efficiency in buildings, tidal energy, biofuels, rooftop solar, power outages, energy poverty, offshore wind, lithium mining, microgrids, heat pumps, oil history",
  medicine: "vaccines, antibiotics resistance, the immune system, anesthesia history, telemedicine, blood types, organ transplants, the placebo effect, sleep disorders, allergies, medical imaging, stem cells, pandemics history, the discovery of insulin, herd immunity, robotic surgery, first aid, hearing loss, vision correction, rare diseases",
  "human health": "nutrition labels, hydration, exercise and the brain, stress, sugar consumption, posture, screen time, vitamin D, gut bacteria, caffeine, sleep hygiene, walking, meditation, dental health, sunscreen, obesity trends, breakfast habits, noise and health, standing desks, aging well",
  psychology: "memory, habits, motivation, procrastination, decision making, color psychology, first impressions, learning styles, emotional intelligence, the bystander effect, dreams, attention span, peer pressure, optimism, multitasking, language acquisition in children, creativity, happiness research, social media and mood, fear of public speaking",
  education: "online learning, homework debates, bilingual education, study techniques, standardized testing, student loans, early childhood education, gamified learning, library use, school uniforms, gap years, teacher training, group projects, student exchange programs, literacy programs, vocational education, lifelong learning, academic honesty, flipped classrooms, massive open online courses",
  linguistics: "endangered languages, sign languages, how children learn words, loanwords, accents, the origin of writing, translation technology, slang, dialects, the history of English, pidgins and creoles, body language, bilingual brains, emojis as language, place names, grammar changes, spelling reform, whistled languages, language and thought, the alphabet",
  history: "the Silk Road, the printing press, the Industrial Revolution, ancient Rome's roads, the Renaissance, the Olympic Games origins, the telegraph, the Great Wall, Viking exploration, the spice trade, ancient Egypt's pyramids, the Black Death, the Hanseatic League, the invention of paper, the gold rush, the Majapahit empire, the transcontinental railroad, medieval castles, the history of maps, early aviation",
  archaeology: "Pompeii, the Terracotta Army, cave paintings, Machu Picchu, shipwreck excavations, ancient DNA, the Rosetta Stone, Stonehenge, Mayan cities, Borobudur, radiocarbon dating, ancient pottery, Mesopotamian tablets, bog bodies, underwater cities, Angkor Wat, Gobekli Tepe, lost cities in jungles, burial customs, ancient trade goods",
  anthropology: "hunter-gatherer societies, rites of passage, kinship systems, nomadic herders, gift economies, traditional medicine, oral traditions, food taboos, cultural festivals, urban migration, indigenous knowledge, marriage customs, traditional architecture, tattoo traditions, storytelling cultures, community farming, subak irrigation, clothing and identity, music in rituals, globalization of culture",
  economics: "inflation, supply and demand, microloans, minimum wage, the gig economy, cryptocurrency, trade tariffs, unemployment, behavioral economics, auctions, the sharing economy, remittances, universal basic income, price discrimination, economic bubbles, central banks, tourism economies, informal markets, recycling markets, the economics of happiness",
  "personal finance": "budgeting, compound interest, credit cards, saving for retirement, index funds, emergency funds, student budgets, insurance basics, buying versus renting, financial scams, investing in bonds, digital wallets, tax basics, impulse buying, side jobs, financial literacy, debt repayment, crowdfunding, bank interest rates, spending apps",
  business: "startups, franchising, customer loyalty programs, brand logos, supply chains, remote work, product recalls, family businesses, e-commerce, advertising history, workplace diversity, business ethics, market research, coworking spaces, small business loans, packaging design, customer service, company mergers, social enterprises, pricing strategies",
  marketing: "influencer marketing, product placement, jingles, viral campaigns, loyalty cards, color in branding, packaging psychology, celebrity endorsements, online reviews, discount strategies, targeted ads, slogans, rebranding, limited editions, word of mouth, sponsorships, store layouts, mascots, green marketing, product sampling",
  technology: "smartphones, artificial intelligence, 3D printing, drones, cybersecurity, cloud computing, the internet's origins, GPS, self-driving cars, facial recognition, e-waste, quantum computing, open-source software, wearable devices, video games, the history of computers, touchscreens, voice assistants, data centers, digital privacy",
  "communication technology": "fiber optics, satellites, 5G networks, undersea cables, radio history, the telephone, email, social networks, video calls, emoji history, podcasts, streaming services, text messaging, internet access in villages, fake news, translation apps, the fax machine, television history, search engines, online communities",
  engineering: "suspension bridges, skyscrapers, tunnels, earthquake-proof buildings, canals, water treatment, robotics, elevators, dams, road design, high-speed trains, wind turbines design, recycling plants, airports, sewage systems, lighthouses, stadium roofs, desalination, space elevators concept, prosthetic limbs",
  materials: "glass fibers, plastics, concrete, steel, carbon fiber, graphene, bioplastics, recycled textiles, ceramics, rubber, self-healing materials, bamboo construction, aluminum recycling, smart fabrics, paper making, silk production, nanomaterials, cement alternatives, packaging materials, wood engineering",
  transportation: "bicycles in cities, electric scooters, subway systems, container shipping, airships, traffic congestion, car sharing, the history of the automobile, cable cars, ferries, road safety, trucking logistics, hyperloop proposals, canal boats, pedestrian streets, airline hubs, parking policy, tuk-tuks, railway history, public buses",
  "urban planning": "green roofs, public parks, smart cities, housing shortages, zoning, street markets, flood-resistant cities, historic preservation, bike lanes, noise pollution, urban gardens, city lighting, waste collection, walkable neighborhoods, new capital cities, slum upgrading, public libraries, city squares, waterfront renewal, traffic-free zones",
  "food science": "fermentation, food preservation, freeze-drying, chocolate making, coffee roasting, bread baking, food additives, spices, lab-grown meat, tempe, cheese making, the science of taste, food waste, organic farming, tea processing, frozen food, sugar alternatives, honey production, noodles history, street food safety",
  agriculture: "rice terraces, irrigation, vertical farming, hydroponics, crop rotation, fertilizers, beekeeping, fish farming, pest control, soil health, drought-resistant crops, farm robots, coffee farming, palm oil, cocoa farming, dairy farming, seed saving, urban farming, greenhouses, precision agriculture",
  art: "impressionism, street art, batik, pottery, photography history, sculpture, museum curation, art forgery, printmaking, digital art, murals, calligraphy, art restoration, wayang puppetry, mosaics, portrait painting, installation art, textile art, comics, architecture as art",
  music: "the gamelan, jazz origins, orchestras, music and memory, the piano's history, recording technology, music streaming, folk songs, film scores, rhythm and the brain, the violin, music festivals, hip hop history, music therapy, national anthems, the guitar, choirs, vinyl records revival, K-pop industry, traditional instruments",
  literature: "fairy tales, the novel's history, poetry forms, detective fiction, science fiction, epic poems, children's books, libraries history, book translation, the printing of newspapers, graphic novels, autobiography, oral storytelling, famous diaries, publishing industry, e-books, literary prizes, myths, fables, travel writing",
  "film and media": "silent films, animation, documentary making, special effects, film festivals, television news, reality TV, film censorship, dubbing and subtitles, movie theaters, streaming and cinema, radio dramas, camera technology, film preservation, video game storytelling, news photography, advertising in films, film music, the Oscars, independent films",
  sports: "the marathon, sports science, badminton, football tactics, the Olympics, e-sports, sports injuries, swimming technique, mountain climbing, pencak silat, sports nutrition, referees and technology, women's sports history, surfing, cycling races, stadium economics, sports psychology, chess as sport, extreme sports, team building through sport",
  architecture: "Gothic cathedrals, traditional houses, joglo architecture, modernism, sustainable buildings, domes, tiny houses, skyscraper history, earthquake architecture, museums design, mosques architecture, bamboo buildings, Art Deco, public housing, glass buildings, adaptive reuse, famous bridges, ancient temples, courtyard houses, prefab housing",
  sociology: "urbanization, family structures, volunteering, generational differences, social mobility, online communities, loneliness, public trust, migration, youth culture, aging populations, gender roles, consumerism, rural life, social networks, community centers, crime prevention, civic participation, workplace culture, fashion trends",
  law: "copyright, consumer rights, privacy law, the jury system, traffic laws, international law, contracts, environmental law, labor rights, intellectual property, the history of constitutions, human rights, patents, online defamation, data protection, juvenile justice, maritime law, animal welfare law, election law, legal aid",
  government: "elections, local government, public health policy, taxation, public transport funding, census, diplomacy, the United Nations, foreign aid, disaster management, public libraries funding, e-government, voting systems, national budgets, civil service, freedom of information, smart city policy, border control, education policy, space agencies",
  inventions: "the light bulb, the wheel, the compass, the refrigerator, the microscope, the camera, the airplane, the sewing machine, the zipper, the calculator, the barcode, the microwave oven, the telescope, eyeglasses, the bicycle, the printing press, the steam engine, the radio, the washing machine, the ballpoint pen",
  biography: "Marie Curie, Ki Hajar Dewantara, Leonardo da Vinci, Nikola Tesla, Ada Lovelace, Charles Darwin, B.J. Habibie, Florence Nightingale, Isaac Newton, Kartini, Alexander Fleming, Wright brothers, Jane Goodall, Galileo Galilei, Thomas Edison, Katherine Johnson, Albert Einstein, Ibn Battuta, Rachel Carson, Louis Pasteur",
  "daily life": "commuting, cooking at home, part-time jobs, pet ownership, recycling at home, shopping habits, public holidays, weekend markets, apartment living, time management, gardening, laundry technology, cafes culture, gift giving, moving house, neighborhood festivals, household chores, hobbies, travel planning, digital detox",
};

export const SUBTOPICS: string[] = Object.entries(TAXONOMY).flatMap(([domain, list]) =>
  list.split(",").map((subtopic) => `${domain}: ${subtopic.trim()}`),
);

const READING_ANGLES = [
  "explain how it works or how it is made",
  "tell its history and development",
  "compare two kinds or two approaches",
  "describe a problem and possible solutions",
  "describe a discovery or research finding",
  "explain its causes and effects",
  "describe its uses and benefits",
  "describe a debate with different viewpoints",
];

const SETTINGS = [
  "university library", "science lab", "dormitory", "professor's office", "campus cafeteria",
  "bookstore", "campus clinic", "computer lab", "registrar's office", "lecture hall after class",
  "student union", "campus bus stop", "sports center", "art studio", "music practice room",
  "career center", "financial aid office", "campus parking lot", "language center", "print shop",
  "student apartment", "study group room", "campus garden", "photocopy center", "museum on campus",
  "seminar room", "orientation event", "lost and found office", "admissions office", "IT help desk",
  "campus radio station", "student newspaper office", "graduation ceremony", "department lounge", "laundry room",
  "cafe near campus", "campus pharmacy", "research center", "field trip bus", "housing office",
];

const RELATIONS = [
  "a student and a professor", "two classmates", "a student and a librarian", "two roommates",
  "a student and an academic advisor", "a student and a lab assistant", "a new student and a senior student",
  "a student and an office staff member", "two members of a student club", "a student and a teaching assistant",
  "a student and a campus nurse", "a student and a bookstore clerk", "two teammates on a project",
  "a student and a dormitory manager", "a student and a career counselor",
];

const SITUATIONS = [
  "a missed assignment deadline", "borrowing a book", "changing a class schedule", "a broken laptop",
  "preparing for a presentation", "a lab report", "finding a part-time job", "a scholarship application",
  "a group project problem", "moving to a new room", "an exam date conflict", "a late library fine",
  "choosing a thesis topic", "joining a club", "a field trip plan", "a course registration error",
  "a lost student ID card", "asking for a recommendation letter", "a noisy neighbor", "a campus event",
  "an internship interview", "a printing problem", "a research survey", "splitting rent", "a cancelled class",
  "a dropped course", "a textbook price", "a sports tournament", "a study abroad plan", "a health check-up",
];

const TALK_STYLES = [
  "a short university lecture",
  "a welcome talk at a student club",
  "a campus announcement",
  "a guided tour talk",
  "a guest speaker's talk",
  "a workshop introduction",
];

export type SeedKind = "topic" | "scene";

/** Pilih n item yang tidak ada di `recent`; kalau pool habis, pakai yang paling lama. */
export function pickFresh(pool: string[], recent: string[], n: number, random = Math.random): string[] {
  const used = new Set(recent);
  const fresh = pool.filter((item) => !used.has(item));
  const picked: string[] = [];
  while (picked.length < n && fresh.length) {
    const [item] = fresh.splice(Math.floor(random() * fresh.length), 1);
    picked.push(item);
  }
  for (const item of recent) {
    if (picked.length >= n) break;
    if (pool.includes(item) && !picked.includes(item)) picked.push(item);
  }
  return picked;
}

function pickOne<T>(list: readonly T[], random: () => number) {
  return list[Math.floor(random() * list.length)];
}

/** Skenario Listening: latar x relasi x situasi (40 x 15 x 30 = 18.000 kombinasi). */
export function pickScenes(recent: string[], n: number, random = Math.random): string[] {
  const used = new Set(recent);
  const scenes: string[] = [];
  for (let tries = 0; scenes.length < n && tries < n * 50; tries += 1) {
    const scene = `${pickOne(RELATIONS, random)} at the ${pickOne(SETTINGS, random)}, about ${pickOne(SITUATIONS, random)}`;
    if (!used.has(scene) && !scenes.includes(scene)) scenes.push(scene);
  }
  return scenes;
}

export function readingAngle(random = Math.random) {
  return pickOne(READING_ANGLES, random);
}

export function talkStyle(random = Math.random) {
  return pickOne(TALK_STYLES, random);
}

/** Batasi riwayat seed: yang terbaru di akhir, maksimal `limit`. */
export function rememberSeeds(recent: string[], used: string[], limit = 2000) {
  const set = new Set(used);
  return [...recent.filter((item) => !set.has(item)), ...used].slice(-limit);
}

// ---------------------------------------------------------------------------
// Fingerprint dan kemiripan

export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(text: string) {
  return createHash("sha1").update(normalize(text)).digest("hex").slice(0, 20);
}

/**
 * Teks yang mewakili isi satu soal: transkrip audio, kalimat soal, dan pilihan.
 * Pilihan diurutkan supaya soal yang sama tetap dikenali walau opsinya diacak ulang.
 */
export function questionText(question: Pick<ToeflQuestion, "q" | "options" | "audio">) {
  const audio = (question.audio ?? []).map((line) => line.text).join(" ");
  return `${audio} ${question.q} ${[...question.options].sort().join(" ")}`;
}

export function trigrams(text: string) {
  const words = normalize(text).split(" ").filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i + 2 < words.length; i += 1) grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  if (!grams.size && words.length) grams.add(words.join(" "));
  return grams;
}

export function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const gram of small) if (large.has(gram)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export const QUESTION_SIMILAR = 0.6;
export const PASSAGE_SIMILAR = 0.3;

/** Topik esai Writing: pernyataan argumentatif yang bisa pro/kontra. */
const WRITING_TOPICS = [
  "whether university students should live on campus",
  "whether online learning can replace face-to-face classes",
  "whether governments should limit private car use in city centers",
  "whether social media does more harm than good for teenagers",
  "whether students should be required to learn a second language",
  "whether working part-time while studying helps or hurts students",
  "whether exams are the best way to measure a student's ability",
  "whether companies should allow employees to work from home",
  "whether cities should spend more on public parks or public transport",
  "whether artificial intelligence will create more jobs than it removes",
  "whether plastic bags should be banned completely",
  "whether volunteering should be a requirement in high school",
  "whether advertising to children should be restricted",
  "whether it is better to save money or spend it on experiences",
  "whether news from social media is as reliable as traditional news",
  "whether sports should be a required subject in school",
  "whether people should eat less meat to protect the environment",
  "whether a gap year before university is a good idea",
  "whether free public libraries are still necessary today",
  "whether remote work improves or damages teamwork",
];

export function writingTopic(random = Math.random) {
  return pickOne(WRITING_TOPICS, random);
}

/** Frasa dari contoh soal resmi yang tidak boleh tersalin mentah-mentah. */
const EXAMPLE_PHRASES = [
  "mike wheeler",
  "parvati",
  "ancient greeks worshiped",
  "white house has retain",
  "glass fibers are extremely strong",
  "spinnerets",
  "new members of this investment club",
  "lab partner is",
];

export function copiesExample(text: string) {
  const plain = normalize(text);
  return EXAMPLE_PHRASES.some((phrase) => plain.includes(normalize(phrase)));
}

/** Indeks kemiripan riwayat soal pengguna. */
export class SimilarityIndex {
  private readonly prints = new Set<string>();
  private readonly grams: Set<string>[] = [];

  constructor(texts: string[] = [], private readonly threshold = QUESTION_SIMILAR) {
    for (const text of texts) this.add(text);
  }

  add(text: string) {
    this.prints.add(fingerprint(text));
    this.grams.push(trigrams(text));
  }

  clear() {
    this.prints.clear();
    this.grams.length = 0;
  }

  has(text: string) {
    if (this.prints.has(fingerprint(text))) return true;
    const grams = trigrams(text);
    return this.grams.some((other) => similarity(grams, other) >= this.threshold);
  }
}
