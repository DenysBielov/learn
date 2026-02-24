export default function SessionsLoading() {
  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-6 animate-pulse">
      <div className="h-7 w-32 bg-muted rounded" />

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border rounded-[10px] p-3 space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-6 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border rounded-[10px] p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-5 w-20 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
