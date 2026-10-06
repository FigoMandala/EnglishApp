import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";

import { logout } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell
      username={user.username}
      isAdmin={user.role === "admin"}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
