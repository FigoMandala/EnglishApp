import "./load-env";

import { eq } from "drizzle-orm";

import { db } from "./index";
import { deleteSessionsByUserId } from "./queries/auth";
import { users } from "./schema";
import { hashPassword } from "@/lib/password";

const USERNAME = (process.env.ADMIN_USERNAME ?? "admin").trim();
// Password wajib eksplisit. Tanpa ini, satu `db:admin` yang lupa isi env akan
// mengembalikan password admin ke nilai bawaan yang diketahui siapa saja.
const PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? "";

if (!PASSWORD) {
  console.error("ADMIN_PASSWORD wajib diisi di .env.local (lokal) atau .env.production.local (produksi).");
  process.exit(1);
}

async function main() {
  const lower = USERNAME.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.usernameLower, lower)).limit(1);

  if (existing) {
    const updates: { role?: "admin"; passwordHash?: string } = {};
    if (existing.role !== "admin") updates.role = "admin";
    updates.passwordHash = await hashPassword(PASSWORD);
    await db.update(users).set(updates).where(eq(users.id, existing.id));
    // Rotasi sandi tanpa mencabut sesi = cookie curian tetap berlaku sampai
    // 30 hari; logout paksa semua perangkat adalah bagian dari rotasi.
    await deleteSessionsByUserId(existing.id);
    console.log(`Admin "${existing.username}" diperbarui (${Object.keys(updates).join(", ")}); semua sesinya dicabut.`);
    return;
  }

  await db.insert(users).values({
    username: USERNAME,
    usernameLower: lower,
    passwordHash: await hashPassword(PASSWORD),
    displayName: "Administrator",
    role: "admin",
  });
  console.log(`Admin dibuat: username="${USERNAME}"`);
  console.log("Password diambil dari ADMIN_PASSWORD dan tidak dicetak ke terminal.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
