export default function SearchLoading() {
  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden">
      {/* Top Navbar Skeleton */}
      <div className="h-16 shrink-0 border-b border-zinc-200 px-6 flex items-center justify-between bg-white">
        <div className="w-32 h-8 rounded-xl bg-zinc-200 animate-pulse" />
        <div className="hidden md:flex gap-2">
          <div className="w-20 h-8 rounded-lg bg-zinc-100 animate-pulse" />
          <div className="w-20 h-8 rounded-lg bg-zinc-100 animate-pulse" />
          <div className="w-20 h-8 rounded-lg bg-zinc-100 animate-pulse" />
        </div>
        <div className="w-24 h-8 rounded-full bg-zinc-200 animate-pulse" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="shrink-0 border-b border-zinc-200 px-4 py-2.5 space-y-2 bg-white">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-44 h-8 rounded-full bg-zinc-100 animate-pulse" />
          <div className="w-40 h-8 rounded-full bg-zinc-100 animate-pulse" />
          <div className="w-28 h-8 rounded-full bg-zinc-100 animate-pulse" />
          <div className="w-44 h-8 rounded-full bg-zinc-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-24 h-6 rounded-full bg-zinc-100 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Split Column + Map Skeleton */}
      <div className="flex-1 flex min-h-0">
        <div className="w-full sm:w-[340px] lg:w-[370px] xl:w-[410px] shrink-0 border-r border-zinc-200 p-3.5 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <div className="w-28 h-5 rounded bg-zinc-200 animate-pulse" />
            <div className="w-24 h-7 rounded-xl bg-zinc-100 animate-pulse" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 p-3 space-y-2.5">
              <div className="w-full h-36 rounded-xl bg-zinc-100 animate-pulse" />
              <div className="w-3/4 h-4 rounded bg-zinc-200 animate-pulse" />
              <div className="w-1/2 h-3 rounded bg-zinc-100 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex-1 bg-zinc-100 animate-pulse hidden sm:flex items-center justify-center">
          <div className="px-4 py-2 rounded-full bg-white/90 border border-zinc-200 text-xs font-bold text-zinc-600 shadow-sm">
            Loading Cape Town Radar Map...
          </div>
        </div>
      </div>
    </div>
  );
}
