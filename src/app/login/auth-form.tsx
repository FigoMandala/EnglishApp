"use client";

import { Eye, EyeOff, Loader2, Lock, ShieldCheck, Timer, TriangleAlert, User } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { login, register, type AuthState } from "@/app/auth-actions";
import { Logo } from "@/components/logo";
import { Lori, type LoriMood } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { SITE_CLOSED } from "@/lib/site-lock";
import { cn } from "@/lib/utils";
import { validatePassword, validateUsername } from "@/lib/validation";

const initialState: AuthState = {};

// Kekuatan kata sandi: 0 = kosong, 1 lemah … 4 mantap (sama dengan desain Lori).
function passwordStrength(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/\d/.test(p) && /[a-zA-Z]/.test(p)) s++;
  if (/[A-Z]/.test(p) && /[^a-zA-Z0-9]/.test(p)) s++;
  return Math.max(1, s);
}
const STRENGTH_LABEL = ["", "Lemah", "Lumayan", "Kuat", "Mantap"];
const STRENGTH_COLOR = ["bg-brick", "bg-mango-deep", "bg-primary-bright", "bg-primary"];
// Warna teks label: padanan segmen, tapi lebih gelap supaya kontrasnya cukup di atas kanvas.
const STRENGTH_TEXT = ["text-brick-deep", "text-mango-ink", "text-primary", "text-primary-deep"];

const IDLE_LINES = [
  "Halo lagi! Lori kangen.",
  "Siap lanjut streak hari ini?",
  "Ada kata baru yang menunggu!",
  "Tiga menit aja, yuk!",
  "Hello again! Ready to learn?",
  "Kartumu sudah siap diulang.",
];
const DAFTAR_LINES = [
  "Teman belajar baru? Asik!",
  "Nice to meet you!",
  "Lori bakal nemenin tiap hari.",
  "Mulai dari kata sederhana, ya.",
  "Gratis, dan nggak ribet.",
];

type FieldErrors = { username?: string; password?: string; confirm?: string };

const iconCls = "pointer-events-none absolute left-4 top-[15px] size-[22px] text-ink-faint";

