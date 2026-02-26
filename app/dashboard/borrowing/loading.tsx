import { Skeleton } from "@/components/ui/skeleton"

export default function BorrowingLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <Skeleton className="h-4 w-28" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,18rem)_1fr]">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>
        <div className="border-t border-border/50 p-4">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
