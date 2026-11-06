import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Font di-self-host (src/app/fonts, lisensi OFL menyertai) supaya build
// produksi tidak lagi bergantung pada fetch ke fonts.googleapis.com yang
// sempat gagal berulang di runner Vercel.
// Figtree: teks isi pada mockup desktop redesign.
const body = localFont({
  src: "./fonts/figtree-latin-var.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "300 900",
});
// Gabarito — judul tebal & bulat, selaras dengan karakter Lori & Kaka.
const heading = localFont({
  src: "./fonts/gabarito-latin-var.woff2",
  variable: "--font-heading",
  display: "swap",
  weight: "400 900",
});
// Baloo 2 — angka rounded/chunky untuk metrik (XP, skor, streak).
const round = localFont({
  src: "./fonts/baloo2-latin-var.woff2",
  variable: "--font-round",
  display: "swap",
  weight: "400 800",
});
const code = localFont({
  src: "./fonts/jetbrainsmono-latin-var.woff2",
  variable: "--font-code",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "EnglishApp",
  description: "Belajar bahasa Inggris: EPrT, kosakata, grammar, dan tutor AI.",
};

// viewport-fit=cover: konten menggambar sampai tepi di ponsel berponi (notch),
// dan env(safe-area-inset-*) di shell/exam runner jadi aktif. Zoom tidak
// dinonaktifkan (aksesibilitas).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#23252b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${body.variable} ${heading.variable} ${round.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  );
}
