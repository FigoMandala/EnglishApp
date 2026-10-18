import { mistakeGroups } from "@/db/queries/drills";
import { requireUser } from "@/lib/session";

import { MistakeBank } from "./mistake-bank";

export const metadata = { title: "Bank Kesalahan · EnglishApp" };

export default async function KesalahanPage() {
  const user = await requireUser();
  const { groups, openTotal, correctTotal } = await mistakeGroups(user.id);
  return <MistakeBank groups={groups} openTotal={openTotal} correctTotal={correctTotal} />;
}
