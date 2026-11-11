import Link from "next/link";
import { useId } from "react";

import { cn } from "@/lib/utils";

type LogoProps = {
  /** Ukuran icon dalam piksel */
  size?: number;
  /** Tampilkan teks nama "EnglishApp" */
  showText?: boolean;
  /** Ukuran variasi: sm, md, lg */
  variant?: "horizontal" | "vertical" | "icon";
  /** Kelas CSS tambahan */
  className?: string;
  /** Link tujuan jika ingin dibungkus Link Next.js (default: undefined) */
  href?: string;
  /** Subjudul kecil di bawah nama */
  subtitle?: string;
};

/**
 * Icon Emblem Lori - Maskot Kukang Belajar
 * Dibuat dalam SVG murni beresolusi tajam di semua DPI
 */
export function LoriIconBadge({ size = 40, className }: { size?: number; className?: string }) {
  const uid = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0 select-none drop-shadow-sm transition-transform hover:scale-105", className)}
      aria-hidden="true"
    >
      <defs>
        {/* Gradien background badge hijau khas EnglishApp */}
        <linearGradient id={`${uid}-badgeGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#258554" />
          <stop offset="100%" stopColor="#145536" />
        </linearGradient>

        {/* Gradien kilau halus pada badge */}
        <linearGradient id={`${uid}-sheenGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.0" />
        </linearGradient>

        {/* Gradien syal Lori */}
        <linearGradient id={`${uid}-scarfGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F2A93B" />
          <stop offset="100%" stopColor="#C4831F" />
        </linearGradient>

        <clipPath id={`${uid}-squircleClip`}>
          <rect x="2" y="2" width="96" height="96" rx="26" ry="26" />
        </clipPath>
      </defs>

      {/* Background Squircle dengan sudut rounded khas modern app */}
      <rect x="2" y="2" width="96" height="96" rx="26" ry="26" fill={`url(#${uid}-badgeGrad)`} />
      
      {/* Inner border untuk efek kedalaman / 3D rim */}
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="25"
        ry="25"
        fill="none"
        stroke="#79c79a"
        strokeWidth="1.5"
        strokeOpacity="0.45"
      />

      {/* Pola lingkaran lembut di background */}
      <circle cx="50" cy="50" r="38" fill="#ffffff" fillOpacity="0.06" />

      {/* Konten Lori dipotong agar rapi di dalam squircle jika lewat bawah */}
      <g clipPath={`url(#${uid}-squircleClip)`}>
        {/* Telinga Kukang */}
        <circle cx="28" cy="38" r="9.5" fill="#C98B52" />
        <circle cx="28" cy="38" r="4.5" fill="#8A5530" />
        <circle cx="72" cy="38" r="9.5" fill="#C98B52" />
        <circle cx="72" cy="38" r="4.5" fill="#8A5530" />

        {/* Kepala Lori */}
        <ellipse cx="50" cy="52" rx="30" ry="27" fill="#C98B52" />
        
        {/* Moncong/Pipi Bagian Cream */}
        <ellipse cx="50" cy="59" rx="23" ry="17" fill="#F6E4C6" />

        {/* Mask Mata Khas Kukang (Dark Patches) */}
        <ellipse cx="38" cy="51" rx="10.5" ry="12.5" fill="#6E4024" transform="rotate(-15 38 51)" />
        <ellipse cx="62" cy="51" rx="10.5" ry="12.5" fill="#6E4024" transform="rotate(15 62 51)" />

        {/* Garis dahi cream */}
        <path d="M47.5 28 Q50 26 52.5 28 L51.8 55 L48.2 55 Z" fill="#F6E4C6" />

        {/* Mata Bulat Besar Lori */}
        <circle cx="38.5" cy="52" r="7" fill="#FFFFFF" />
        <circle cx="61.5" cy="52" r="7" fill="#FFFFFF" />

        {/* Pupil Hitam Berbinar */}
        <circle cx="39.5" cy="52" r="4.8" fill="#1B1F22" />
        <circle cx="62.5" cy="52" r="4.8" fill="#1B1F22" />

        {/* Kilau Mata Putih */}
        <circle cx="41.2" cy="50" r="1.8" fill="#FFFFFF" />
        <circle cx="64.2" cy="50" r="1.8" fill="#FFFFFF" />
        <circle cx="38" cy="53.5" r="0.9" fill="#FFFFFF" />
        <circle cx="61" cy="53.5" r="0.9" fill="#FFFFFF" />

        {/* Hidung Imut */}
        <ellipse cx="50" cy="63.5" rx="3.2" ry="2.2" fill="#3A2416" />

        {/* Senyum Ramah */}
        <path
          d="M45.5 67 Q50 71.5 54.5 67"
          stroke="#3A2416"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />

        {/* Pipi Merona (Blush) */}
        <circle cx="31" cy="61" r="3.5" fill="#F08A7A" opacity="0.6" />
        <circle cx="69" cy="61" r="3.5" fill="#F08A7A" opacity="0.6" />

        {/* Syal Hangat Lori (Kuning Mangga Emas Aksen Belajar) */}
        <path
          d="M26 73 Q50 82 74 73 L75 82 Q50 91 25 82 Z"
          fill={`url(#${uid}-scarfGrad)`}
        />
        {/* Ujung syal menjuntai */}
        <path d="M58 80 L67 96 L58 95 L54 81 Z" fill="#C4831F" />
      </g>

      {/* Kilau glossy atas */}
      <rect x="2" y="2" width="96" height="42" rx="26" fill={`url(#${uid}-sheenGrad)`} clipPath={`url(#${uid}-squircleClip)`} />

      {/* Badge aksen bintang kecil belajar di kanan atas */}
      <g transform="translate(68, 8) scale(0.7)">
        <circle cx="16" cy="16" r="13" fill="#F2A93B" stroke="#ffffff" strokeWidth="2.5" />
        {/* Ikon Huruf E / Buku Kecil */}
        <path
          d="M12 11 H20 M12 16 H18 M12 21 H20"
          stroke="#3A2416"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * Komponen Logo Lengkap EnglishApp
 * Fleksibel digunakan di navbar, hero section, footer, login page
 */
export function Logo({
  size = 40,
  variant = "horizontal",
  showText = true,
  subtitle,
  className,
  href,
}: LogoProps) {
  const content = (
    <div
      className={cn(
        "group inline-flex items-center gap-3 transition-opacity hover:opacity-95",
        variant === "vertical" && "flex-col text-center",
        className,
      )}
    >
      <LoriIconBadge size={size} />

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="font-display font-black tracking-[-0.025em] text-ink">
            <span className="text-[1.25em] font-black text-ink">English</span>
            <span className="text-[1.25em] font-black text-primary">App</span>
          </div>
          {subtitle ? (
            <span className="mt-0.5 text-[0.72em] font-bold text-ink-subtle tracking-wide">
              {subtitle}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control">
        {content}
      </Link>
    );
  }

  return content;
}
