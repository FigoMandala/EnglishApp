"use client";

import { ErrorScreen } from "@/components/error-screen";

/** Error boundary global untuk halaman di luar grup (app) dan admin. */
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
      title="Waduh, ada yang bermasalah"
      description="Coba muat ulang. Kalau masih gagal, kabari admin dengan kode:"
      onReset={reset}
      className="min-h-screen bg-canvas text-ink"
    />
  );
}
