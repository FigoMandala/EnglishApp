const COLORS = ["#1e7a4c", "#f2a93b", "#2f6fde", "#c2462b", "#79c79a"];

/** Pseudo-acak deterministik, jadi aman di server component dan tidak mismatch saat hydrate. */
function rnd(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Letakkan di dalam parent `relative`. Sekali ledak, tanpa interaksi. */
export function Confetti({ count = 28 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          className="confetti-bit"
          style={
            {
              "--i": i,
              "--x": `${Math.round((rnd(i, 1) - 0.5) * 520)}px`,
              "--y": `${Math.round(120 + rnd(i, 2) * 320)}px`,
              "--r": `${Math.round((rnd(i, 3) - 0.5) * 900)}deg`,
              background: COLORS[i % COLORS.length],
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
