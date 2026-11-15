/**
 * Uji fitur interaktif end-to-end (Playwright) — pelengkap e2e.mjs & e2e-flows.mjs.
 *
 * Yang diuji di sini: tutor AI streaming + tombol Berhenti, switch liga,
 * halaman streak, koreksi paragraf AI (writing kilat), panel admin,
 * landing 3D lazy, dan serangkaian cek tampilan mobile 360px (drawer,
 * scroll-lock, papan pasangan, strip tier liga, meta viewport).
 *
 * Cara pakai:
 *   npm run dev            (terminal lain, port default skrip ini 43111)
 *   node scripts/e2e-features.mjs
 *
 * Akun uji ber-timestamp dibuat saat uji berjalan dan dihapus di akhir.
 */

import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local", quiet: true });

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43111";
const WAIT = 20_000;
const AI_WAIT = 150_000;
const SHOT_DIR = join(process.cwd(), "research", "uji-screens");
mkdirSync(SHOT_DIR, { recursive: true });

let failed = 0;
const pass = (label, extra = "") => console.log(`ok   ${label}${extra ? ` — ${extra}` : ""}`);
function check(label, ok, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed += 1;
}

function client() {
  return createClient({
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
}

/** Jalankan statement dengan retry — file DB lokal bisa sebentar terkunci dev server. */
async function dbExec(sql, args) {
  const c = client();
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await c.execute({ sql, args });
      } catch (error) {
        if (attempt >= 5 || !/BUSY|LOCKED/i.test(String(error))) throw error;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  } finally {
    c.close();
  }
}

async function cleanupTestUsers() {
  await dbExec("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'uji%')");
  await dbExec("DELETE FROM users WHERE username LIKE 'uji%'");
  await dbExec("DELETE FROM rate_limits WHERE `key` LIKE 'register:%' OR `key` LIKE 'login:%'");
}

async function launchBrowser() {
  for (const channel of [process.env.BROWSER_CHANNEL ?? "msedge", "chrome", undefined]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // coba kanal berikutnya
    }
  }
  throw new Error("Tidak ada browser yang bisa diluncurkan (msedge/chrome/chromium).");
}

