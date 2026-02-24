export default function SessionDetailLoading() {
  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-6 animate-pulse">
      <div className="h-4 w-20 bg-muted rounded" />
      <div className="space-y-2">
        <div className="h-7 w-64 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border rounded-[10px] p-3 space-y-2">
                <div className="h-6 w-10 bg-muted rounded mx-auto" />
                <div className="h-3 w-16 bg-muted rounded mx-auto" />
              </div>
            ))}
          </div>
          <div className="bg-card border rounded-[10px] p-4 space-y-3">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-card border rounded-[10px] p-4 space-y-3">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
