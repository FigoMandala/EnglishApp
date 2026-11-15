import localFont from "next/font/local";

import { AppShell } from "@/components/app-shell";
import { shellSummary } from "@/db/queries/shell";
import { requireUser } from "@/lib/session";

import { logout } from "./actions";

// Bricolage Grotesque (OFL) hanya dimuat untuk area app; .app-type di globals.css
// mengarahkan --font-display/--font-round ke sini. Landing/login/mulai tetap Gabarito.
const bricolage = localFont({
  src: "../fonts/bricolage-latin-var.woff2",
  variable: "--font-bricolage",
  display: "swap",
  weight: "500 800",
});

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const summary = await shellSummary(user.id);

  return (
    <div className={`${bricolage.variable} app-type`}>
      <AppShell
        username={user.username}
        displayName={user.displayName ?? ""}
        isAdmin={user.role === "admin"}
        summary={summary}
        logoutAction={logout}
      >
        {children}
      </AppShell>
    </div>
  );
}
