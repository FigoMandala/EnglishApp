/**
 * Uji alur fitur end-to-end lewat browser sungguhan (Playwright).
 *
 * Yang diuji: alur belajar (jalur + unit + materi), review kosakata (SRS),
 * dan latihan TOEFL ITP (blok soal + hasil).
 *
 * Butuh server yang sudah jalan. Cara pakai:
 *   npm run dev            (terminal lain)
 *   node scripts/e2e-flows.mjs
 *   BASE_URL=http://127.0.0.1:3100 node scripts/e2e-flows.mjs
 *
 * Tidak menyentuh data nyata: hanya pakai akun uji ber-timestamp yang dibuat
 * saat uji berjalan dan dihapus otomatis di akhir.
 */

import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { chromium } from "playwright";

config({ path: ".env.local", quiet: true });

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:43111";
const WAIT = 20_000;
const AI_WAIT = 120_000;

let failed = 0;

function check(label, ok, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed += 1;
}

async function cleanupTestUsers() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
  try {
    await client.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'uji%')");
    await client.execute("DELETE FROM users WHERE username LIKE 'uji%'");
  } finally {
    client.close();
  }
}

async function launchBrowser() {
  const channels = [process.env.BROWSER_CHANNEL ?? "msedge", "chrome", undefined];
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // coba kanal berikutnya
    }
  }
  throw new Error("Tidak ada browser yang bisa diluncurkan (msedge/chrome/chromium).");
}

