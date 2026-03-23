export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)]" />
        <div className="h-10 w-32 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)]" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6"
          >
            <div className="h-4 w-24 rounded bg-[var(--color-bg-tertiary)]" />
            <div className="mt-3 h-8 w-16 rounded bg-[var(--color-bg-tertiary)]" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-[var(--color-bg-tertiary)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[var(--color-bg-tertiary)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--color-bg-tertiary)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
