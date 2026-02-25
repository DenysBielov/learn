export default function SessionsLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-4 sm:p-6 space-y-5 animate-pulse">
      {/* Header */}
      <div className="h-9 w-40 bg-muted rounded" />

      {/* Stats bar */}
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="contents">
            {i > 0 && <div className="w-px h-7 bg-border" />}
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="h-6 w-12 bg-muted rounded" />
              <div className="h-2.5 w-16 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="bg-card border rounded-[10px] p-4">
        <div className="h-[120px] bg-muted/30 rounded" />
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
                <div className="h-3 w-14 bg-muted rounded" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-8 bg-muted rounded" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-3 h-3 rounded-sm bg-muted" />
            ))}
            <div className="h-3 w-8 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="h-9 bg-muted rounded-md" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-28 bg-muted rounded-md" />
        ))}
        <div className="h-8 w-32 bg-muted rounded-md ml-auto" />
      </div>

      {/* Session rows */}
      <div className="border rounded-[10px] overflow-hidden divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-1/5 rounded bg-muted" />
            </div>
            <div className="h-5 w-16 rounded-full bg-muted hidden sm:block" />
            <div className="h-5 w-12 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-4 w-14 rounded bg-muted hidden sm:block" />
            <div className="h-4 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
