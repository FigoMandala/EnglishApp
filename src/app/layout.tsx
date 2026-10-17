import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Baloo_2,
  Gabarito,
  JetBrains_Mono,
} from "next/font/google";

import "./globals.css";

// Atkinson Hyperlegible dirancang untuk keterbacaan (low vision, disleksia).
const body = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
// Gabarito — judul tebal & bulat, selaras dengan karakter Lori & Kaka.
const heading = Gabarito({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});
// Baloo 2 — angka rounded/chunky untuk metrik (XP, skor, streak).
const round = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-round",
  display: "swap",
});
const code = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EnglishApp",
  description: "Belajar bahasa Inggris: EPrT, kosakata, grammar, dan tutor AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${body.variable} ${heading.variable} ${round.variable} ${code.variable}`}>
      <body>{children}</body>
    </html>
  );
}
