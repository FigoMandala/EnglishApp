import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin · EnglishApp" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell username={user.username}>{children}</AdminShell>;
}
