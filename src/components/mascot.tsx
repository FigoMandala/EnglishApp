import { cn } from "@/lib/utils";

/**
 * Karakter redesign: Lori (kukang, teman belajar) dan Kaka (enggang, pelatih EPrT).
 * SVG murni + kelas animasi CSS di globals.css (m-*), jadi aman dipakai di server component
 * dan otomatis diam kalau pengguna memilih "kurangi gerakan".
 */

export type LoriMood = "idle" | "wave" | "talk" | "think" | "sad" | "cheer";
export type KakaMood = "coach" | "warn" | "proud" | "sleep";

type Props<M> = {
  mood?: M;
  size?: number;
  /** Teks untuk pembaca layar. Kosongkan kalau karakternya dekoratif. */
  label?: string;
  className?: string;
  /** Matikan semua idle loop (dashboard/admin). */
  still?: boolean;
};

function a11y(label?: string) {
  return label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
}

const FUR = "#C98B52";
const FUR_DARK = "#B87842";
const CREAM = "#F6E4C6";
const MASK = "#6E4024";
const INK = "#3A2416";

export function Lori({ mood = "idle", size = 160, label, className, still }: Props<LoriMood>) {
  const armsUp = mood === "cheer";
  const happyEyes = mood === "cheer";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cn(!still && mood === "cheer" && "m-hop", className)} {...a11y(label)}>
      <ellipse cx="100" cy="192" rx="56" ry="7" fill="#1B1F22" opacity=".12" />
      <g className={cn(!still && "m-breathe")}>
        {armsUp ? (
          <>
            <g className={cn(!still && "m-cheer")}><ellipse cx="42" cy="104" rx="12" ry="25" fill={FUR_DARK} transform="rotate(40 42 104)" /></g>
            <g className={cn(!still && "m-cheer")}><ellipse cx="158" cy="104" rx="12" ry="25" fill={FUR_DARK} transform="rotate(-40 158 104)" /></g>
          </>
        ) : (
          <g><ellipse cx="52" cy="150" rx="13" ry="24" fill={FUR_DARK} transform="rotate(18 52 150)" /></g>
        )}
        <ellipse cx="100" cy="148" rx="56" ry="44" fill={FUR} />
        <ellipse cx="100" cy="158" rx="34" ry="29" fill={CREAM} />
        <ellipse cx="78" cy="188" rx="15" ry="7" fill={FUR_DARK} />
        <ellipse cx="122" cy="188" rx="15" ry="7" fill={FUR_DARK} />
        <path d="M58 120 Q100 138 142 120 L144 132 Q100 150 56 132 Z" fill="#1E7A4C" />
        <path d="M118 130 L132 164 L118 161 L112 134 Z" fill="#145536" />
        <g className={!still && mood === "sad" ? undefined : "m-tilt"}>
          <circle cx="56" cy="44" r="15" fill={FUR} />
          <circle cx="56" cy="44" r="7" fill="#8A5530" />
          <circle cx="144" cy="44" r="15" fill={FUR} />
          <circle cx="144" cy="44" r="7" fill="#8A5530" />
          <ellipse cx="100" cy="78" rx="58" ry="52" fill={FUR} />
          <ellipse cx="100" cy="92" rx="46" ry="35" fill={CREAM} />
          <ellipse cx="76" cy="78" rx="21" ry="25" fill={MASK} transform="rotate(-18 76 78)" />
          <ellipse cx="124" cy="78" rx="21" ry="25" fill={MASK} transform="rotate(18 124 78)" />
          <path d="M95 30 Q100 27 105 30 L104 98 L96 98 Z" fill={CREAM} />
          {happyEyes ? (
            <>
              <path d="M64 82 Q77 68 90 82" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M110 82 Q123 68 136 82" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <g className={cn(!still && "m-blink")}>
              <circle cx="77" cy="80" r="14" fill="#FFFFFF" />
              <circle cx="123" cy="80" r="14" fill="#FFFFFF" />
              <g className={!still && (mood === "think" || mood === "sad") ? undefined : "m-look"}>
                <circle cx={mood === "think" ? 82 : 79} cy={mood === "think" ? 74 : mood === "sad" ? 85 : 81} r="9" fill="#1B1F22" />
                <circle cx={mood === "think" ? 128 : 125} cy={mood === "think" ? 74 : mood === "sad" ? 85 : 81} r="9" fill="#1B1F22" />
                <circle cx="82" cy="77" r="3" fill="#FFFFFF" />
                <circle cx="128" cy="77" r="3" fill="#FFFFFF" />
              </g>
            </g>
          )}
          {mood === "sad" ? (
            <>
              <path d="M62 62 Q72 56 88 60" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path d="M112 60 Q128 56 138 62" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            </>
          ) : null}
          <ellipse cx="100" cy="103" rx="6" ry="4.5" fill={INK} />
          {mood === "talk" ? (
            <ellipse className={cn(!still && "m-talk")} cx="100" cy="115" rx="8" ry="7" fill={INK} />
          ) : mood === "cheer" ? (
            <path d="M84 110 Q100 132 116 110 Z" fill={INK} />
          ) : (
            <path
              d={mood === "sad" ? "M90 118 Q100 110 110 118" : mood === "think" ? "M93 114 Q101 112 108 116" : "M89 111 Q100 122 111 111"}
              stroke={INK}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
          )}
          <circle cx="63" cy="104" r="7" fill="#F08A7A" opacity=".45" />
          <circle cx="137" cy="104" r="7" fill="#F08A7A" opacity=".45" />
        </g>
        {armsUp ? null : mood === "think" ? (
          <g><ellipse cx="128" cy="124" rx="12" ry="24" fill={FUR_DARK} transform="rotate(-62 128 124)" /></g>
        ) : (
          <g className={!still && (mood === "wave" || mood === "talk") ? "m-wave" : undefined}>
            <ellipse
              cx={mood === "wave" ? 154 : 148}
              cy={mood === "wave" ? 122 : 150}
              rx="12"
              ry="24"
              fill={FUR_DARK}
              transform={mood === "wave" ? "rotate(-38 154 122)" : "rotate(-18 148 150)"}
            />
          </g>
        )}
      </g>
    </svg>
  );
}

