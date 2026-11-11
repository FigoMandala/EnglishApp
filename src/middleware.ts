import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP berbasis nonce (audit keamanan P2): script-src 'unsafe-inline' di
 * produksi membuat CSP hampir tidak berguna sebagai benteng XSS — setiap
 * inline script yang berhasil disuntik langsung dieksekusi. Middleware
 * mencetak nonce per-request; Next otomatis menempelkan nonce yang sama ke
 * bootstrap script-nya kalau header CSP dikirim ulang di request.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  // Dev butuh unsafe-eval untuk react-refresh/HMR; produksi menutup eval JS sepenuhnya.
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` + (isDev ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // Audio suara AI diputar dari blob URL (hasil fetch /api/tts).
    "media-src 'self' blob: data:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next membaca header CSP di request untuk memberi nonce pada script-nya sendiri.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Semua kecuali file statis Next dan prefetch router (pola resmi Next.js).
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
