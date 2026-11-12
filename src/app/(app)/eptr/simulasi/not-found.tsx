import { NotFoundCard } from "@/components/not-found-card";

export default function SimulationNotFound() {
  return (
    <NotFoundCard
      title="Simulasi tidak ditemukan"
      message="Simulasi ini tidak ada di akunmu. Mungkin sudah dihapus, atau tautannya milik akun lain."
      primary={{ href: "/eptr", label: "Kembali ke EPrT" }}
      secondary={{ href: "/eptr#mini-title", label: "Mulai simulasi baru" }}
    />
  );
}
