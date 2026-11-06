/** Skeleton generik selagi halaman (app) menunggu query server. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat halaman…</span>
      <div className="flex flex-col gap-2">
        <div className="h-4 w-40 animate-pulse rounded-[6px] bg-canvas-deep motion-reduce:animate-none" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-[10px] bg-canvas-deep motion-reduce:animate-none" />
      </div>
      <div className="h-[128px] w-full animate-pulse rounded-hero bg-canvas-deep motion-reduce:animate-none" />
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-plate bg-canvas-deep motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-[240px] w-full animate-pulse rounded-plate bg-canvas-deep motion-reduce:animate-none" />
    </div>
  );
}
