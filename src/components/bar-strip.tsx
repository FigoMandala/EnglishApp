type Point = { label: string; value: number };

export function BarStrip({ data, unit = "" }: { data: Point[]; unit?: string }) {
  const max = Math.max(1, ...data.map((point) => point.value));

  return (
    <div className="flex items-end gap-2" role="img" aria-label={`Grafik aktivitas ${data.length} hari terakhir`}>
      {data.map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="tnum font-mono text-[0.625rem] text-ink-faint">
            {point.value > 0 ? point.value : ""}
          </span>
          <div
            className="w-full rounded-t-[3px] bg-accent/80"
            style={{ height: `${Math.max(2, (point.value / max) * 72)}px` }}
            title={`${point.label}: ${point.value}${unit}`}
          />
          <span className="truncate text-[0.625rem] text-ink-subtle">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
