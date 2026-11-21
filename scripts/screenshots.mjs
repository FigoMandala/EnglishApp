// Ambil screenshot halaman utama untuk README. Butuh dev server jalan.
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43111";
const OUT = "docs/screenshots";
const PAGES = [
  ["toefl", "/toefl"], ["latihan", "/latihan"], ["tutor", "/tutor"],
];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
const user = `siswa${Date.now() % 1000}`;
try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/landing.png` });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/login.png` });
  await page.waitForTimeout(4000);
  await page.getByRole("tab", { name: "Daftar" }).click();
  await page.fill("#username", user);
  await page.fill("#password", "rahasia12345");
  await page.fill("#confirm", "rahasia12345");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL("**/toefl", { timeout: 30000 });
  for (const [name, path] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("ok", name, page.url());
  }
} finally {
  await browser.close();
  const c = createClient({ url: process.env.DATABASE_URL ?? "file:./data/app.db" });
  await c.execute({ sql: "DELETE FROM users WHERE username = ?", args: [user] });
  c.close();
}