export function AuthScreen({ notice }: { notice?: React.ReactNode }) {
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Pesan server disembunyikan begitu pengguna mulai mengetik lagi; submit menampilkannya kembali.
  const [dirty, setDirty] = useState(false);
  const [tick, setTick] = useState(0);
  const [loginState, loginAction, loginPending] = useActionState(login, initialState);
  const [registerState, registerAction, registerPending] = useActionState(register, initialState);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4500);
    return () => clearInterval(id);
  }, []);

  const daftar = mode === "daftar" && !SITE_CLOSED;
  const pending = daftar ? registerPending : loginPending;
  // Galat lama juga disembunyikan selama kiriman berikutnya diproses (desain: state loading bersih).
  const serverError = dirty || pending ? undefined : (daftar ? registerState : loginState).error;
  const clientCount = Object.values(fieldErrors).filter(Boolean).length;
  const bannerMessage = clientCount
    ? clientCount === 1
      ? "Ada 1 isian yang perlu dibetulkan."
      : `Ada ${clientCount} isian yang perlu dibetulkan.`
    : serverError;
  const hasError = Boolean(bannerMessage);
  const strength = passwordStrength(password);

  const usernameLive = validateUsername(username);
  const usernameOk = daftar && Boolean(username) && !usernameLive && !fieldErrors.username;

  function edit(field: keyof FieldErrors, set: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      set(e.target.value);
      setDirty(true);
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function switchMode(next: "masuk" | "daftar") {
    setMode(next);
    setFieldErrors({});
    setConfirm("");
    setDirty(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors: FieldErrors = {};
    const u = validateUsername(username);
    const p = validatePassword(password);
    if (u) errors.username = u;
    if (p) errors.password = p;
    if (daftar && !p && confirm !== password) errors.confirm = "Belum sama dengan kata sandi di atas.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      event.preventDefault();
      return;
    }
    setDirty(false);
  }

  // Lori bereaksi pada apa yang sedang dilakukan pengguna.
  const covering = pwFocus && !showPassword && !pending;
  const peeking = pwFocus && showPassword && !pending;
  const lines = daftar ? DAFTAR_LINES : IDLE_LINES;
  let mood: LoriMood = SITE_CLOSED ? "sad" : "wave";
  let bubble = lines[tick % lines.length];
  if (covering) [mood, bubble] = ["cover", "Tenang, Lori nggak ngintip."];
  else if (peeking) [mood, bubble] = ["idle", "Eh, kelihatan… Lori ngintip dikit."];
  if (pending) [mood, bubble] = ["think", daftar ? "Sebentar, Lori siapkan akunmu…" : "Sebentar, Lori cek dulu…"];
  if (hasError) [mood, bubble] = ["sad", "Waduh, belum cocok. Coba lagi, ya!"];

  const eyebrow = hasError
    ? "Ups"
    : SITE_CLOSED
      ? "Dalam pengembangan"
      : daftar
        ? "Akun baru"
        : "Selamat datang kembali";
  const heroTitle = hasError
    ? "Salah sedikit itu wajar. Coba sekali lagi."
    : SITE_CLOSED
      ? "Lori lagi sibuk menyiapkan pelajaran. Segera hadir!"
      : daftar
        ? "Mulai belajar bahasa Inggris, sedikit-sedikit tiap hari."
        : "Belajar bahasa Inggris, sedikit-sedikit tiap hari.";

  const fieldCls = "pl-12";

  // Gulir ada di <main> dan batangnya disembunyikan: pindah ke Daftar (form lebih tinggi) tidak lagi
  // memunculkan scrollbar yang menggeser lebar halaman.
  return (
    <main className="flex h-dvh flex-wrap overflow-y-auto bg-canvas [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-0 flex-[1_1_520px] flex-col px-4 pb-10 pt-7 sm:px-10">
        <Logo href="/" size={40} />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="page-enter flex w-full max-w-[440px] flex-col gap-[22px]">
            {notice}

            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[2.625rem] font-black leading-[1.08] tracking-[-0.03em]">
                {SITE_CLOSED ? "Masuk admin" : daftar ? "Buat akun" : "Masuk lagi"}
              </h1>
              {SITE_CLOSED ? null : (
                <p className="text-[1.0625rem] leading-relaxed text-ink-muted">
                  {daftar ? "Gratis. Cukup username dan kata sandi." : "Lanjutkan streak dan kartu yang menunggu diulang."}
                </p>
              )}
            </div>

            {SITE_CLOSED ? null : (
              <div role="tablist" className="relative flex rounded-[16px] bg-hairline/60 p-[5px]">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-[5px] left-[5px] w-[calc(50%-5px)] rounded-[12px] bg-surface shadow-[0_3px_0_var(--color-hairline-strong)] transition-transform duration-[380ms] [transition-timing-function:var(--ease-spring)]",
                    daftar && "translate-x-full",
                  )}
                />
                {(["masuk", "daftar"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => switchMode(value)}
                    className={cn(
                      "relative z-[1] h-11 flex-1 cursor-pointer rounded-[12px] font-display text-base font-extrabold transition-colors",
                      mode === value ? "text-ink" : "text-ink-subtle",
                    )}
                  >
                    {value === "masuk" ? "Masuk" : "Daftar"}
                  </button>
                ))}
              </div>
            )}

            {bannerMessage ? (
              <div
                role="alert"
                className="pop shake flex items-start gap-3 rounded-[16px] border-2 border-brick-line bg-brick-soft px-4 py-3.5 text-brick-deep"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brick text-white">
                  <TriangleAlert className="size-[18px]" aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <strong className="font-display text-[1.0625rem] font-extrabold">
                    {daftar ? "Pendaftaran belum berhasil" : "Belum bisa masuk"}
                  </strong>
                  <span className="text-[0.9375rem] leading-snug">{bannerMessage}</span>
                </span>
              </div>
            ) : null}

            <form
              action={daftar ? registerAction : loginAction}
              onSubmit={handleSubmit}
              className="flex flex-col gap-[18px]"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className={iconCls} aria-hidden />
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    placeholder={daftar ? "contoh: rani_belajar" : "Username"}
                    value={username}
                    onChange={edit("username", setUsername)}
                    disabled={pending}
                    aria-invalid={Boolean(fieldErrors.username) || (hasError && !clientCount)}
                    aria-describedby="username-help"
                    className={cn(fieldCls, usernameOk && "border-primary-line", "pr-12")}
                  />
                  {usernameOk ? (
                    <span
                      aria-hidden
                      className="pop absolute right-3.5 top-[13px] flex size-[26px] items-center justify-center rounded-full bg-primary text-white"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    </span>
                  ) : null}
                </div>
                <span
                  id="username-help"
                  className={cn("min-h-5 text-[0.875rem]", fieldErrors.username ? "text-brick-deep" : "text-ink-subtle")}
                >
                  {fieldErrors.username ??
                    (daftar ? (username && usernameLive ? usernameLive : "3–24 karakter: huruf, angka, garis bawah.") : "")}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Kata sandi</Label>
                <div className="relative">
                  <Lock className={iconCls} aria-hidden />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={daftar ? "new-password" : "current-password"}
                    placeholder={daftar ? "Minimal 8 karakter" : "Kata sandi"}
                    value={password}
                    onChange={edit("password", setPassword)}
                    onFocus={() => setPwFocus(true)}
                    onBlur={() => setPwFocus(false)}
                    disabled={pending}
                    aria-invalid={Boolean(fieldErrors.password) || (hasError && !clientCount)}
                    aria-describedby="password-help"
                    className={cn(fieldCls, "pr-14")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    // Cegah input kehilangan fokus saat tombol mata ditekan, supaya Lori tidak berkedip.
                    onMouseDown={(e) => e.preventDefault()}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-[3px] top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[10px] text-ink-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-sky"
                  >
                    {showPassword ? <EyeOff className="size-[22px]" aria-hidden /> : <Eye className="size-[22px]" aria-hidden />}
                  </button>
                </div>
                {daftar && password ? (
                  <div className="pop flex items-center gap-2.5" aria-hidden>
                    <div className="grid flex-1 grid-cols-4 gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className="block h-2 overflow-hidden rounded-full bg-hairline">
                          <span
                            className={cn(
                              "block h-full origin-left rounded-full transition-[transform,background-color] duration-300 [transition-timing-function:var(--ease-spring)]",
                              STRENGTH_COLOR[Math.max(0, strength - 1)],
                              i < strength ? "scale-x-100" : "scale-x-0",
                            )}
                          />
                        </span>
                      ))}
                    </div>
                    <span className={cn("min-w-[84px] text-right text-[0.875rem] font-bold", STRENGTH_TEXT[Math.max(0, strength - 1)])}>
                      {STRENGTH_LABEL[strength]}
                    </span>
                  </div>
                ) : null}
                <span
                  id="password-help"
                  className={cn("min-h-5 text-[0.875rem]", fieldErrors.password ? "text-brick-deep" : "text-ink-subtle")}
                >
                  {fieldErrors.password ?? (daftar ? "Pakai campuran huruf, angka, dan simbol biar kuat." : "")}
                </span>
              </div>

              {daftar ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm">Ulangi kata sandi</Label>
                  <div className="relative">
                    <ShieldCheck className={iconCls} aria-hidden />
                    <Input
                      id="confirm"
                      name="confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Ketik ulang kata sandi"
                      value={confirm}
                      onChange={edit("confirm", setConfirm)}
                      onFocus={() => setPwFocus(true)}
                      onBlur={() => setPwFocus(false)}
                      disabled={pending}
                      aria-invalid={Boolean(fieldErrors.confirm)}
                      aria-describedby="confirm-help"
                      className={cn(fieldCls, confirm && confirm === password && "border-primary-line")}
                    />
                  </div>
                  <span
                    id="confirm-help"
                    className={cn("min-h-5 text-[0.875rem]", fieldErrors.confirm ? "text-brick-deep" : "text-primary")}
                  >
                    {fieldErrors.confirm ?? (confirm && confirm === password ? "Cocok." : "")}
                  </span>
                </div>
              ) : null}

              <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full text-[1.1875rem] tracking-[0.02em]">
                {pending ? <Loader2 className="size-[22px] animate-spin" aria-hidden /> : null}
                {pending ? (daftar ? "Membuat akun…" : "Memeriksa…") : daftar ? "Buat akun" : "Masuk"}
              </Button>
            </form>

            {SITE_CLOSED ? null : (
              <p className="text-center text-[0.9375rem] text-ink-muted">
                {daftar ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode(daftar ? "masuk" : "daftar")}
                  className="min-h-11 cursor-pointer rounded-[8px] px-1.5 font-bold text-primary hover:text-primary-deep hover:underline"
                >
                  {daftar ? "Masuk" : "Daftar gratis"}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <aside
        aria-label="Sorotan"
        className={cn(
          "relative m-4 hidden min-h-[560px] min-w-0 flex-[1_1_480px] flex-col gap-7 overflow-hidden rounded-[32px] p-12 text-white transition-colors duration-500 lg:flex",
          hasError ? "bg-brick-deep" : "bg-primary",
        )}
      >
        <span aria-hidden className="absolute -bottom-[120px] -right-[120px] size-[520px] rounded-full border-2 border-white/10" />
        <span aria-hidden className="absolute -bottom-10 -right-10 size-[360px] rounded-full bg-white/[.07]" />
        <span aria-hidden className="absolute bottom-[180px] left-10 size-3.5 rounded-full bg-mango" />
        <span aria-hidden className="absolute left-[120px] top-[260px] size-2.5 rounded-full bg-primary-line" />

        <div className="relative flex flex-col gap-3">
          <p className={cn("eyebrow", hasError ? "text-brick-soft" : "text-primary-soft")}>{eyebrow}</p>
          <h2 className="max-w-[460px] font-display text-[2.625rem] font-black leading-[1.08] tracking-[-0.03em]">
            {heroTitle}
          </h2>
        </div>

        <div className="relative flex items-center gap-2.5 self-start rounded-full bg-surface py-2.5 pl-2.5 pr-4 text-ink shadow-[0_4px_0_rgba(0,0,0,.18)]">
          <span className="flex size-8 items-center justify-center rounded-full bg-mango-soft text-mango-deep">
            <Timer className="size-[18px]" aria-hidden />
          </span>
          <span className="font-bold">3 menit sehari · bareng Lori</span>
        </div>

        <div className="absolute bottom-[280px] right-[298px] max-w-[230px]" aria-live="polite">
          <div
            key={bubble}
            className="pop relative origin-bottom-right rounded-[18px] bg-surface px-4 py-3.5 text-base font-bold leading-snug text-ink shadow-[0_5px_0_rgba(0,0,0,.18)]"
          >
            {bubble}
            <span aria-hidden className="absolute -right-2 bottom-4 size-[18px] rotate-45 rounded-[3px] bg-surface" />
          </div>
        </div>

        <Lori mood={mood} size={300} label={`Lori: ${bubble}`} className="absolute bottom-6 right-8" />
      </aside>
    </main>
  );
}
