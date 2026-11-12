import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** Kartu 404: tombol bertumpuk dan selebar kartu supaya tidak menyatu jadi satu baris teks. */
export function NotFoundCard({
  title = "Halaman tidak ditemukan",
  message = "Alamat ini tidak ada. Mungkin tautannya salah ketik.",
  primary = { href: "/", label: "Kembali ke beranda" },
  secondary,
}: {
  title?: string;
  message?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-10">
      <div role="alert" className="rise flex w-full max-w-md flex-col gap-5 rounded-plate border-2 border-hairline bg-surface p-7 shadow-card">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-ink-subtle">{title}</p>
          <p className="tnum font-display text-[4rem] font-extrabold leading-none text-ink">404</p>
          <p className="text-[1rem] leading-relaxed text-ink-muted">{message}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <Link href={primary.href} className={buttonVariants({ variant: "primary", size: "md" })}>
            <ArrowLeft className="size-4" aria-hidden />
            {primary.label}
          </Link>
          {secondary ? (
            <Link href={secondary.href} className={buttonVariants({ variant: "secondary", size: "md" })}>
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
