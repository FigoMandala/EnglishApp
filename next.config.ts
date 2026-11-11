import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Jangan bocorkan framework/versi lewat header bawaan (audit keamanan P3).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP dipindah ke src/middleware.ts (berbasis nonce per-request);
          // yang lama memakai script-src 'unsafe-inline' sehingga hampir
          // tidak memberi perlindungan script (audit keamanan P2).
        ],
      },
    ];
  },
};

export default nextConfig;
