import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SITE_CLOSED } from "@/lib/site-lock";

export const metadata: Metadata = { title: "Mulai belajar · EnglishApp" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Onboarding berujung ke pendaftaran, yang sedang dikunci.
  if (SITE_CLOSED) redirect("/login");
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
