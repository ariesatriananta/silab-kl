import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardSegmentLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[28rem]">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-6 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <Skeleton className="h-6 w-36" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <Skeleton className="h-6 w-44" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-44" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
