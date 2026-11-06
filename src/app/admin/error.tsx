"use client";

import { ErrorScreen } from "@/components/error-screen";

/** Error boundary panel admin. */
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
      logTag="[admin]"
      mascot={false}
      title="Panel admin gagal dimuat"
      description="Coba lagi. Kalau masih gagal, cek kode:"
      onReset={reset}
    />
  );
}
