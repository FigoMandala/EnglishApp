"use client";

/**
 * Cadangan terakhir kalau layout akar gagal dirender. error.tsx tidak menangkap
 * galat layout di segmennya sendiri, dan CSS app belum tentu termuat di sini, jadi
 * gaya ditulis inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f4efe6",
          color: "#1b1f22",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main
          role="alert"
          style={{
            width: "min(92vw, 28rem)",
            boxSizing: "border-box",
            padding: "1.75rem",
            borderRadius: "20px",
            border: "2px solid #e2dacb",
            background: "#ffffff",
          }}
        >
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>Waduh, ada yang bermasalah</h1>
          <p style={{ margin: "0 0 1.25rem", color: "#3b4147", lineHeight: 1.5 }}>
            Coba muat ulang. Kalau masih gagal, kabari admin
            {error.digest ? ` dengan kode: ${error.digest}` : "."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "48px",
              padding: "0 1.5rem",
              border: 0,
              borderRadius: "14px",
              background: "#1e7a4c",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
        </main>
      </body>
    </html>
  );
}
