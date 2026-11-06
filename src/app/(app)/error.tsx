"use client";

import { ErrorScreen } from "@/components/error-screen";

/** Error boundary grup (app): halaman dalam shell gagal dirender. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      error={error}
      logTag="[app]"
      title="Waduh, halaman ini lagi bermasalah"
      description="Coba muat ulang. Kalau masih gagal, kabari admin dengan kode:"
      onReset={reset}
    />
  );
}
