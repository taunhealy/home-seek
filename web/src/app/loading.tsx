export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <div className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-200 animate-pulse" />
          <div className="space-y-1.5">
            <div className="w-24 h-3.5 rounded bg-zinc-200 animate-pulse" />
            <div className="w-16 h-2 rounded bg-zinc-100 animate-pulse" />
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="w-20 h-8 rounded-lg bg-zinc-100 animate-pulse" />
          <div className="w-20 h-8 rounded-lg bg-zinc-100 animate-pulse" />
          <div className="w-20 h-8 rounded-lg bg-zinc-100 animate-pulse" />
        </div>
        <div className="w-24 h-9 rounded-xl bg-zinc-200 animate-pulse" />
      </div>

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-12 pb-16 space-y-6">
        <div className="w-56 h-7 rounded-xl bg-zinc-200 animate-pulse" />
        <div className="w-80 h-4 rounded-lg bg-zinc-200/70 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 rounded-3xl bg-white border border-zinc-200 p-5 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 animate-pulse" />
              <div className="w-3/4 h-4 rounded bg-zinc-200 animate-pulse" />
              <div className="w-full h-3 rounded bg-zinc-100 animate-pulse" />
              <div className="w-2/3 h-3 rounded bg-zinc-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
