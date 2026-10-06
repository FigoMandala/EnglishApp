"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { login, register, type AuthState } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const initialState: AuthState = {};

const TABS = [
  { value: "login", label: "Masuk" },
  { value: "register", label: "Daftar" },
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
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Masuk atau daftar"
        className="grid h-[52px] grid-cols-2 gap-1 rounded-[14px] bg-surface-sunken p-1"
      >
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
                "flex h-full items-center justify-center rounded-[10px] text-base font-semibold text-ink-subtle transition-colors duration-200 hover:text-ink",
                active && "bg-surface font-bold text-ink shadow-card",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <form
        key={mode}
        action={isLogin ? loginAction : registerAction}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              className="py-2 text-[0.9375rem] font-semibold text-accent hover:text-accent-ink"
            >
              {showPassword ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "Password" : "Minimal 8 karakter"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "auth-error" : undefined}
          />
        </div>

        <div id="auth-error">
          <FieldError>{error}</FieldError>
        </div>

        <Button type="submit" disabled={pending} className="h-14 w-full text-lg">
          {isLogin ? "Masuk" : "Buat akun"}
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-5" aria-hidden />
          )}
        </Button>
      </form>
    </div>
  );
}
