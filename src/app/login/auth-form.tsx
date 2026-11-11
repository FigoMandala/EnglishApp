"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { login, type AuthState } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";

const initialState: AuthState = {};

export function AuthForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [{ error }, action, pending] = useActionState(login, initialState);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[2.5rem] font-black leading-[1.1] tracking-[-0.03em]">Masuk admin</h1>

      <form action={action} className="flex flex-col gap-[18px]" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="Username admin"
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
              autoComplete="current-password"
              placeholder="Kata sandi"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "auth-error" : undefined}
              className="pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className="absolute right-[7px] top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[10px] text-ink-subtle hover:bg-surface-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {error ? (
          <div id="auth-error">
            <FieldError>{error}</FieldError>
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full text-[1.125rem] tracking-[0.02em]">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Masuk
        </Button>
      </form>
    </div>
  );
}
