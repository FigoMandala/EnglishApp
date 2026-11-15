"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { FieldError, Input, Label } from "@/components/ui/field";
import { DISPLAY_NAME_MAX } from "@/lib/account-validation";
import { cn } from "@/lib/utils";

import { changePasswordAction, updateDisplayNameAction, type SettingsState } from "./actions";

const idle: SettingsState = { status: "idle" };

const btn =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-6 text-[0.9375rem] font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:cursor-not-allowed disabled:opacity-60";
const btnPrimary = cn(btn, "bg-primary text-white hover:bg-primary-deep");
const btnSoft = cn(btn, "bg-surface-muted text-ink hover:bg-hairline-soft");

function Status({ state }: { state: SettingsState }) {
  // Wilayah aria-live selalu ada supaya pembaca layar menangkap perubahan isinya.
  return (
    <p role="status" aria-live="polite" className="min-h-5 text-[0.875rem] font-bold text-primary-deep">
      {state.status === "ok" ? state.message : ""}
    </p>
  );
}

function Pending({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return pending ? (
    <>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Menyimpan
    </>
  ) : (
    children
  );
}

export function ProfileForm({ username, initialName }: { username: string; initialName: string }) {
  const [state, action, pending] = useActionState(updateDisplayNameAction, idle);
  const [name, setName] = useState(initialName);
  const error = state.fields?.name;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pg-name">Nama tampilan</Label>
          <Input
            id="pg-name"
            name="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "pg-name-err" : undefined}
          />
          <FieldError id="pg-name-err">{error}</FieldError>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pg-user">Username</Label>
          <Input id="pg-user" value={username} readOnly aria-describedby="pg-user-help" className="text-ink-subtle" />
          <p id="pg-user-help" className="text-[0.8125rem] text-ink-subtle">
            Dipakai untuk masuk, tidak bisa diganti.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btnPrimary}>
          <Pending pending={pending}>Simpan nama</Pending>
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, action, pending] = useActionState(async (prev: SettingsState, formData: FormData) => {
    const result = await changePasswordAction(prev, formData);
    if (result.status === "ok") {
      setCurrent("");
      setNext("");
    }
    return result;
  }, idle);
  const { current: currentError, next: nextError } = state.fields ?? {};

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pg-cur">Kata sandi saat ini</Label>
          <Input
            id="pg-cur"
            name="current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-invalid={Boolean(currentError)}
            aria-describedby={currentError ? "pg-cur-err" : undefined}
          />
          <FieldError id="pg-cur-err">{currentError}</FieldError>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pg-new">Kata sandi baru</Label>
          <Input
            id="pg-new"
            name="next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-invalid={Boolean(nextError)}
            aria-describedby={nextError ? "pg-new-err" : undefined}
          />
          <FieldError id="pg-new-err">{nextError}</FieldError>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btnSoft}>
          <Pending pending={pending}>Ganti kata sandi</Pending>
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
