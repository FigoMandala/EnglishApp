import { trigrams } from "@/lib/question-variety";

/**
 * Indeks teks nyaris kembar yang skalabel (MinHash + LSH banding), pengganti `SimilarityIndex`
 * yang membandingkan satu per satu (O(n): 127 ms dan 317 MB pada 50.000 teks).
 *
 * Tiap teks dirangkum jadi tanda tangan `size` bilangan 32-bit (MinHash atas trigram kata). Tanda
 * tangan dipecah jadi pita (`rows` angka per pita); dua teks yang sama di satu pita jadi kandidat,
 * lalu kemiripan sebenarnya diperkirakan dari porsi angka tanda tangan yang sama. Waktu cek tidak
 * tergantung jumlah teks (hanya jumlah kandidat), memori sekitar 4*size byte + entri pita per teks.
 *
 * shortcut: kemiripan berupa perkiraan (galat sekitar 0,08) dan recall di sekitar ambang tidak penuh
 * (mis. ~70% di 0,6 untuk rows=4); teks yang jauh lebih mirip dari ambang hampir selalu tertangkap.
 * Naikkan `size` kalau butuh lebih tepat.
 */
export type NearDupOptions = { size?: number; rows?: number };

const multipliers = Array.from({ length: 128 }, (_, i) => (Math.imul(i + 1, 0x9e3779b1) | 1) >>> 0);
const offsets = Array.from({ length: 128 }, (_, i) => Math.imul(i + 7, 0x85ebca6b) >>> 0);

function hashGram(gram: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < gram.length; i += 1) h = Math.imul(h ^ gram.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export class NearDupIndex {
  private readonly size: number;
  private readonly rows: number;
  private readonly bands: number;
  private data: Uint32Array;
  private count = 0;
  private readonly buckets = new Map<number, number | number[]>();

  constructor(
    private readonly threshold: number,
    { size = 32, rows = 4 }: NearDupOptions = {},
  ) {
    this.size = Math.min(size, multipliers.length);
    this.rows = rows;
    this.bands = Math.floor(this.size / rows);
    this.data = new Uint32Array(this.size * 1024);
  }

  get length() {
    return this.count;
  }

  private signature(text: string) {
    const grams = [...trigrams(text)].map(hashGram);
    const sig = new Uint32Array(this.size).fill(0xffffffff);
    for (const gram of grams) {
      for (let i = 0; i < this.size; i += 1) {
        const value = (Math.imul(gram, multipliers[i]) + offsets[i]) >>> 0;
        if (value < sig[i]) sig[i] = value;
      }
    }
    return sig;
  }

  private bandKeys(sig: Uint32Array) {
    const keys: number[] = [];
    for (let band = 0; band < this.bands; band += 1) {
      let h = Math.imul(band + 1, 0x9e3779b1);
      for (let r = 0; r < this.rows; r += 1) h = Math.imul(h ^ sig[band * this.rows + r], 0x01000193);
      keys.push(h >>> 0);
    }
    return keys;
  }

  private estimate(sig: Uint32Array, id: number) {
    let same = 0;
    const base = id * this.size;
    for (let i = 0; i < this.size; i += 1) if (this.data[base + i] === sig[i]) same += 1;
    return same / this.size;
  }

  private candidates(keys: number[]) {
    const found = new Set<number>();
    for (const key of keys) {
      const entry = this.buckets.get(key);
      if (entry === undefined) continue;
      if (typeof entry === "number") found.add(entry);
      else for (const id of entry) found.add(id);
    }
    return found;
  }

  add(text: string) {
    const sig = this.signature(text);
    if (this.count * this.size >= this.data.length) {
      const bigger = new Uint32Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    const id = this.count;
    this.data.set(sig, id * this.size);
    this.count += 1;
    for (const key of this.bandKeys(sig)) {
      const entry = this.buckets.get(key);
      if (entry === undefined) this.buckets.set(key, id);
      else if (typeof entry === "number") this.buckets.set(key, [entry, id]);
      else entry.push(id);
    }
  }

  has(text: string) {
    const sig = this.signature(text);
    for (const id of this.candidates(this.bandKeys(sig))) {
      if (this.estimate(sig, id) >= this.threshold) return true;
    }
    return false;
  }

  clear() {
    this.buckets.clear();
    this.count = 0;
  }
}
