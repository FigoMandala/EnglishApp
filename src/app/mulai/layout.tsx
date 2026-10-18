import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mulai belajar · EnglishApp" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
