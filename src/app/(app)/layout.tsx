import { AppShell } from "@/components/app-shell";
import { shellSummary } from "@/db/queries/shell";
import { requireUser } from "@/lib/session";

import { logout } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const summary = await shellSummary(user.id);

  return (
    <AppShell
      username={user.username}
      displayName={user.displayName ?? ""}
      isAdmin={user.role === "admin"}
      summary={summary}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
