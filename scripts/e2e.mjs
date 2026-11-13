/**
 * Uji alur auth end-to-end lewat browser sungguhan (Playwright + Edge).
 *
 * Butuh server yang sudah jalan. Cara pakai:
 *   npm run dev            (terminal lain)
 *   npm run e2e
 *   BASE_URL=http://127.0.0.1:3100 npm run e2e   (kalau port beda)
 *
 * Tidak menyentuh data nyata: hanya pakai akun uji ber-timestamp yang dibuat
 * saat uji berjalan.
 */

import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43111";
const WAIT = 20000;

let failed = 0;

function check(label, ok) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

async function cleanupTestUsers() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
  try {
    await client.execute("DELETE FROM users WHERE username LIKE 'uji%'");
  } finally {
    client.close();
  }
}

async function submitAuth(page) {
  const response = page
    .waitForResponse((r) => r.request().method() === "POST", { timeout: WAIT })
    .catch(() => null);
  await page.locator('form button[type="submit"]').click();
  await response;
}

async function logout(page) {
  const response = page
    .waitForResponse((r) => r.request().method() === "POST", { timeout: WAIT })
    .catch(() => null);
  // Desktop menampilkan sidebar (header mobile tersembunyi di lg).
  await page.getByRole("button", { name: "Keluar" }).click();
  await response;
}

async function fillAuth(page, username, password) {
  await page.fill("#username", username);
  await page.fill("#password", password);
}

async function waitForError(page) {
  await page.waitForSelector("#auth-error p", { timeout: WAIT });
  return (await page.textContent("#auth-error")) ?? "";
}

async function gotoSettled(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const page = await browser.newPage();

try {
  const user = `uji${Date.now()}`;
  const pass = "rahasia12345";

  await gotoSettled(page, "/kosakata");
  check("belum login -> area app diarahkan ke /login", page.url().includes("/login"));

  await page.getByRole("tab", { name: "Buat akun" }).click();
  await fillAuth(page, "ab", pass);
  await submitAuth(page);
  check("username terlalu pendek ditolak", (await waitForError(page)).includes("minimal"));

  await fillAuth(page, user, "123");
  await submitAuth(page);
  check("password terlalu pendek ditolak", (await waitForError(page)).includes("minimal"));

  await fillAuth(page, "ab!", pass);
  await submitAuth(page);
  check("karakter ilegal ditolak", (await waitForError(page)).includes("huruf, angka"));

  await fillAuth(page, user, pass);
  await submitAuth(page);
  await page.waitForURL("**/eptr", { timeout: WAIT });
  check("register -> masuk halaman EPrT", page.url().includes("/eptr"));
  check("beranda menampilkan user", (await page.textContent("body")).includes(user));

  const session = (await page.context().cookies()).find((c) => c.name === "english_session");
  check("cookie sesi dibuat", Boolean(session));
  check("cookie sesi httpOnly", session?.httpOnly === true);

  await logout(page);
  await page.waitForURL("**/login", { timeout: WAIT });
  check("logout -> kembali ke /login", page.url().includes("/login"));

  await gotoSettled(page, "/kosakata");
  check("setelah logout area app terkunci lagi", page.url().includes("/login"));

  await page.getByRole("tab", { name: "Masuk" }).click();
  await fillAuth(page, user, "password-salah");
  await submitAuth(page);
  check("password salah ditolak", (await waitForError(page)).includes("salah"));
  check("masih di /login setelah gagal", page.url().includes("/login"));

  await fillAuth(page, user, pass);
  await submitAuth(page);
  await page.waitForURL("**/eptr", { timeout: WAIT });
  check("login ulang dengan password benar", page.url().includes("/eptr"));

  await logout(page);
  await page.waitForURL("**/login", { timeout: WAIT });

  await page.getByRole("tab", { name: "Buat akun" }).click();
  await fillAuth(page, user.toUpperCase(), pass);
  await submitAuth(page);
  check(
    "username duplikat ditolak (tanpa peduli huruf besar/kecil)",
    (await waitForError(page)).includes("dipakai"),
  );

  await page.getByRole("tab", { name: "Masuk" }).click();
  await fillAuth(page, `takada${Date.now()}`, pass);
  await submitAuth(page);
  check("akun yang belum ada ditolak", (await waitForError(page)).includes("salah"));

  await fillAuth(page, user, pass);
  await submitAuth(page);
  await page.waitForURL("**/eptr", { timeout: WAIT });
  check("login terakhir masih bisa", page.url().includes("/eptr"));
} finally {
  await browser.close();
  await cleanupTestUsers().catch((error) => {
    console.error("gagal membersihkan akun uji:", error);
    failed += 1;
  });
}

console.log(failed ? `\n${failed} cek gagal.` : "\nSemua alur lolos.");
process.exit(failed ? 1 : 0);
