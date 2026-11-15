import { PendingOverlay } from "@/components/pending-overlay";

/** Selagi soal latihan disiapkan, tampilkan overlay yang sama seperti tombol mulai di TOEFL ITP. */
export default function Loading() {
  return <PendingOverlay hint="Soal diambil dari bank, biasanya hanya beberapa detik." />;
}