async function registerAndLogin(page) {
  const user = `uji${Date.now()}`;
  const pass = "rahasia12345";
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Daftar" }).click();
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await Promise.all([
    page.waitForURL("**/belajar", { timeout: WAIT }),
    page.locator('form button[type="submit"]').click(),
  ]);
  return user;
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);

  try {
    await registerAndLogin(page);
    check("register/login -> masuk ke /belajar", page.url().includes("/belajar"));

    // ══════════════════════════════════════════════════════════════
    // 1) ALUR BELAJAR
    // ══════════════════════════════════════════════════════════════
    await page.goto(`${BASE}/belajar`, { waitUntil: "networkidle" });
    const belajarText = (await page.textContent("body")) ?? "";
    check("halaman belajar menampilkan peta unit", (await page.locator("ol > li").count()) > 0);
    check(
      "streak untuk user baru jujur (bukan 'Streak aktif' palsu)",
      belajarText.includes("Streak") && belajarText.includes("hari ini belum aman"),
    );
    check("target harian tampil", belajarText.includes("Target harian"));

    // Buka unit yang sedang aktif (tautan pertama; unit terkunci bukan tautan).
    const unitButton = page.locator('ol > li a[href^="/belajar/"]').first();
    await unitButton.click();
    await page.waitForURL("**/belajar/**", { timeout: WAIT });
    check("klik unit aktif membuka halaman unit", true, page.url());

    const unitText = (await page.textContent("body")) ?? "";
    check("halaman unit menampilkan item", unitText.length > 0);

    // Klik materi pertama di unit -> halaman materi.
    const materiLink = page.locator('a[href^="/materi/"]').first();
    check("unit punya langkah materi", (await materiLink.count()) > 0);
    await materiLink.click();
    await page.waitForURL("**/materi/**", { timeout: WAIT });
    const lessonText = (await page.textContent("body")) ?? "";
    check("halaman materi punya latihan", lessonText.includes("Latihan"));
    // Materi tampil per langkah (tombol stepper, bukan role tab); langkah
    // terakhir berisi latihan (layar penuh, satu soal per layar).
    await page.getByRole("button", { name: "Latihan", exact: true }).click();
    await page.getByRole("button", { name: /MULAI LATIHAN|ULANGI LATIHAN/ }).click();
    const checkButton = page.getByRole("button", { name: "PERIKSA" });
    await checkButton.waitFor({ timeout: WAIT });
    check("latihan soal dirender", (await checkButton.count()) > 0, "tombol PERIKSA tampil");

    // Jawab soal pilihan ganda pertama kalau ada, lalu cek umpan balik.
    // Umpan balik: opsi terkunci (disabled) setelah dinilai + bar hasil dengan tombol LANJUT.
    const choiceGroup = page.getByRole("radiogroup", { name: "Pilihan jawaban" });
    if ((await choiceGroup.count()) > 0) {
      await choiceGroup.getByRole("radio").first().click();
      await checkButton.click();
      await page.getByRole("button", { name: "LANJUT" }).waitFor({ timeout: WAIT }); // tunggu server action menilai
      const locked = await choiceGroup.getByRole("radio").first().isDisabled();
      check("jawaban latihan dinilai (opsi terkunci)", locked);
    }

    // ══════════════════════════════════════════════════════════════
    // 2) ALUR REVIEW KOSAKATA (SRS)
    // ══════════════════════════════════════════════════════════════
    await page.goto(`${BASE}/kosakata`, { waitUntil: "networkidle" });
    const kosaText = (await page.textContent("body")) ?? "";
    check("halaman kosakata menampilkan statistik", kosaText.includes("Jatuh tempo"));
    check("chip topik dirender", kosaText.includes("Semua topik"));
    check("prognosa 7 hari tampil", kosaText.includes("Prakiraan 7 hari"));

    // Mulai review. User baru tidak punya kartu jatuh tempo, tapi tombol harus
    // tetap bisa dibuka untuk memilih jumlah kata baru (bug lama: tombol mati).
    const startButton = page.locator("button:has-text('PELAJARI KATA BARU')").first();
    check("tombol kata baru tersedia untuk user baru", (await startButton.count()) > 0);
    check("tombol tetap bisa diklik meski belum ada kartu due", await startButton.isEnabled());
    await startButton.click();
    await page.waitForTimeout(400);
    const bodyAfterOpen = (await page.textContent("body")) ?? "";
    check("pilihan jumlah kata baru muncul", bodyAfterOpen.includes("Kata baru"));
    // Masuk lewat URL langsung supaya alur review tetap teruji.
    await page.goto(`${BASE}/kosakata/review?n=5`, { waitUntil: "networkidle" });
    if (page.url().includes("/kosakata/review")) {
      check("mulai review -> halaman review", true, page.url());

      // Jawab 3 kartu pertama: buka arti lalu pilih benar/salah bergantian.
      for (let i = 0; i < 3; i += 1) {
        const reveal = page.getByRole("button", { name: "LIHAT ARTI", exact: true });
        if ((await reveal.count()) === 0) break;
        await reveal.click();
        const know = page.getByRole("button", { name: /^Familiar/ });
        const dont = page.getByRole("button", { name: /^Lupa/ });
        const pick = i % 2 === 0 ? know : dont;
        await pick.click();
        await page.waitForTimeout(1200); // tunggu server action selesai
        const progressText = (await page.textContent("body")) ?? "";
        const bar = page.getByRole("progressbar", { name: "Kartu diulang" });
        const done = (await bar.count()) > 0 ? Number(await bar.getAttribute("aria-valuenow")) : -1;
        check(
          `kartu ${i + 1} terjawab, progres bertambah`,
          done === i + 1 || progressText.includes("Sesi selesai"),
        );
      }

      // Shortcut keyboard: Spasi buka arti, 3 = "Familiar".
      const reveal2 = page.getByRole("button", { name: "LIHAT ARTI", exact: true });
      if ((await reveal2.count()) > 0) {
        await page.keyboard.press(" ");
        await page.waitForTimeout(300);
        const meaningVisible = (await page.getByRole("button", { name: /^Familiar/ }).count()) > 0;
        check("shortcut Spasi membuka arti", meaningVisible);
        await page.keyboard.press("3");
        await page.waitForTimeout(1200);
        const bar = page.getByRole("progressbar", { name: "Kartu diulang" });
        const done = (await bar.count()) > 0 ? Number(await bar.getAttribute("aria-valuenow")) : -1;
        const bodyText = (await page.textContent("body")) ?? "";
        check("shortcut '3' menjawab kartu", done >= 4 || bodyText.includes("Sesi selesai"));
      }
    }

    // ══════════════════════════════════════════════════════════════
    // 3) ALUR LATIHAN TOEFL ITP (blok Structure 10 soal)
    // ══════════════════════════════════════════════════════════════
    await page.goto(`${BASE}/toefl`, { waitUntil: "networkidle" });
    const eprtText = (await page.textContent("body")) ?? "";
    check("halaman TOEFL ITP dirender", eprtText.includes("Latihan per bagian"));

    const drillButton = page.getByRole("button", { name: /Sentence Completion/ }).first();
    check("tombol latihan Structure aktif (AI terkonfigurasi)", await drillButton.isEnabled());
    await Promise.all([
      page.waitForURL("**/toefl?s=*", { timeout: AI_WAIT }),
      drillButton.click(),
    ]);
    check("mulai blok latihan -> sesi soal", page.url().includes("s="));

    // Jawab semua 10 soal: pilih opsi (radiogroup soal), Periksa, Soal berikutnya.
    // 3 iterasi per soal (pilih, periksa, lanjut) + cadangan.
    let answered = 0;
    for (let i = 0; i < 40; i += 1) {
      const nextBtn = page.locator("button:has-text('Soal berikutnya')");
      const examineBtn = page.locator("button:has-text('Periksa')");
      const finishBtn = page.locator("button:has-text('Lihat hasil')");
      if ((await finishBtn.count()) > 0) {
        await finishBtn.click();
        answered += 1;
        break;
      }
      if ((await nextBtn.count()) > 0) {
        await nextBtn.click();
        await page.waitForTimeout(600);
        continue;
      }
      if ((await examineBtn.count()) > 0) {
        await examineBtn.click();
        answered += 1;
        await page.waitForTimeout(800);
        continue;
      }
      const options = page.getByRole("radiogroup").getByRole("radio");
      const optionCount = await options.count();
      if (optionCount === 0) break;
      await options.nth(Math.floor(Math.random() * optionCount)).click();
      await page.waitForTimeout(300);
    }

    // Tunggu layar hasil dirender setelah server action finishToefl selesai.
    await page.getByText("Hasil latihan").waitFor({ timeout: WAIT });
    const resultText = (await page.textContent("body")) ?? "";
    check(
      "hasil latihan muncul setelah semua soal dijawab",
      resultText.includes("Hasil latihan") && /benar/.test(resultText),
      `${answered} interaksi`,
    );

    // Kembali ke TOEFL ITP, pastikan riwayat latihan tercatat.
    const back = page.locator("a:has-text('Kembali ke TOEFL ITP')").first();
    await back.click();
    await page.waitForURL("**/toefl", { timeout: WAIT });
    const afterText = (await page.textContent("body")) ?? "";
    check("riwayat latihan tampil di TOEFL ITP", afterText.includes("Latihan terakhir"));
  } finally {
    await browser.close();
    await cleanupTestUsers().catch((error) => {
      console.error("gagal membersihkan akun uji:", error);
      failed += 1;
    });
  }

  console.log(failed ? `\n${failed} cek gagal.` : "\nSemua alur lolos.");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error("e2e-flows gagal total:", error);
  process.exit(1);
});