const BODY = "#2A2C33";
const BEAK = "#F2A93B";

export function Kaka({ mood = "coach", size = 160, label, className, still }: Props<KakaMood>) {
  const sleep = mood === "sleep";
  return (
    <svg
      viewBox="0 0 220 200"
      width={size}
      height={(size * 200) / 220}
      className={cn(!still && mood === "proud" && "m-hop", className)}
      {...a11y(label)}
    >
      <ellipse cx="96" cy="192" rx="50" ry="7" fill="#1B1F22" opacity=".12" />
      {sleep && !still ? (
        <text className="m-zz" x="170" y="40" fontFamily="sans-serif" fontWeight="900" fontSize="22" fill="#8F8574">
          z
        </text>
      ) : null}
      <g className={cn(!still && "m-breathe")}>
        <path d="M50 150 L18 176 L30 182 L62 164 Z" fill="#1E2026" />
        <ellipse cx="92" cy="136" rx="48" ry="50" fill={BODY} />
        <ellipse cx="102" cy="150" rx="28" ry="32" fill="#F4EFE6" />
        <g className={!still && (mood === "proud" || mood === "warn") ? "m-flap" : undefined}>
          <ellipse cx="68" cy="128" rx="20" ry="34" fill="#1E2026" transform={mood === "warn" ? "rotate(40 68 128)" : "rotate(12 68 128)"} />
        </g>
        <path d="M86 184 v8 M106 184 v8" stroke={BEAK} strokeWidth="5" strokeLinecap="round" />
        <g className={!still && sleep ? undefined : "m-tilt"}>
          <circle cx="108" cy="74" r="38" fill={BODY} />
          <path d="M118 46 C136 26 176 30 192 54 C172 50 146 52 126 60 Z" fill="#D9583B" />
          <path d="M132 62 C164 58 196 76 206 108 C186 96 158 88 134 86 Z" fill={BEAK} />
          <path d="M136 80 C160 82 182 90 198 100" stroke="#C4831F" strokeWidth="3" fill="none" />
          {sleep || mood === "proud" ? (
            <path
              d={sleep ? "M104 70 Q114 78 124 70" : "M104 70 Q114 60 124 70"}
              stroke="#FFFFFF"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <g className={cn(!still && "m-blink")}>
              <circle cx="114" cy="68" r="11" fill="#FFFFFF" />
              <g className={cn(!still && "m-look")}>
                <circle cx="116" cy="69" r="6" fill="#1B1F22" />
                <circle cx="118" cy="66" r="2" fill="#FFFFFF" />
              </g>
            </g>
          )}
          {sleep ? null : <circle cx="114" cy="68" r="16" fill="none" stroke={BEAK} strokeWidth="3.5" />}
          {sleep ? null : (
            <path
              d={mood === "warn" ? "M96 46 Q110 52 128 44" : "M98 48 Q112 44 128 50"}
              stroke="#F4EFE6"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </g>
      </g>
    </svg>
  );
}
