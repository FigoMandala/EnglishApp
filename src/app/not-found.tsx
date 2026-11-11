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
          href="/"
          className="eyebrow mt-4 inline-flex items-center gap-2 text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Kembali ke beranda
        </Link>
        <Link
          href="/eptr"
          className="mt-2 inline-flex items-center gap-2 text-[0.8125rem] font-bold text-ink-subtle underline decoration-hairline-strong underline-offset-4 hover:text-ink-muted hover:decoration-ink-faint"
        >
          Ke EPrT
        </Link>
      </div>
    </div>
  );
}
