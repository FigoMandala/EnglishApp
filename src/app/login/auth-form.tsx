"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { login, register, type AuthState } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const initialState: AuthState = {};

const TABS = [
  { value: "login", label: "Masuk" },
  { value: "register", label: "Buat akun" },
] as const;

type Mode = (typeof TABS)[number]["value"];

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, loginAction, loginPending] = useActionState(login, initialState);
  const [registerState, registerAction, registerPending] = useActionState(register, initialState);

  const isLogin = mode === "login";
  const state = isLogin ? loginState : registerState;
  const pending = isLogin ? loginPending : registerPending;
  const error = state.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[2.5rem] font-black leading-[1.1] tracking-[-0.03em]">
          {isLogin ? "Masuk lagi" : "Buat akun"}
        </h1>
        <p className="text-[1.0625rem] text-ink-subtle">
          {isLogin ? "Lanjutkan dari terakhir kali kamu belajar." : "Gratis. Progresmu tersimpan di akun ini."}
        </p>
      </div>

      <div role="tablist" aria-label="Masuk atau daftar" className="flex gap-1 rounded-[16px] bg-surface-sunken p-1">
        {TABS.map((tab) => {
          const active = tab.value === mode;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(tab.value)}
              className={cn(
                "h-11 flex-1 cursor-pointer rounded-[12px] font-display text-base font-extrabold text-ink-muted",
                active && "bg-surface text-ink shadow-[0_2px_0_var(--color-hairline-strong)]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <form key={mode} action={isLogin ? loginAction : registerAction} className="flex flex-col gap-[18px]" noValidate>
        {!isLogin ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Nama panggilan</Label>
            <Input id="displayName" name="displayName" autoComplete="nickname" maxLength={40} placeholder="Mis. Rara" />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="mis. budi"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "auth-error" : undefined}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Kata sandi</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={isLogin ? "Kata sandi" : "Minimal 8 karakter"}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "auth-error" : undefined}
              className="pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="absolute right-[7px] top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[10px] text-ink-subtle hover:bg-surface-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        <div id="auth-error">
          <FieldError>{error}</FieldError>
        </div>

        <Button type="submit" size="lg" disabled={pending} className="w-full text-[1.125rem] tracking-[0.02em]">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {isLogin ? "MASUK" : "BUAT AKUN"}
        </Button>
      </form>
    </div>
  );
}
