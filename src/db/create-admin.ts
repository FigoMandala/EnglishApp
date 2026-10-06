import "./load-env";

import { eq } from "drizzle-orm";

import { db } from "./index";
import { users } from "./schema";
import { hashPassword } from "@/lib/password";

const USERNAME = (process.env.ADMIN_USERNAME ?? "admin").trim();
const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin12345678";

async function main() {
  const lower = USERNAME.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.usernameLower, lower)).limit(1);

  if (existing) {
    const updates: { role?: "admin"; passwordHash?: string } = {};
    if (existing.role !== "admin") updates.role = "admin";
    updates.passwordHash = await hashPassword(PASSWORD);
    if (Object.keys(updates).length) {
      await db.update(users).set(updates).where(eq(users.id, existing.id));
      console.log(`Admin "${existing.username}" diperbarui (${Object.keys(updates).join(", ")}).`);
    } else {
      console.log(`Admin "${existing.username}" sudah ada, dilewati.`);
    }
    return;
  }

  await db.insert(users).values({
    username: USERNAME,
    usernameLower: lower,
    passwordHash: await hashPassword(PASSWORD),
    displayName: "Administrator",
    role: "admin",
  });
  console.log(`Admin dibuat: username="${USERNAME}" password="${PASSWORD}"`);
  console.log("Segera ganti password lewat .env atau daftar ulang bila ini produksi.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
