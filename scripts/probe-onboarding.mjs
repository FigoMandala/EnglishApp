/**
 * Probe alur onboarding /mulai (sementara, untuk berburu bug):
 * tujuan -> level -> (penempatan) -> hasil -> target -> belajar.
 * Langkah onboarding maju lewat LINK "LANJUT" (bukan button), pilihan via
 * button aria-pressed di dalam role="group".
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43111";
const c = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/app.db",
  authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
});

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(20_000);
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));

const user = `uji${Date.now()}`;
let failures = 0;
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
};

/** Klik satu pilihan (button di role=group / aria-pressed) kalau ada. */
async function pilihSatu() {
  const choice = page.locator('div[role="group"] button, div[role="radiogroup"] button').first();
  if ((await choice.count()) > 0) {
    await choice.click().catch(() => {});
    return true;
  }
  return false;
}

/** Klik kontrol maju: link LANJUT (onboarding) / tombol primer / submit form. */
async function maju() {
  const nextLink = page.locator('a:has-text("LANJUT"), a:has-text("Lanjut")').first();
  if ((await nextLink.count()) > 0 && (await nextLink.isVisible())) {
    try {
      await nextLink.click({ timeout: 3_000 });
      return "link-lanjut";
    } catch {
      // Node bisa ter-detach karena re-render; klik via JS sebagai fallback.
      const jsClicked = await page.evaluate(() => {
        const a = [...document.querySelectorAll("a")].find((el) => /^lanjut$/i.test(el.textContent?.trim() ?? ""));
        if (!a) return false;
        a.click();
        return true;
      });
      if (jsClicked) return "link-lanjut-js";
    }
  }
  for (const name of ["PERIKSA", "MULAI", "SIMPAN", "PROSES", "LANJUTKAN"]) {
    const btn = page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first();
    if ((await btn.count()) > 0 && (await btn.isEnabled())) {
      await btn.click({ timeout: 3_000 }).catch(async () => {
        await page.evaluate((n) => {
          const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith(n));
          b?.click();
        }, name);
      });
      return name;
    }
  }
  const submit = page.locator('form button[type="submit"], main button[type="submit"]').first();
  if ((await submit.count()) > 0 && (await submit.isEnabled())) {
    await submit.click({ timeout: 3_000 }).catch(() => {});
    return "submit";
  }
  return null;
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Buat akun" }).click();
  await page.fill("#username", user);
  await page.fill("#password", "rahasia12345");
  await Promise.all([page.waitForURL("**/belajar"), page.locator('form button[type="submit"]').click()]);
  check("register -> /belajar", page.url().includes("/belajar"));

  await page.goto(`${BASE}/mulai/tujuan`, { waitUntil: "networkidle" });
  check("halaman tujuan dirender", (((await page.textContent("main")) ?? "").length) > 50);

  let steps = 0;
  const stall = [];
  // Tujuan akhir probe: sampai halaman hasil (form simpan) — pengguna login
  // tidak melalui /mulai lagi, jadi /belajar bukan kriteria yang tepat.
  while (steps < 30 && !page.url().includes("/mulai/hasil")) {
    steps += 1;
    const urlBefore = page.url();
    const path = urlBefore.replace(BASE, "");

    if (path.includes("/mulai/penempatan")) {
      // Urutan state: pertanyaan (BELUM TAHU + PERIKSA) -> feedback (LANJUT) -> dst.
      const lanjutFeedback = page.locator('a:has-text("LANJUT"), button:has-text("LANJUT")').first();
      if ((await lanjutFeedback.count()) > 0) {
        await lanjutFeedback.click({ timeout: 3_000 }).catch(() => {});
        await page.waitForTimeout(900);
        continue;
      }
      const lihatHasil = page.getByRole("button", { name: /LIHAT HASIL/i });
      if ((await lihatHasil.count()) > 0) {
        await lihatHasil.click();
        await page.waitForTimeout(1_200);
        continue;
      }
      const belum = page.getByRole("button", { name: /BELUM TAHU/i });
      const periksa = page.getByRole("button", { name: /^PERIKSA/i });
      const options = page.getByRole("radio");
      if ((await belum.count()) > 0 && steps % 3 === 0) {
        await belum.click({ timeout: 3_000 });
        await page.waitForTimeout(600);
        continue;
      }
      if ((await periksa.count()) > 0 && (await options.count()) > 0) {
        await options.first().click();
        await page.waitForTimeout(250);
        await periksa.click({ timeout: 3_000 });
        await page.waitForTimeout(700);
        continue;
      }
      // Layar pembuka penempatan
      await maju();
      await page.waitForTimeout(800);
      continue;
    }

    await pilihSatu();
    await page.waitForTimeout(300);
    const moved = await maju();
    if (!moved) {
      stall.push(path);
      console.log("  BERHENTI di", path, "— tidak ada kontrol maju");
      break;
    }
    await page.waitForTimeout(1_100);
    if (page.url() === urlBefore) {
      stall.push(path + " (tidak pindah)");
      console.log("  STALL di", path, "setelah klik:", moved);
      if (stall.length >= 3) break;
    }
  }
  console.log("  langkah:", steps, "| url akhir:", page.url().replace(BASE, ""));
  check("alur /mulai selesai (sampai halaman hasil)", page.url().includes("/mulai/hasil"), stall.join(" | ").slice(0, 120));

  // Onboarding tersimpan? Buka profil/progres lalu cek level di belajar
  await page.goto(`${BASE}/progres`, { waitUntil: "networkidle" });
  check("/progres render", (((await page.textContent("main")) ?? "").length) > 100);
  await page.goto(`${BASE}/streak`, { waitUntil: "networkidle" });
  check("/streak render", (((await page.textContent("main")) ?? "").length) > 100);

  check("tanpa error konsol/pageerror", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  for (let i = 0; i < 5; i += 1) {
    try {
      await c.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'uji%')");
      await c.execute("DELETE FROM users WHERE username LIKE 'uji%'");
      await c.execute("DELETE FROM rate_limits");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  c.close();
}
console.log(failures ? `\n${failures} cek gagal` : "\nalur onboarding sehat");
process.exit(failures ? 1 : 0);
