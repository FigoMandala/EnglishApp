import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-plate border-2 border-hairline-strong bg-surface px-6 py-6">
        <p className="eyebrow text-ink-subtle">Halaman tidak ditemukan</p>
        <p className="tnum mt-3 text-[3rem] font-semibold leading-none text-ink">404</p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-muted">
          Alamat ini tidak ada. Mungkin tautannya salah ketik.
        </p>
        <Link
          href="/eptr"
          className="eyebrow mt-4 inline-flex items-center gap-2 text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Kembali ke EPrT
        </Link>
      </div>
    </div>
  );
}