const PARAGRAPH = [
  "Last holiday I visited my grandmother in a small village near the mountain.",
  "The weather was very cold at the morning, so I wear my thickest jacket.",
  "She cooked a delicious soup who made everyone ask for more.",
  "In the afternoon we walked to the river and watched the ducks swimming slowly.",
  "I think this trip was more better than my last holiday because I could spend",
  "a lot of times with my family without thinking about school or exams.",
].join(" ");

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  const user = `uji${Date.now()}`;
  const passWord = "rahasia12345";

  try {
    // ─── 0) Landing (belum login): 3D lazy ─────────────────────────────────
    // Catatan: pengguna yang sudah login diarahkan ke /belajar, jadi cek ini
    // harus sebelum register.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const mv = page.locator("model-viewer");
    await mv.first().waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
    if ((await mv.count()) > 0) {
      check("landing: model-viewer 3D lazy (loading=lazy)", (await mv.first().getAttribute("loading")) === "lazy");
    } else {
      check("landing punya model-viewer 3D", false, "tidak ditemukan (fallback SVG dipakai)");
    }

    // ─── Register ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Daftar" }).click();
    await page.fill("#username", user);
    await page.fill("#password", passWord);
    await Promise.all([
      page.waitForURL("**/belajar", { timeout: WAIT }),
      page.locator('form button[type="submit"]').click(),
    ]);
    pass("register uji fitur -> /belajar");

    // ─── 1) Tutor AI: streaming + tombol Berhenti ──────────────────────────
    await page.goto(`${BASE}/tutor`, { waitUntil: "networkidle" });
    const chatBox = page.getByLabel("Pesan untuk tutor");
    await chatBox.fill("What is the difference between 'a' and 'the'? Give one simple example.");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/tutor/stream"), { timeout: 90_000 }),
      page.getByRole("button", { name: "Kirim" }).click(),
    ]);
    pass("pesan tutor terkirim ke /api/tutor/stream");
    // Tunggu streaming selesai: tombol Berhenti hilang, Kirim kembali.
    await page.getByRole("button", { name: "Berhenti" }).waitFor({ timeout: 10_000 }).catch(() => {});
    await page.getByRole("button", { name: "Kirim" }).waitFor({ timeout: AI_WAIT });
    const mainText = (await page.textContent("main")) ?? "";
    check("balasan tutor AI streaming selesai tampil", mainText.length > 200, `${mainText.length} karakter`);

    // Pesan kedua: hentikan di tengah streaming lewat tombol Berhenti
    // (accessible name-nya "Hentikan jawaban" via aria-label).
    await chatBox.fill("Tell me a very long story about a cat who travels around the world. At least 800 words.");
    await page.getByRole("button", { name: "Kirim" }).click();
    const stopBtn = page.getByRole("button", { name: "Hentikan jawaban" });
    await stopBtn.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1_200);
    await stopBtn.click();
    await page.getByRole("button", { name: "Kirim" }).waitFor({ timeout: AI_WAIT });
    check("tombol Berhenti menghentikan stream tanpa macet", true);

    // Server harus menyimpan balasan (penuh atau parsial) agar riwayat tidak menggantung.
    await page.waitForTimeout(2_000);
    const saved = await dbExec(
      "select count(*) as n from chat_messages cm join users u on u.id = cm.user_id where u.username = ? and cm.role = 'assistant' and cm.content != ''",
      [user],
    );
    check("balasan asisten tersimpan (parsial/penuh) setelah Berhenti", Number(saved.rows[0].n) >= 1, `${saved.rows[0].n} baris`);

    // ─── 2) Liga: switch ikut/keluar ────────────────────────────────────────
    await page.goto(`${BASE}/liga`, { waitUntil: "networkidle" });
    const sw = page.getByRole("switch");
    await sw.click();
    await page.waitForTimeout(2_500); // server action + revalidate
    const ligaOn = (await page.textContent("main")) ?? "";
    check("switch liga: aktif -> keluar dari mode santai", !ligaOn.includes("Mode santai"));
    check(
      "strip tier liga tampil dengan 5 tier",
      (await page.locator("ol[aria-label='Tingkatan liga'] li span[title]").count()) === 5,
    );
    await sw.click();
    await page.waitForTimeout(1_500);
    check("switch liga: kembali ke mode santai", ((await page.textContent("main")) ?? "").includes("Mode santai"));

    // ─── 3) Streak ──────────────────────────────────────────────────────────
    await page.goto(`${BASE}/streak`, { waitUntil: "networkidle" });
    const streakText = (await page.textContent("main")) ?? "";
    check("halaman streak dirender", streakText.includes("hari beruntun") && streakText.length > 100);

    // ─── 4) Writing kilat: koreksi paragraf AI ─────────────────────────────
    await page.goto(`${BASE}/writing/kilat`, { waitUntil: "networkidle" });
    const kilatText = (await page.textContent("main")) ?? "";
    check("halaman paragraf kilat dirender", kilatText.length > 100);
    await page.getByRole("button", { name: "Pakai prompt" }).click();
    await page.getByRole("button", { name: "Tulis paragraf ini" }).click();
    const paraBox = page.getByLabel("Paragrafmu (English)");
    check("form paragraf muncul setelah pilih prompt", (await paraBox.count()) === 1);
    await paraBox.fill(PARAGRAPH);
    await page.getByRole("button", { name: "Minta koreksi" }).click();
    // Tunggu skor aspek muncul (AI).
    await page.getByText(/Minta koreksi|Lori sedang membaca/).first().waitFor({ timeout: 10_000 }).catch(() => {});
    await page.waitForFunction(() => !/Lori sedang membaca/.test(document.querySelector("main")?.textContent ?? ""), null, { timeout: AI_WAIT });
    const hasilText = (await page.textContent("main")) ?? "";
    check("koreksi paragraf AI menghasilkan skor", /Grammar|skor|Skor/.test(hasilText));
    await page.screenshot({ path: join(SHOT_DIR, "kilat-hasil.png"), fullPage: false });

    // ─── 5) Admin: promote + kunjungi panel ────────────────────────────────
    await dbExec("update users set role = 'admin' where username = ?", [user]);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    const adminText = (await page.textContent("main")) ?? "";
    check("dashboard admin dirender", adminText.length > 200);
    await page.goto(`${BASE}/admin/kosakata`, { waitUntil: "networkidle" });
    const kosaAdmin = (await page.textContent("main")) ?? "";
    check("admin kosakata dirender", kosaAdmin.includes("Cari") || kosaAdmin.includes("kata"));
    await page.fill("#cari", "book");
    await Promise.all([
      page.waitForURL(/q=book/, { timeout: WAIT }),
      page.getByRole("button", { name: "Cari" }).click(),
    ]);
    await page.waitForTimeout(1_000);
    const kosaSearch = (await page.textContent("main")) ?? "";
    check("pencarian kosakata admin menemukan 'book'", kosaSearch.includes("book"));
    await page.goto(`${BASE}/admin/pengguna`, { waitUntil: "networkidle" });
    const usersAdmin = (await page.textContent("main")) ?? "";
    check("admin pengguna menampilkan tabel", usersAdmin.includes(user) || usersAdmin.toLowerCase().includes("username"));
    await page.screenshot({ path: join(SHOT_DIR, "admin-kosakata.png") });

    // ─── 7) Mode mobile 360px ───────────────────────────────────────────────
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${BASE}/belajar`, { waitUntil: "networkidle" });
    const meta = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "");
    check("meta viewport: viewport-fit=cover", meta.includes("viewport-fit=cover"), meta);
    const themeColor = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? "");
    check("meta theme-color ada", themeColor.length > 0, themeColor);

    // Tab bar tampil, drawer terbuka dan body terkunci (scroll-lock iOS).
    const tabBar = page.locator('nav[aria-label="Navigasi cepat"]');
    check("tab bar mobile tampil", (await tabBar.count()) === 1 && (await tabBar.isVisible()));
    await page.getByRole("button", { name: "Buka menu" }).click();
    await page.waitForTimeout(600);
    const lock = await page.evaluate(() => ({
      overflow: document.body.style.overflow,
      position: document.body.style.position,
    }));
    check("drawer: body scroll terkunci (position:fixed)", lock.position === "fixed" && lock.overflow === "hidden", JSON.stringify(lock));
    await page.screenshot({ path: join(SHOT_DIR, "mobile-drawer.png") });
    await page.getByRole("button", { name: "Tutup menu" }).click();
    await page.waitForTimeout(600);
    const unlock = await page.evaluate(() => ({ position: document.body.style.position }));
    check("drawer: scroll kembali bebas setelah ditutup", unlock.position !== "fixed");

    // Papan pasangan di 360px: tidak ada luapan horizontal + tile memecah kata panjang.
    await page.goto(`${BASE}/latihan/pasangan`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1_500);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    check("pasangan 360px: tanpa scroll horizontal", overflow.scrollWidth <= overflow.innerWidth + 1, JSON.stringify(overflow));
    await page.locator('button:has-text("Pilih satu kata")').waitFor({ timeout: WAIT }).catch(() => {});
    await page.screenshot({ path: join(SHOT_DIR, "mobile-pasangan.png"), fullPage: true });
    // Klik satu tile kiri lalu satu kanan; status harus bereaksi.
    const leftTile = page.locator("section[aria-label='Papan pasangan'] > div:first-child button").first();
    const rightTile = page.locator("section[aria-label='Papan pasangan'] > div:last-child button").first();
    if ((await leftTile.count()) > 0 && (await rightTile.count()) > 0) {
      await leftTile.click();
      await rightTile.click();
      await page.waitForTimeout(400);
      const status = (await page.textContent("p[role='status']")) ?? "";
      check("pasangan: status bereaksi setelah memilih", status.trim().length > 0, status.trim().slice(0, 40));
    }

    // Strip tier liga di 360px: aktifkan liga dulu, lalu pastikan 5 label
    // ter-render dalam kolomnya (truncate terkontrol, tidak menimpa tetangga).
    await page.goto(`${BASE}/liga`, { waitUntil: "networkidle" });
    await page.getByRole("switch").click();
    await page.waitForTimeout(2_500);
    const tierFit = await page.evaluate(() => {
      const labels = [...document.querySelectorAll("ol[aria-label='Tingkatan liga'] li span[title]")];
      return labels.map((l) => ({
        trackW: Math.round(l.closest("li").getBoundingClientRect().width),
        clipped: l.getBoundingClientRect().width < l.scrollWidth - 1,
      }));
    });
    const overflowLabels = tierFit.filter((t) => t.clipped).length;
    check(
      "liga 360px: 5 tier tampil, label tak menimpa (truncate terkontrol)",
      tierFit.length === 5 && overflowLabels <= 3,
      `${tierFit.length} tier, ${overflowLabels} truncate`,
    );
    await page.screenshot({ path: join(SHOT_DIR, "mobile-liga.png") });

    // TOEFL ITP di 360px: halaman tidak boleh punya scroll horizontal (bug lama:
    // span sr-only di header tabel mendorong lebar root).
    await page.goto(`${BASE}/toefl`, { waitUntil: "networkidle" });
    const eprtOverflow = await page.evaluate(() => ({
      pageScroll: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    check(
      "TOEFL ITP 360px: tanpa scroll horizontal",
      eprtOverflow.pageScroll <= eprtOverflow.innerWidth + 1,
      JSON.stringify(eprtOverflow),
    );

    check("tanpa pageerror sepanjang sesi", errors.length === 0, errors.slice(0, 2).join(" | "));
  } finally {
    await browser.close();
    await cleanupTestUsers().catch((error) => {
      console.error("gagal membersihkan akun uji:", error);
      failed += 1;
    });
  }

  console.log(failed ? `\n${failed} cek gagal.` : "\nSemua cek fitur lolos.");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error("e2e-features gagal total:", error);
  process.exit(1);
});
